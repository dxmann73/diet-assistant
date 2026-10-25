#!/usr/bin/env node
// Validate profile.json, habits.json and rules.md, then print the targets at
// start_weight_kg with full working. Onboarding ends only when this passes.
//
// Throws on: unknown or missing profile keys, out-of-range values, the safety
// gate (age under 18, BMI under 18.5 at start_weight_kg), habits aliases that
// do not resolve, daily defaults that do not parse.
//
// usage: node scripts/check-profile.js [--root <dir>]

const fs = require('fs');
const path = require('path');
const { parseArgs, runMain, today, fmt } = require('./lib/util');
const { labelsFor } = require('./lib/labels');
const { loadItems } = require('./lib/data');
const { loadProfile, loadHabits, targets, targetLines } = require('./lib/profile');

const USAGE = 'node scripts/check-profile.js [--root <dir>]';

function checkProfile(root, date = today()) {
  const year = Number(date.slice(0, 4));
  const profile = loadProfile(root, year);
  const L = labelsFor(profile.language);
  const items = loadItems(root, L);
  loadHabits(root, items, L);
  if (!fs.existsSync(path.join(root, 'rules.md'))) {
    throw new Error(`rules.md not found under ${root}; create it from templates/rules.template.md`);
  }
  const t = targets(profile, profile.start_weight_kg, year);
  const lines = [
    L.profile_ok,
    '',
    `- ${L.weight}: ${fmt(profile.start_weight_kg)} kg (${L.start_weight_note})`,
    ...targetLines(L, profile, t),
  ];
  return { text: lines.join('\n'), targets: t };
}

function main(argv) {
  const opts = parseArgs(argv, { usage: USAGE });
  console.log(checkProfile(opts.root).text);
}

module.exports = { checkProfile };

if (require.main === module) runMain(main);
