'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { round2, fmt, checkDate, addDays, parseArgs } = require('../scripts/lib/util');

test('round2 rounds half away from zero, symmetric in sign', () => {
  assert.equal(round2(138.775), 138.78);
  assert.equal(round2(-138.775), -138.78);
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(-0.001), 0);
  assert.equal(fmt(-0.001), '0.00');
  assert.throws(() => round2(NaN), /cannot round/);
});

test('dates: format, calendar and arithmetic', () => {
  assert.equal(checkDate('2030-02-28'), '2030-02-28');
  assert.throws(() => checkDate('2030-2-28'), /YYYY-MM-DD/);
  assert.throws(() => checkDate('2030-02-29'), /not a calendar date/);
  assert.equal(addDays('2030-03-01', -1), '2030-02-28');
  assert.equal(addDays('2030-12-31', 1), '2031-01-01');
});

test('parseArgs: --root, positionals, unknown options', () => {
  const u = { positional: ['date'], usage: 'u' };
  assert.equal(parseArgs(['2030-01-15', '--root', '/x'], u).root, '/x');
  assert.equal(parseArgs(['2030-01-15'], u).date, '2030-01-15');
  assert.throws(() => parseArgs([], u), /usage: u/);
  assert.throws(() => parseArgs(['2030-01-15', '--force'], u), /unknown option --force/);
  assert.throws(() => parseArgs(['2030-01-15', '--root'], u), /needs a value/);
});
