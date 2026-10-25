#!/usr/bin/env node
// Compute one day: targets from the day's weight, per-item intake, exercise
// burn, deficit, flags and the weight trend. Prints two parts for the agent to
// paste into protocols/<date>.md verbatim: the metrics block and the computed
// body section. Writes nothing. Throws on any unresolved item, malformed line
// or missing data.
//
// usage: node scripts/compute-day.js <YYYY-MM-DD> [--root <dir>]

const fs = require('fs');
const path = require('path');
const { parseArgs, runMain, checkDate, fmt, round2 } = require('./lib/util');
const { labelsFor } = require('./lib/labels');
const { readProtocol, splitFrontmatter } = require('./lib/frontmatter');
const { loadItems } = require('./lib/data');
const { parseBody } = require('./lib/grammar');
const { loadProfile, loadHabits, targets, targetLines } = require('./lib/profile');
const { weighIns, weightFor, stall } = require('./lib/weight');

const USAGE = 'node scripts/compute-day.js <YYYY-MM-DD> [--root <dir>]';

const signed = (x) => (round2(x) > 0 ? `+${fmt(x)}` : fmt(x));
// 0.9, 1.25, 2: the factor without trailing zeros.
const factor = (x) => String(round2(x));

function foodRows(L, food) {
  return food.map((e) => {
    const { item } = e;
    let f;
    let per;
    if (item.kind === 'recipe') {
      f = e.amount;
      per = L.per_serving;
    } else if (item.kind === 'piece') {
      f = e.amount;
      per = L.per_piece;
    } else {
      f = e.amount / 100;
      per = item.basis === '100ml' ? L.per_100ml : L.per_100g;
    }
    return {
      e,
      working: `${factor(f)} × ${per}`,
      kcal: round2(f * item.kcal),
      protein: round2(f * item.protein_g),
      fat: round2(f * item.fat_g),
      carbs: round2(f * item.carbs_g),
    };
  });
}

