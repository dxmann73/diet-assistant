'use strict';
// The day's weight and the 7-day means behind maintenance and the stall flag.

const { readProtocol, protocolFiles } = require('./frontmatter');
const { addDays, round2 } = require('./util');

// All weigh-ins, oldest first: [{ date, weight }].
function weighIns(root) {
  return protocolFiles(root)
    .map((f) => readProtocol(f, { strict: false }))
    .filter((p) => p.weight_kg !== null)
    .map((p) => ({ date: p.date, weight: p.weight_kg }));
}

// Mean of the weigh-ins in the 7 days ending on `end` (inclusive), or null.
function mean7(all, end) {
  const from = addDays(end, -6);
  const win = all.filter((w) => w.date >= from && w.date <= end);
  if (!win.length) return null;
  const mean = round2(win.reduce((s, w) => s + w.weight, 0) / win.length);
  return { mean, n: win.length, from: win[0].date, to: win[win.length - 1].date };
}

// Weight for `date`: 7-day mean; else the most recent earlier weigh-in; else
// start_weight_kg. `source` names which one, in the user's language.
function weightFor(all, date, profile, L) {
  const m = mean7(all, date);
  if (m) {
    if (m.n === 1 && m.to === date) return { weight: m.mean, source: L.src_today };
    if (m.n === 1) return { weight: m.mean, source: L.src_last(m.to) };
    return { weight: m.mean, source: L.src_mean(m.n, m.from, m.to) };
  }
  const earlier = all.filter((w) => w.date < date);
  if (earlier.length) {
    const last = earlier[earlier.length - 1];
    return { weight: last.weight, source: L.src_last(last.date) };
  }
  return { weight: profile.start_weight_kg, source: L.src_start };
}

// Stall: the 7-day mean ending today is not below the one ending 21 days earlier.
function stall(all, date) {
  const now = mean7(all, date);
  const before = mean7(all, addDays(date, -21));
  return {
    now,
    before,
    beforeEnd: addDays(date, -21),
    checked: Boolean(now && before),
    stalled: Boolean(now && before && now.mean >= before.mean),
  };
}

module.exports = { weighIns, mean7, weightFor, stall };
