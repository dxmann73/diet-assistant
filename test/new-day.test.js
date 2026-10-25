'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { newDay } = require('../scripts/new-day');
const { compute } = require('../scripts/compute-day');
const { enRoot, deRoot } = require('./helpers');

test('writes the daily defaults sorted by time, and the day computes', () => {
  const root = enRoot();
  const file = newDay(root, '2030-01-15');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^date: 2030-01-15$/m);
  assert.match(
    text,
    /## Food\n\n- 08:00 example 1 serving {2}# breakfast\n\n## Exercise\n\n- 07:00 walking 10min {2}# morning walk\n- 19:30 walking 30min {2}# evening walk\n\n## Computed\n/
  );
  // 3.0 × 80 × 40/60 = 160.
  assert.equal(compute(root, '2030-01-15').block.burn_kcal, 160);
});

test('refuses to overwrite', () => {
  const root = enRoot();
  newDay(root, '2030-01-15');
  assert.throws(() => newDay(root, '2030-01-15'), /already exists; not overwriting/);
});

test('German template with no defaults: empty sections, German headings', () => {
  const root = deRoot();
  const text = fs.readFileSync(newDay(root, '2030-01-15'), 'utf8');
  assert.match(text, /## Essen\n\n## Sport\n\n## Berechnet\n/);
  assert.equal(compute(root, '2030-01-15').block.intake_kcal, 0);
});

test('a template in the wrong language throws', () => {
  const root = deRoot();
  const path = require('path');
  fs.copyFileSync(
    path.join(__dirname, '..', 'templates', 'protocol.template.md'),
    path.join(root, 'templates', 'protocol.template.md')
  );
  assert.throws(() => newDay(root, '2030-01-15'), /missing "## Essen" for language de/);
});
