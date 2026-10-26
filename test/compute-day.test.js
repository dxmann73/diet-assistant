'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compute } = require('../scripts/compute-day');
const { enRoot, deRoot, writeProtocol } = require('./helpers');

// Expected values below are worked out by hand from foods/foods.md and
// recipes/example.md, not taken from the script.
// Fixture user: male, born 1980, 180 cm, factor 1.2, cap 500. In 2030 the age is 50.
// At 80.0 kg: BMR 10 × 80 + 6.25 × 180 − 5 × 50 + 5 = 1680; maintenance 2016; floor 1516.

test('flagged day: per-item intake, burn, deficit and all three flags', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', {
    weight: 80.0,
    status: 'closed',
    food: ['- 08:00 example 1 serving  # oats', '- 12:30 banana 90g  # a banana'],
    exercise: ['- 07:00 walking 10min  # walk', '- 18:00 gym 60min  # gym'],
  });
  const { block, bodyText } = compute(root, '2030-01-15');
  // example 369.00 + banana 0.9 × 79 = 71.10 → 440.10; walk 3.0 × 80 × 10/60 = 40, gym 3.5 × 80 = 280.
  assert.deepEqual(block, {
    status: 'closed',
    maintenance_kcal: 2016,
    deficit_kcal: 1895.9,
    intake_kcal: 440.1,
    burn_kcal: 320,
    net_intake_kcal: 120.1,
  });
  assert.match(bodyText, /^## Computed$/m);
  assert.match(bodyText, /- weight: 80\.00 kg \(today's weigh-in\)/);
  assert.match(bodyText, /= 1680\.00 kcal/);
  assert.match(bodyText, /\| 12:30 \| banana \| 90 g \| 0\.9 × per 100 g \| 71\.10 \| 1\.17 \| 0\.36 \| 14\.31 \|/);
  assert.match(bodyText, /3\.5 × 80\.00 kg × 60\/60 h \| 280\.00 \|/);
  assert.match(bodyText, /- intake: 440\.10 kcal/);
  // Burn lifts the floor above BMR: max(1680, 1516 + 320) = 1836.
  assert.match(bodyText, /intake floor today: max\(BMR 1680\.00, 1516\.00 \+ 320\.00 burn\) = 1836\.00 kcal/);
  assert.match(bodyText, /protein 19\.17 g is below the floor of 80\.00 g/i);
  assert.match(bodyText, /intake 440\.10 kcal is below the BMR of 1680\.00 kcal/i);
  assert.match(bodyText, /deficit 1895\.90 kcal is above the cap of 500 kcal/i);
  assert.doesNotMatch(bodyText, /day still open/);
});

test('BMR flag on its own: deficit within the cap, intake below BMR', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', {
    weight: 80.0,
    status: 'closed',
    food: ['- 08:00 example 4 serving  # oats', '- 13:00 tofu 100g  # tofu'],
  });
  const { block, bodyText } = compute(root, '2030-01-15');
  // 1476 + 115 = 1591 < BMR 1680; deficit 2016 − 1591 = 425, under the cap; protein 72 + 15.5 = 87.5.
  assert.equal(block.deficit_kcal, 425);
  assert.match(bodyText, /intake floor today: max\(BMR 1680\.00, 1516\.00 \+ 0\.00 burn\) = 1680\.00 kcal/);
  assert.match(bodyText, /### Flags\n\n- intake 1591\.00 kcal is below the BMR of 1680\.00 kcal\n\n/);
});

test('open day: one info line instead of the protein, deficit and BMR flags', () => {
  const root = enRoot();
  const food = ['- 08:00 example 1 serving  # oats', '- 12:30 banana 90g  # a banana'];
  const exercise = ['- 07:00 walking 10min  # walk', '- 18:00 gym 60min  # gym'];
  writeProtocol(root, '2030-01-15', { weight: 80.0, food, exercise });
  const both = compute(root, '2030-01-15').bodyText;
  // 1836 − 440.10 = 1395.90 kcal; 80 − 19.17 = 60.83 g.
  assert.match(
    both,
    /### Flags\n\n- day still open, still to go: 1395\.90 kcal to the intake floor, 60\.83 g protein to the floor\n\n/
  );
  assert.doesNotMatch(both, /is below the|is above the cap/);

  // Protein reached: only the kcal part is left. 1796 − 1706 = 90.
  writeProtocol(root, '2030-01-15', {
    weight: 80.0,
    food: ['- 08:00 example 4 serving  # oats', '- 13:00 tofu 200g  # tofu'],
    exercise: ['- 18:00 gym 60min  # gym'],
  });
  assert.match(
    compute(root, '2030-01-15').bodyText,
    /### Flags\n\n- day still open, still to go: 90\.00 kcal to the intake floor\n\n/
  );

  // Both floors reached.
  writeProtocol(root, '2030-01-15', {
    weight: 80.0,
    food: ['- 08:00 example 4 serving  # oats', '- 13:00 tofu 200g  # tofu'],
  });
  assert.match(compute(root, '2030-01-15').bodyText, /### Flags\n\n- day still open, still to go: none\n\n/);
});

test('open day keeps the stall flag', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-01', { weight: 80.0 });
  writeProtocol(root, '2030-01-22', { weight: 80.5 });
  const body = compute(root, '2030-01-22').bodyText;
  assert.match(body, /- day still open, still to go: .*\n- weight stall: /);
});

