'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check } = require('../scripts/check-protocols');
const { extract } = require('../scripts/extract-data');
const { generate, chartData } = require('../scripts/gen-chart-cdn');
const { enRoot, deRoot, writeProtocol, computeAndPaste } = require('./helpers');

function day(root, date, weight) {
  writeProtocol(root, date, {
    weight,
    status: 'closed',
    food: ['- 08:00 example 4 serving  # oats'],
    exercise: ['- 18:00 gym 60min  # gym'],
  });
  return computeAndPaste(root, date);
}

test('check-protocols passes after a verbatim paste', () => {
  const root = enRoot();
  day(root, '2030-01-15', 80.0);
  writeProtocol(root, '2030-01-16', { status: 'estimated', metrics: { deficit_kcal: 300 } });
  computeAndPaste(root, '2030-01-16');
  assert.deepEqual(check(root), { problems: [], checked: 2 });
});

test('check-protocols catches a block edited by hand', () => {
  const root = enRoot();
  day(root, '2030-01-15', 80.0);
  const file = path.join(root, 'protocols', '2030-01-15.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/deficit_kcal: [\d.-]+/, 'deficit_kcal: 123.45'));
  const { problems } = check(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /deficit_kcal block 123\.45 vs body/);
});

test('check-protocols catches a stale status', () => {
  const root = enRoot();
  day(root, '2030-01-15', 80.0);
  const file = path.join(root, 'protocols', '2030-01-15.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('  status: closed', '  status: open'));
  assert.match(check(root).problems[0], /block status is open, computed section says closed/);
});

test('a null deficit throws in extract-data and fails check-protocols', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { weight: 80.0, metrics: { maintenance_kcal: 2016 } });
  assert.throws(() => extract(root), /metrics\.deficit_kcal is null/);
  assert.match(check(root).problems[0], /metrics\.deficit_kcal is null/);
});

test('extract-data rejects units, unknown keys and misnamed files', () => {
  const root = enRoot();
  const file = writeProtocol(root, '2030-01-15', { metrics: { maintenance_kcal: 2016, deficit_kcal: 300 } });
  const good = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, good.replace('deficit_kcal: 300', 'deficit_kcal: 300 kcal'));
  assert.throws(() => extract(root), /must be a bare number or null/);
  fs.writeFileSync(file, good.replace('  status: open', '  status: open\n  mood: 3'));
  assert.throws(() => extract(root), /unknown key metrics\.mood/);
  fs.writeFileSync(file, good);
  fs.writeFileSync(path.join(root, 'protocols', 'notes.md'), '# notes\n');
  assert.throws(() => extract(root), /must be named YYYY-MM-DD\.md/);
});

test('a surplus is a negative deficit; U+2212 is read as minus', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { metrics: { maintenance_kcal: 2016, deficit_kcal: '−317.51' } });
  assert.equal(extract(root)[0].deficit_kcal, -317.51);
});

test('chart: gap days at the away-day deficit, theoretical line from the first weigh-in', () => {
  const rows = [
    { date: '2030-01-01', weight_kg: null, status: 'closed', deficit_kcal: 500 },
    { date: '2030-01-02', weight_kg: 80.0, status: 'closed', deficit_kcal: 770 },
    { date: '2030-01-04', weight_kg: 79.8, status: 'open', deficit_kcal: 0 },
  ];
  const { data, gapDays } = chartData(rows, 200);
  assert.deepEqual(gapDays, ['2030-01-03']);
  // 01-01 has no weigh-in and comes before the anchor, so it is dropped.
  assert.deepEqual(
    data.map((r) => [r.date, r.theoretical_weight]),
    [
      ['2030-01-02', 80],
      ['2030-01-03', 79.9],
      ['2030-01-04', 79.87],
    ]
  );
});

test('chart: writes the html in the profile language; no protocols throws', () => {
  const en = enRoot();
  assert.throws(() => generate(en), /no protocols yet/);
  day(en, '2030-01-15', 80.0);
  generate(en);
  const html = fs.readFileSync(path.join(en, 'charts', 'chart-cdn.html'), 'utf8');
  assert.match(html, /<html lang="en">/);

  const de = deRoot();
  writeProtocol(de, '2030-01-15', { language: 'de', weight: 70.0, status: 'closed' });
  computeAndPaste(de, '2030-01-15', 'de');
  assert.deepEqual(check(de).problems, []);
  generate(de);
  const htmlDe = fs.readFileSync(path.join(de, 'charts', 'chart-cdn.html'), 'utf8');
  assert.match(htmlDe, /<html lang="de">/);
  assert.match(htmlDe, /Tatsächliches Gewicht/);
});
