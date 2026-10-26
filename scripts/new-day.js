#!/usr/bin/env node
// Create protocols/<date>.md from templates/protocol.template.md with every
// habits.json daily default written out and weight_kg: null. Refuses to
// overwrite. Later edits to the defaults never touch existing days.
//
// usage: node scripts/new-day.js <YYYY-MM-DD> [--root <dir>]

const fs = require('fs');
const path = require('path');
const { parseArgs, runMain, checkDate } = require('./lib/util');
const { labelsFor } = require('./lib/labels');
const { loadItems } = require('./lib/data');
const { loadProfile, loadHabits, profileLabels } = require('./lib/profile');

const USAGE = 'node scripts/new-day.js <YYYY-MM-DD> [--root <dir>]';
const PLACEHOLDERS = ['{{date}}', '{{food_lines}}', '{{exercise_lines}}'];

function newDay(root, date) {
  checkDate(date);
  const profile = loadProfile(root, Number(date.slice(0, 4)));
  const L = labelsFor(profile.language);
  const habits = loadHabits(root, loadItems(root, L), L);

  const out = path.join(root, 'protocols', `${date}.md`);
  if (fs.existsSync(out)) throw new Error(`protocols/${date}.md already exists; not overwriting`);

  const templateFile = path.join(root, 'templates', 'protocol.template.md');
  if (!fs.existsSync(templateFile)) throw new Error('templates/protocol.template.md not found');
  let text = fs.readFileSync(templateFile, 'utf8');
  for (const ph of PLACEHOLDERS) {
    if (!text.includes(ph)) throw new Error(`templates/protocol.template.md lacks ${ph}`);
  }

  // Sorted by clock time so the day reads chronologically.
  const lines = (section) =>
    habits.daily_defaults
      .filter((d) => d.section === section)
      .map((d) => d.line)
      .sort((a, b) => a.slice(2, 7).localeCompare(b.slice(2, 7)))
      .join('\n');
  // An empty section drops the placeholder and its blank line.
  const fill = (ph, body) => (body ? text.replace(ph, body) : text.replace(`${ph}\n\n`, ''));
  text = text.replaceAll('{{date}}', date);
  text = fill('{{food_lines}}', lines('food'));
  text = fill('{{exercise_lines}}', lines('exercise'));
  if (/\{\{[a-z_]+\}\}/.test(text)) {
    throw new Error('templates/protocol.template.md: a placeholder was left unfilled');
  }

  // Headings must be the profile language's tokens or compute-day.js cannot parse the day.
  for (const heading of [L.food_heading, L.exercise_heading, L.computed_heading]) {
    if (!new RegExp(`^## ${heading}$`, 'm').test(text)) {
      throw new Error(`templates/protocol.template.md: missing "## ${heading}" for language ${profile.language}`);
    }
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  return out;
}

function main(argv) {
  const opts = parseArgs(argv, { positional: ['date'], usage: USAGE });
  newDay(opts.root, opts.date);
  console.log(profileLabels(opts.root, Number(opts.date.slice(0, 4))).wrote(`protocols/${opts.date}.md`));
}

module.exports = { newDay };

if (require.main === module) runMain(main);
