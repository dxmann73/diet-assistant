#!/usr/bin/env node
// Parse protocols/*.md and extract the chart inputs from each file's
// frontmatter. Frontmatter is the ONLY source: the body is for humans and is
// never scraped. See AGENTS.md "Metrics block" for the required shape.
//
// Fail fast: a malformed or missing block throws. A silently skipped day would
// leave the theoretical weight line frozen with no indication.
//
// usage: node scripts/extract-data.js [--root <dir>]

const { parseArgs, runMain } = require('./lib/util');
const { readProtocol, protocolFiles } = require('./lib/frontmatter');

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

  // Sanity check, not a silent correction: flag magnitudes that almost always
  // mean a bad number was copied into the block.
  const wild = rows
    .filter((r) => Math.abs(r.deficit_kcal) > 1500)
    .map((r) => `${r.date}=${r.deficit_kcal}`);
  if (wild.length) {
    console.error(`WARN: implausible deficit(s), verify the block: ${wild.join(', ')}`);
  }
  return rows;
}

function main(argv) {
  const opts = parseArgs(argv, { usage: USAGE });
  console.log(JSON.stringify(extract(opts.root), null, 2));
}

module.exports = { extract };

if (require.main === module) runMain(main);
