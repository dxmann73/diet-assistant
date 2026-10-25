'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { checkProfile } = require('../scripts/check-profile');
const { enRoot, deRoot } = require('./helpers');

function edit(root, file, change) {
  const p = path.join(root, file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  change(json);
  fs.writeFileSync(p, JSON.stringify(json, null, 2));
}

test('valid profile prints the targets with working', () => {
  const { text, targets } = checkProfile(enRoot(), '2030-06-01');
  assert.match(text, /^OK: profile\.json, habits\.json and rules\.md are valid\./);
  assert.equal(targets.bmr, 1680);
  assert.equal(targets.maintenance, 2016);
  assert.equal(targets.floor, 1516);
  assert.match(text, /10 × 80\.00 \+ 6\.25 × 180 − 5 × 50 \+ 5 = 1680\.00 kcal/);
});

test('German profile prints German labels', () => {
  const { text, targets } = checkProfile(deRoot(), '2030-06-01');
  assert.equal(targets.bmr, 1389);
  assert.match(text, /^OK: profile\.json, habits\.json und rules\.md sind gültig\./);
});

test('bad profile keys and values throw', () => {
  const cases = [
    [(p) => (p.weight = 80), /unknown key "weight"/],
    [(p) => delete p.height_cm, /missing key height_cm/],
    [(p) => (p.sex = 'm'), /sex must be female\|male/],
    [(p) => (p.language = 'fr'), /language must be one of en\|de/],
    [(p) => (p.activity_factor = 1.3), /activity_factor must be one of/],
    [(p) => (p.height_cm = '180'), /height_cm must be a positive number/],
    [(p) => (p.protein_floor_g_per_kg = 1.4), /floor <= target <= top/],
  ];
  for (const [change, re] of cases) {
    const root = enRoot();
    edit(root, 'profile.json', change);
    assert.throws(() => checkProfile(root, '2030-06-01'), re);
  }
});

test('safety gate: under 18 and BMI under 18.5 throw', () => {
  const young = enRoot();
  edit(young, 'profile.json', (p) => (p.birth_year = 2013));
  assert.throws(() => checkProfile(young, '2030-06-01'), /age 17 is under 18/);
  const light = enRoot();
  // 59.0 kg at 1.80 m is a BMI of 18.2.
  edit(light, 'profile.json', (p) => (p.start_weight_kg = 59.0));
  assert.throws(() => checkProfile(light, '2030-06-01'), /BMI 18\.2 at start_weight_kg is under 18\.5/);
});

test('habits: unknown alias id, unit mismatch, bad default line', () => {
  const cases = [
    [(h) => (h.aliases.pizza = { id: 'pizza' }), /id "pizza" is not a food or recipe/],
    [(h) => (h.aliases.banana = { id: 'banana', amount: 1, unit: 'pc' }), /banana is logged in g/],
    [(h) => (h.aliases.banana = { id: 'banana', amount: 90 }), /amount and unit together/],
    [(h) => h.daily_defaults.push({ section: 'food', line: '- 09:00 pizza 1 serving' }), /unknown food/],
    [(h) => h.daily_defaults.push({ section: 'exercise', line: '- 09:00 surfing 30min' }), /unknown activity/],
    [(h) => h.daily_defaults.push({ section: 'drinks', line: '- 09:00 banana 90g' }), /section must be food\|exercise/],
    [(h) => (h.activities['Gym Class'] = { met: 4 }), /activity id must match/],
    [(h) => delete h.aliases, /missing key aliases/],
  ];
  for (const [change, re] of cases) {
    const root = enRoot();
    edit(root, 'habits.json', change);
    assert.throws(() => checkProfile(root, '2030-06-01'), re);
  }
});

test('missing rules.md throws', () => {
  const root = enRoot();
  fs.rmSync(path.join(root, 'rules.md'));
  assert.throws(() => checkProfile(root, '2030-06-01'), /rules\.md not found/);
});

test('foods: duplicate id and food/recipe id collision throw', () => {
  const dup = enRoot();
  const foods = path.join(dup, 'foods', 'foods.md');
  const text = fs.readFileSync(foods, 'utf8');
  const bananaRow = text.split('\n').find((l) => l.startsWith('| banana |'));
  fs.writeFileSync(foods, text.replace(bananaRow, `${bananaRow}\n${bananaRow}`));
  assert.throws(() => checkProfile(dup, '2030-06-01'), /duplicate id banana/);

  const clash = enRoot();
  fs.copyFileSync(path.join(clash, 'recipes', 'example.md'), path.join(clash, 'recipes', 'banana.md'));
  const r = path.join(clash, 'recipes', 'banana.md');
  fs.writeFileSync(r, fs.readFileSync(r, 'utf8').replace('id: example', 'id: banana'));
  assert.throws(() => checkProfile(clash, '2030-06-01'), /id banana is both a food and a recipe/);
});
