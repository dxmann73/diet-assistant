#!/usr/bin/env node
// Parse protocols/*.md and extract the chart inputs from each file's
// frontmatter. Frontmatter is the ONLY source: the body is for humans and is
// never scraped. See AGENTS.md "Metrics block" for the required shape.
//
// Fail fast: a malformed or missing block throws. A silently skipped day would
// leave the theoretical weight line frozen with no indication.
//
// usage: node scripts/extract-data.js [--root <dir>]

const { parseArgs, runMain, today } = require('./lib/util');
const { readProtocol, protocolFiles } = require('./lib/frontmatter');
const { profileLabels } = require('./lib/profile');

const USAGE = 'node scripts/extract-data.js [--root <dir>]';

function extract(root) {
  const rows = protocolFiles(root).map((f) => {
    const p = readProtocol(f, { strict: true });
    return {
      date: p.date,
      weight_kg: p.weight_kg,
      status: p.metrics.status,
      maintenance_kcal: p.metrics.maintenance_kcal,
      deficit_kcal: p.metrics.deficit_kcal,
      intake_kcal: p.metrics.intake_kcal,
      burn_kcal: p.metrics.burn_kcal,
      net_intake_kcal: p.metrics.net_intake_kcal,
    };
  });
  return rows;
}

// Sanity check, not a silent correction: magnitudes that almost always mean a
// bad number was copied into the block. Callers print the localized warning.
function implausible(rows) {
  return rows.filter((r) => Math.abs(r.deficit_kcal) > 1500).map((r) => `${r.date}=${r.deficit_kcal}`);
}

function main(argv) {
  const opts = parseArgs(argv, { usage: USAGE });
  const L = profileLabels(opts.root, Number(today().slice(0, 4)));
  const rows = extract(opts.root);
  const wild = implausible(rows);
  if (wild.length) console.error(L.warn_implausible(wild.join(', ')));
  console.log(JSON.stringify(rows, null, 2));
}

module.exports = { extract, implausible };

if (require.main === module) runMain(main);