test('clean day: no flags, macro deltas against target', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', {
    weight: 80.0,
    status: 'closed',
    food: ['- 08:00 example 4 serving  # oats', '- 13:00 tofu 200g  # tofu'],
  });
  const { block, bodyText } = compute(root, '2030-01-15');
  // 4 × 369 = 1476 + 2 × 115 = 230 → 1706; protein 72 + 31 = 103.
  assert.equal(block.intake_kcal, 1706);
  assert.equal(block.burn_kcal, 0);
  assert.equal(block.deficit_kcal, 310);
  // Target 1.25 × 80 = 100; fat 0.8 × 80 = 64; carbs (2016 − 400 − 576) / 4 = 260.
  assert.match(bodyText, /- protein: 103\.00 g \(floor 80\.00, target 100\.00, top 120\.00; vs target \+3\.00\)/);
  assert.match(bodyText, /- fat: 42\.20 g \(target 64\.00; vs target -21\.80\)/);
  assert.match(bodyText, /- carbs: 205\.00 g \(target 260\.00; vs target -55\.00\)/);
  assert.match(bodyText, /### Flags\n\n- none\n/);
});

test('estimated day uses the block deficit, else the away-day default', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { status: 'estimated', metrics: { deficit_kcal: 350 } });
  writeProtocol(root, '2030-01-16', { status: 'estimated' });
  const a = compute(root, '2030-01-15');
  assert.equal(a.block.deficit_kcal, 350);
  assert.equal(a.block.intake_kcal, null);
  const b = compute(root, '2030-01-16');
  assert.equal(b.block.deficit_kcal, 200);
  assert.match(b.bodyText, /away_day_deficit_kcal from profile\.json/);
});

test('weight source: start weight, last weigh-in, today, 7-day mean', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', {});
  assert.match(compute(root, '2030-01-15').bodyText, /- weight: 80\.00 kg \(start_weight_kg/);

  writeProtocol(root, '2030-01-01', { weight: 81.5 });
  assert.match(compute(root, '2030-01-15').bodyText, /- weight: 81\.50 kg \(most recent weigh-in, 2030-01-01\)/);

  writeProtocol(root, '2030-01-13', { weight: 80.0 });
  assert.match(compute(root, '2030-01-15').bodyText, /- weight: 80\.00 kg \(most recent weigh-in, 2030-01-13\)/);

  writeProtocol(root, '2030-01-15', { weight: 79.0 });
  const { bodyText } = compute(root, '2030-01-15');
  assert.match(bodyText, /- weight: 79\.50 kg \(mean of 2 weigh-ins, 2030-01-13 to 2030-01-15\)/);
  // Maintenance follows the mean: 10 × 79.5 + 1125 − 250 + 5 = 1675; × 1.2 = 2010.
  assert.equal(compute(root, '2030-01-15').block.maintenance_kcal, 2010);
});

test('weight source: a single weigh-in today', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { weight: 79.3 });
  assert.match(compute(root, '2030-01-15').bodyText, /- weight: 79\.30 kg \(today's weigh-in\)/);
});

test('stall flag: 7-day mean not below the one three weeks earlier', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-01', { weight: 80.0 });
  writeProtocol(root, '2030-01-22', { weight: 80.5 });
  const stalled = compute(root, '2030-01-22').bodyText;
  assert.match(stalled, /weight stall: 7-day mean 80\.50 kg is not below 80\.00 kg/i);
  assert.match(stalled, /- stall check: stall/i);

  writeProtocol(root, '2030-01-22', { weight: 79.0 });
  const fine = compute(root, '2030-01-22').bodyText;
  assert.doesNotMatch(fine, /weight stall/i);
  assert.match(fine, /- stall check: no stall/i);
});

test('stall check is skipped without weigh-ins three weeks back', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { weight: 80.0 });
  assert.match(compute(root, '2030-01-15').bodyText, /- stall check: skipped/i);
});

test('throws on an unknown food', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { food: ['- 12:00 pizza 300g  # pizza'] });
  assert.throws(() => compute(root, '2030-01-15'), /2030-01-15\.md line 15: unknown food or recipe id "pizza"/);
});

test('throws on a unit that does not match the basis', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { food: ['- 12:00 banana 1 serving  # banana'] });
  assert.throws(() => compute(root, '2030-01-15'), /banana is logged in g \(basis 100g\), got unit "serving"/);
  writeProtocol(root, '2030-01-15', { food: ['- 12:00 example 200g  # oats'] });
  assert.throws(() => compute(root, '2030-01-15'), /example is logged in serving/);
});

test('throws on an unknown activity', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-15', { exercise: ['- 10:00 surfing 60min  # surf'] });
  assert.throws(() => compute(root, '2030-01-15'), /unknown activity "surfing"/);
});