function compute(root, date) {
  checkDate(date);
  const year = Number(date.slice(0, 4));
  const profile = loadProfile(root, year);
  const L = labelsFor(profile.language);
  const items = loadItems(root, L);
  const habits = loadHabits(root, items, L);

  const file = path.join(root, 'protocols', `${date}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`protocols/${date}.md not found; create it with node scripts/new-day.js ${date}`);
  }
  const proto = readProtocol(file, { strict: false });
  const { frontRaw } = splitFrontmatter(proto.text, proto.name);
  const offset = frontRaw.split('\n').length - 1;
  const { food, exercise } = parseBody(proto.body, proto.name, items, habits.activities, L, offset);
  const status = proto.metrics.status;

  const all = weighIns(root);
  const w = weightFor(all, date, profile, L);
  const t = targets(profile, w.weight, year);
  const st = stall(all, date);

  const out = [];
  out.push(`## ${L.computed_heading}`, '');
  out.push(L.generated_by(`node scripts/compute-day.js ${date}`), '');
  out.push(`### ${L.weight_targets_heading}`, '');
  out.push(`- ${L.weight}: ${fmt(w.weight)} kg (${w.source})`);
  out.push(...targetLines(L, profile, t), '');

  const block = { status, maintenance_kcal: t.maintenance };
  const flags = [];

  if (status === 'estimated') {
    const fromBlock = proto.metrics.deficit_kcal;
    const deficit = fromBlock !== null ? fromBlock : profile.away_day_deficit_kcal;
    const why = fromBlock !== null ? L.estimated_from_block : L.estimated_from_profile;
    Object.assign(block, { deficit_kcal: deficit, intake_kcal: null, burn_kcal: null, net_intake_kcal: null });
    out.push(`### ${L.totals_heading}`, '');
    out.push(`- ${L.status}: ${status}`);
    out.push(`- ${L.maintenance}: ${fmt(t.maintenance)} kcal`);
    out.push(`- ${L.deficit}: ${fmt(deficit)} kcal (${L.estimated_day(fmt(deficit))}; ${why})`, '');
  } else {
    const rows = foodRows(L, food);
    const sum = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
    const intake = sum('kcal');
    const protein = sum('protein');
    const fat = sum('fat');
    const carbs = sum('carbs');

    out.push(`### ${L.food_heading}`, '');
    if (!rows.length) {
      out.push(L.no_food, '');
    } else {
      out.push(
        `| ${L.col_time} | ${L.col_item} | ${L.col_amount} | ${L.col_working} | ${L.col_kcal} | ` +
          `${L.col_protein} | ${L.col_fat} | ${L.col_carbs} |`,
        '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |'
      );
      for (const r of rows) {
        out.push(
          `| ${r.e.time} | ${r.e.id} | ${r.e.amount} ${r.e.unit} | ${r.working} | ${fmt(r.kcal)} | ` +
            `${fmt(r.protein)} | ${fmt(r.fat)} | ${fmt(r.carbs)} |`
        );
      }
      out.push(
        `| | **${L.total}** | | | **${fmt(intake)}** | **${fmt(protein)}** | **${fmt(fat)}** | ` +
          `**${fmt(carbs)}** |`,
        ''
      );
    }

    const burns = exercise.map((e) => ({
      e,
      kcal: round2(e.met * w.weight * (e.minutes / 60)),
    }));
    const burn = round2(burns.reduce((s, b) => s + b.kcal, 0));
    out.push(`### ${L.exercise_heading}`, '');
    if (!burns.length) {
      out.push(L.no_exercise, '');
    } else {
      out.push(
        `| ${L.col_time} | ${L.col_activity} | ${L.col_minutes} | ${L.col_met} | ${L.col_working} | ` +
          `${L.col_kcal} |`,
        '| --- | --- | ---: | ---: | --- | ---: |'
      );
      for (const b of burns) {
        out.push(
          `| ${b.e.time} | ${b.e.id} | ${b.e.minutes} | ${b.e.met} | ` +
            `${b.e.met} × ${fmt(w.weight)} kg × ${b.e.minutes}/60 h | ${fmt(b.kcal)} |`
        );
      }
      out.push(`| | **${L.total}** | | | | **${fmt(burn)}** |`, '');
    }

    const net = round2(intake - burn);
    const deficit = round2(t.maintenance - net);
    Object.assign(block, { deficit_kcal: deficit, intake_kcal: intake, burn_kcal: burn, net_intake_kcal: net });

    out.push(`### ${L.totals_heading}`, '');
    out.push(`- ${L.status}: ${status}`);
    out.push(`- ${L.intake}: ${fmt(intake)} kcal`);
    out.push(`- ${L.burn}: ${fmt(burn)} kcal`);
    out.push(`- ${L.net_intake}: ${fmt(net)} kcal (${L.net_intake_note})`);
    out.push(`- ${L.maintenance}: ${fmt(t.maintenance)} kcal`);
    out.push(`- ${L.deficit}: ${fmt(deficit)} kcal (${L.deficit_note})`);
    out.push(`- ${L.intake_floor(fmt(t.floor), fmt(burn), fmt(t.floor + burn))}`);
    out.push(
      `- ${L.protein}: ${fmt(protein)} g (${L.floor} ${fmt(t.proteinFloor)}, ${L.target} ` +
        `${fmt(t.proteinTarget)}, ${L.top} ${fmt(t.proteinTop)}; ${L.vs_target} ` +
        `${signed(protein - t.proteinTarget)})`
    );
    out.push(`- ${L.fat}: ${fmt(fat)} g (${L.target} ${fmt(t.fat)}; ${L.vs_target} ${signed(fat - t.fat)})`);
    out.push(
      `- ${L.carbs}: ${fmt(carbs)} g (${L.target} ${fmt(t.carbs)}; ${L.vs_target} ${signed(carbs - t.carbs)})`,
      ''
    );

    if (protein < t.proteinFloor) flags.push(L.flag_protein(fmt(protein), fmt(t.proteinFloor)));
    if (deficit > profile.max_deficit_kcal) flags.push(L.flag_deficit(fmt(deficit), profile.max_deficit_kcal));
  }

  if (st.stalled) flags.push(L.flag_stall(fmt(st.now.mean), fmt(st.before.mean)));
  out.push(`### ${L.flags_heading}`, '');
  out.push(...(flags.length ? flags.map((f) => `- ${f}`) : [`- ${L.none}`]), '');

  const meanLine = (end, m) =>
    `- ${L.mean7(end)}: ${m ? `${fmt(m.mean)} kg (${L.weighins(m.n)})` : L.no_weighin}`;
  out.push(`### ${L.trend_heading}`, '');
  out.push(meanLine(date, st.now), meanLine(st.beforeEnd, st.before));
  out.push(
    `- ${L.stall_check}: ${!st.checked ? L.stall_skipped : st.stalled ? L.stall_yes : L.stall_none}`
  );

  const blockLines = ['metrics:', `  status: ${block.status}`];
  for (const key of ['maintenance_kcal', 'deficit_kcal', 'intake_kcal', 'burn_kcal', 'net_intake_kcal']) {
    blockLines.push(`  ${key}: ${block[key] === null ? 'null' : fmt(block[key])}`);
  }
  return { block, blockText: blockLines.join('\n'), bodyText: out.join('\n') };
}

function main(argv) {
  const opts = parseArgs(argv, { positional: ['date'], usage: USAGE });
  const { blockText, bodyText } = compute(opts.root, opts.date);
  console.log(
    `=== metrics block: replace the metrics: block in the frontmatter of protocols/${opts.date}.md ===`
  );
  console.log(blockText);
  console.log(
    `=== body section: replace everything from the computed heading to the end of the file ===`
  );
  console.log(bodyText);
  console.log('=== end ===');
}

module.exports = { compute };

if (require.main === module) runMain(main);
