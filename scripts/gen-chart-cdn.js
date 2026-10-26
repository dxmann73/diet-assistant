#!/usr/bin/env node
// Generate charts/chart-cdn.html: actual vs theoretical weight (kg).
// Theoretical line: anchor at the first weigh-in, then subtract each day's
// deficit as pure fat loss (deficit_kcal / 7700 = kg) for the next point.
// Days with no protocol file count at profile.json away_day_deficit_kcal and
// are listed on stderr. Title and labels follow profile.json language.
//
// usage: node scripts/gen-chart-cdn.js [--root <dir>]

const fs = require('fs');
const path = require('path');
const { parseArgs, runMain, addDays, today } = require('./lib/util');
const { labelsFor } = require('./lib/labels');
const { loadProfile } = require('./lib/profile');
const { extract, implausible } = require('./extract-data');

const USAGE = 'node scripts/gen-chart-cdn.js [--root <dir>]';
const KCAL_PER_KG = 7700;

function chartData(rows, awayDeficit) {
  if (!rows.length) throw new Error('no protocols yet; nothing to chart');
  // Expand protocol rows onto a continuous daily axis, synthesizing away days.
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const daily = [];
  for (let d = rows[0].date; ; d = addDays(d, 1)) {
    const row = byDate.get(d);
    daily.push(
      row
        ? { ...row, gap: false }
        : { date: d, weight_kg: null, deficit_kcal: awayDeficit, status: 'gap', gap: true }
    );
    if (d === rows[rows.length - 1].date) break;
  }

  let tw = null;
  const withTheoretical = daily.map((row) => {
    if (tw === null && row.weight_kg !== null) tw = row.weight_kg;
    const theoretical = tw !== null ? Number(tw.toFixed(2)) : null;
    if (tw !== null) tw -= row.deficit_kcal / KCAL_PER_KG;
    return { ...row, theoretical_weight: theoretical };
  });

  // Rows before the first weigh-in have neither line.
  const data = withTheoretical.filter((r) => r.weight_kg !== null || r.theoretical_weight !== null);
  return { data, gapDays: daily.filter((r) => r.gap).map((r) => r.date) };
}

function html(L, language, data) {
  const labels = data.map((r) => r.date);
  const weight = data.map((r) => r.weight_kg);
  const theoretical = data.map((r) => r.theoretical_weight);
  const deficit = data.map((r) => r.deficit_kcal);
  // Hollow point = deficit is assumed or partial, not fully costed.
  const softDay = data.map((r) => r.status !== 'closed');
  const dayNote = data.map((r) =>
    r.status === 'gap'
      ? L.chart_note_gap
      : r.status === 'open'
        ? L.chart_note_open
        : r.status === 'estimated'
          ? L.chart_note_estimated
          : ''
  );
  const j = JSON.stringify;
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<title>${L.chart_title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  #chart-container { max-width: 1000px; margin: 0 auto; }
</style>
</head>
<body>
<div id="chart-container">
  <h2>${L.chart_title}</h2>
  <canvas id="chart"></canvas>
</div>
<script>
const labels = ${j(labels)};
const weight = ${j(weight)};
const theoreticalWeight = ${j(theoretical)};
const deficit = ${j(deficit)};
const softDay = ${j(softDay)};
const dayNote = ${j(dayNote)};

new Chart(document.getElementById('chart'), {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {
        label: ${j(L.chart_actual)},
        data: weight,
        borderColor: '#59a14f',
        backgroundColor: 'rgba(89,161,79,0.08)',
        yAxisID: 'weight',
        tension: 0.2,
        pointRadius: 4,
        spanGaps: true,
      },
      {
        label: ${j(L.chart_theoretical)},
        data: theoreticalWeight,
        borderColor: '#4e79a7',
        backgroundColor: 'rgba(78,121,167,0.08)',
        yAxisID: 'weight',
        tension: 0.2,
        borderDash: [6, 4],
        pointRadius: softDay.map((soft) => (soft ? 3 : 4)),
        pointStyle: softDay.map((soft) => (soft ? 'circle' : 'rectRot')),
        pointBackgroundColor: softDay.map((soft) => (soft ? '#fff' : '#4e79a7')),
      },
    ],
  },
  options: {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    scales: {
      weight: {
        type: 'linear',
        position: 'left',
        grace: '5%',
        title: { display: true, text: 'kg' },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const i = items[0].dataIndex;
            return ${j(L.chart_deficit)} + ': ' + deficit[i] + ' kcal' + dayNote[i];
          },
        },
      },
    },
  },
});
</script>
</body>
</html>
`;
}

function generate(root) {
  const profile = loadProfile(root, Number(today().slice(0, 4)));
  const L = labelsFor(profile.language);
  const rows = extract(root);
  const wild = implausible(rows);
  if (wild.length) console.error(L.warn_implausible(wild.join(', ')));
  const { data, gapDays } = chartData(rows, profile.away_day_deficit_kcal);
  if (gapDays.length) {
    console.error(L.warn_gap_days(gapDays.length, profile.away_day_deficit_kcal, gapDays.join(', ')));
  }
  if (!data.length) console.error(L.warn_no_weighin);
  const outDir = path.join(root, 'charts');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'chart-cdn.html'), html(L, profile.language, data));
  return { data, gapDays, L };
}

function main(argv) {
  const opts = parseArgs(argv, { usage: USAGE });
  const { L } = generate(opts.root);
  console.log(L.wrote('charts/chart-cdn.html'));
}

module.exports = { chartData, generate };

if (require.main === module) runMain(main);
