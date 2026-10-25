'use strict';
// Shared test helpers: build a throwaway repo root from fixtures, write
// protocols, and paste compute-day.js output the way the agent does.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { compute } = require('../scripts/compute-day');
const { LABELS } = require('../scripts/lib/labels');

const REPO = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

// A fresh temp dir with each source dir copied in, later sources winning.
function makeRoot(...sources) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diet-assistant-test-'));
  for (const src of sources) fs.cpSync(src, root, { recursive: true });
  return root;
}

// The shipped starter data plus a fixture user.
function enRoot() {
  const root = makeRoot(path.join(FIXTURES, 'en-user'));
  for (const dir of ['foods', 'recipes', 'templates']) {
    fs.cpSync(path.join(REPO, dir), path.join(root, dir), { recursive: true });
  }
  return root;
}

// The small German fixture set plus a German fixture user.
function deRoot() {
  return makeRoot(path.join(FIXTURES, 'i18n', 'de'), path.join(FIXTURES, 'de-user'));
}

// The small English set with the small German set under i18n/de, as a fresh clone has it.
function i18nRoot() {
  const root = makeRoot(path.join(FIXTURES, 'i18n', 'en'));
  fs.cpSync(path.join(FIXTURES, 'i18n', 'de'), path.join(root, 'i18n', 'de'), { recursive: true });
  return root;
}

function writeProtocol(root, date, opts = {}) {
  const { weight = null, status = 'open', food = [], exercise = [], language = 'en' } = opts;
  const L = LABELS[language];
  const m = { maintenance_kcal: null, deficit_kcal: null, ...opts.metrics };
  const text = [
    '---',
    `date: ${date}`,
    `weight_kg: ${weight === null ? 'null' : weight}`,
    'metrics:',
    `  status: ${status}`,
    `  maintenance_kcal: ${m.maintenance_kcal === null ? 'null' : m.maintenance_kcal}`,
    `  deficit_kcal: ${m.deficit_kcal === null ? 'null' : m.deficit_kcal}`,
    '  intake_kcal: null',
    '  burn_kcal: null',
    '  net_intake_kcal: null',
    '---',
    '',
    `## ${L.food_heading}`,
    '',
    ...food,
    ...(food.length ? [''] : []),
    `## ${L.exercise_heading}`,
    '',
    ...exercise,
    ...(exercise.length ? [''] : []),
    `## ${L.computed_heading}`,
    '',
    'Not computed yet.',
    '',
  ].join('\n');
  const file = path.join(root, 'protocols', `${date}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

// Run compute-day and paste both parts into the protocol, like the agent does.
function computeAndPaste(root, date, language = 'en') {
  const L = LABELS[language];
  const file = path.join(root, 'protocols', `${date}.md`);
  const result = compute(root, date);
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/^metrics:\n(?: {2}.*\n)+/m, `${result.blockText}\n`);
  const at = text.indexOf(`\n## ${L.computed_heading}\n`);
  if (at < 0) throw new Error('test helper: no computed heading');
  text = `${text.slice(0, at + 1)}${result.bodyText}\n`;
  fs.writeFileSync(file, text);
  return result;
}

module.exports = { REPO, FIXTURES, makeRoot, enRoot, deRoot, i18nRoot, writeProtocol, computeAndPaste };