test('throws on malformed lines', () => {
  const root = enRoot();
  for (const line of ['- noon banana 90g', '- 12:00 banana a handful', 'banana 90g', '- 25:00 banana 90g']) {
    writeProtocol(root, '2030-01-15', { food: [line] });
    assert.throws(() => compute(root, '2030-01-15'), /malformed food line|invalid time/, line);
  }
  writeProtocol(root, '2030-01-15', { exercise: ['- 18:00 gym 5km'] });
  assert.throws(() => compute(root, '2030-01-15'), /malformed exercise line/);
});

test('throws on a missing protocol, section or bad date', () => {
  const root = enRoot();
  assert.throws(() => compute(root, '2030-01-15'), /protocols\/2030-01-15\.md not found/);
  writeProtocol(root, '2030-01-15', {});
  assert.throws(() => compute(root, '2030-02-30'), /not a calendar date/);
  const fs = require('fs');
  const path = require('path');
  const file = path.join(root, 'protocols', '2030-01-15.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('## Exercise\n', ''));
  assert.throws(() => compute(root, '2030-01-15'), /missing section "## Exercise"/);
});

test('German: German ids, units, headings and labels', () => {
  // Fixture user: female, born 1990, 168 cm, 70.0 kg, no weigh-in. In 2030 the age is 40.
  // BMR 700 + 1050 − 200 − 161 = 1389; maintenance 1666.80.
  const root = deRoot();
  writeProtocol(root, '2030-01-15', {
    language: 'de',
    food: [
      '- 08:00 rezept_beispiel 1 Portion  # Haferflocken',
      '- 10:00 ei 2 Stk  # zwei Eier',
      '- 12:30 banane 90g  # eine Banane',
    ],
    exercise: ['- 18:00 krafttraining 30min  # Krafttraining'],
  });
  const { block, bodyText } = compute(root, '2030-01-15');
  // 253.00 + 2 × 81 = 162.00 + 71.10 = 486.10; burn 3.5 × 70 × 0.5 = 122.50.
  assert.deepEqual(block, {
    status: 'open',
    maintenance_kcal: 1666.8,
    deficit_kcal: 1303.2,
    intake_kcal: 486.1,
    burn_kcal: 122.5,
    net_intake_kcal: 363.6,
  });
  assert.match(bodyText, /^## Berechnet$/m);
  assert.match(bodyText, /- Gewicht: 70\.00 kg \(start_weight_kg aus profile\.json/);
  assert.match(bodyText, /\| 10:00 \| ei \| 2 Stk \| 2 × pro Stück \| 162\.00 \|/);
  assert.match(bodyText, /- Aufnahme: 486\.10 kcal/);
  assert.match(bodyText, /- Defizit: 1303\.20 kcal/);
  assert.match(bodyText, /Grundumsatz \(Mifflin-St Jeor, weiblich\)/);
  // max(1389, 1166.80 + 122.50 = 1289.30) = 1389; 1389 − 486.10 = 902.90.
  assert.match(
    bodyText,
    /Untergrenze Aufnahme heute: max\(Grundumsatz 1389\.00, 1166\.80 \+ 122\.50 Verbrauch\) = 1389\.00 kcal/
  );
  assert.match(bodyText, /- Tag noch offen, es fehlen noch: 902\.90 kcal bis zur Untergrenze Aufnahme, [\d.]+ g Eiweiß/);
});

test('German: closed-day flags and an open day with nothing left', () => {
  const root = deRoot();
  writeProtocol(root, '2030-01-15', { language: 'de', status: 'closed' });
  const closed = compute(root, '2030-01-15').bodyText;
  assert.match(closed, /- Eiweiß 0\.00 g liegt unter der Untergrenze von 70\.00 g/);
  assert.match(closed, /- Aufnahme 0\.00 kcal liegt unter dem Grundumsatz von 1389\.00 kcal/);
  assert.match(closed, /- Defizit 1666\.80 kcal liegt über der Obergrenze von 500 kcal/);

  // 9 × 253 = 2277 kcal, 9 × 7.90 = 71.10 g: both floors reached.
  writeProtocol(root, '2030-01-16', {
    language: 'de',
    food: ['- 08:00 rezept_beispiel 9 Portion  # Haferflocken'],
  });
  assert.match(compute(root, '2030-01-16').bodyText, /- Tag noch offen, es fehlen noch: nichts\n/);
});

test('German: English tokens are rejected', () => {
  const root = deRoot();
  writeProtocol(root, '2030-01-15', { language: 'de', food: ['- 12:30 banane 1 serving  # Banane'] });
  assert.throws(() => compute(root, '2030-01-15'), /banane is logged in g/);
  writeProtocol(root, '2030-01-15', { language: 'de', food: ['- 08:00 rezept_beispiel 1 serving  # x'] });
  assert.throws(() => compute(root, '2030-01-15'), /logged in Portion/);
  writeProtocol(root, '2030-01-15', { food: ['- 12:30 banane 90g  # Banane'] });
  assert.throws(() => compute(root, '2030-01-15'), /missing section "## Essen"/);
});
