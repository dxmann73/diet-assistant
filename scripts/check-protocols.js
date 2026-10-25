#!/usr/bin/env node
// Cross-check each protocol's frontmatter `metrics:` block against the figures
// in its computed body section.
//
// The chart reads only the block, so a block left stale while the body was
// updated is invisible: the chart silently plots the old day. The computed
// body is script output with a fixed format, so on `closed` and `open` days
// every block figure must be found there exactly once and must agree.
// `estimated` days need only the block.
//
// usage: node scripts/check-protocols.js [--root <dir>]

const { parseArgs, runMain, today } = require('./lib/util');
const { labelsFor } = require('./lib/labels');
const { readProtocol, protocolFiles, METRIC_KEYS } = require('./lib/frontmatter');
const { loadProfile } = require('./lib/profile');

const USAGE = 'node scripts/check-protocols.js [--root <dir>]';
const TOLERANCE = 0.01; // kcal: guards float formatting, not real edits

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function computedSection(body, L, name) {
  const re = new RegExp(`^## ${escapeRe(L.computed_heading)}\\s*$`, 'm');
  const m = body.match(re);
  if (!m) throw new Error(`${name}: no "## ${L.computed_heading}" section`);
  return body.slice(m.index);
}

function check(root) {
  const profile = loadProfile(root, Number(today().slice(0, 4)));
  const L = labelsFor(profile.language);
  const labelFor = {
    maintenance_kcal: L.maintenance,
    deficit_kcal: L.deficit,
    intake_kcal: L.intake,
    burn_kcal: L.burn,
    net_intake_kcal: L.net_intake,
  };
  const problems = [];
  let checked = 0;

  for (const file of protocolFiles(root)) {
    let p;
    try {
      p = readProtocol(file, { strict: true });
    } catch (err) {
      problems.push(err.message);
      continue;
    }
    checked += 1;
    if (p.metrics.status === 'estimated') continue;

    let section;
    try {
      section = computedSection(p.body, L, p.name);
    } catch (err) {
      problems.push(err.message);
      continue;
    }

    const statusHits = [...section.matchAll(new RegExp(`^- ${escapeRe(L.status)}: (\\S+)\\s*$`, 'gm'))];
    if (statusHits.length !== 1) {
      problems.push(`${p.name}: expected one "- ${L.status}:" line in the computed section, found ${statusHits.length}`);
    } else if (statusHits[0][1] !== p.metrics.status) {
      problems.push(
        `${p.name}: block status is ${p.metrics.status}, computed section says ${statusHits[0][1]}; ` +
          're-run compute-day.js'
      );
    }

    for (const key of METRIC_KEYS) {
      const re = new RegExp(`^- ${escapeRe(labelFor[key])}: (-?\\d+(?:\\.\\d+)?) kcal(?:\\s|$)`, 'gm');
      const hits = [...section.matchAll(re)];
      if (hits.length !== 1) {
        problems.push(`${p.name}: expected one "- ${labelFor[key]}: <n> kcal" line, found ${hits.length}`);
        continue;
      }
      const bodyVal = parseFloat(hits[0][1]);
      const blockVal = p.metrics[key];
      if (blockVal === null) {
        problems.push(`${p.name}: body says ${key} ${bodyVal}, block says null`);
      } else if (Math.abs(blockVal - bodyVal) > TOLERANCE) {
        problems.push(`${p.name}: ${key} block ${blockVal} vs body ${bodyVal}`);
      }
    }
  }
  return { problems, checked };
}

function main(argv) {
  const opts = parseArgs(argv, { usage: USAGE });
  const { problems, checked } = check(opts.root);
  if (problems.length) {
    console.error(`FAIL: ${problems.length} problem(s) in ${checked} protocols:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`OK: ${checked} protocols, frontmatter matches body`);
}

module.exports = { check };

if (require.main === module) runMain(main);
