'use strict';
// Protocol line grammar (resolved lines, not raw user words):
//   food:     - HH:MM <id> <number><unit>  # <user's words>
//   exercise: - HH:MM <activity_id> <number>min  # <user's words>
// A space between number and unit is optional. The comment is optional.

const { unitFor } = require('./data');

const FOOD_RE = /^- (\d{2}:\d{2}) ([a-z0-9_]+) (\d+(?:\.\d+)?) ?([^\s#]+)(?:\s+#\s?(.*))?$/;
const EXERCISE_RE = /^- (\d{2}:\d{2}) ([a-z0-9_]+) (\d+(?:\.\d+)?) ?min(?:\s+#\s?(.*))?$/;

function checkTime(time, where) {
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) throw new Error(`${where}: invalid time ${time}`);
}

function parseFoodLine(line, where, items, L) {
  const m = line.match(FOOD_RE);
  if (!m) {
    throw new Error(
      `${where}: malformed food line ${JSON.stringify(line)}; expected ` +
        `"- HH:MM <id> <number><unit>  # <words>"`
    );
  }
  const [, time, id, qty, unit, comment] = m;
  checkTime(time, where);
  const item = items.get(id);
  if (!item) {
    throw new Error(
      `${where}: unknown food or recipe id ${JSON.stringify(id)}; add it to foods/foods.md ` +
        'or recipes/ first'
    );
  }
  const expected = unitFor(item, L);
  if (unit !== expected) {
    throw new Error(
      `${where}: ${id} is logged in ${expected} (basis ${item.basis}), got unit ${JSON.stringify(unit)}`
    );
  }
  const amount = parseFloat(qty);
  if (!(amount > 0)) throw new Error(`${where}: amount must be positive`);
  return { time, id, amount, unit, comment: comment || '', item };
}

function parseExerciseLine(line, where, activities) {
  const m = line.match(EXERCISE_RE);
  if (!m) {
    throw new Error(
      `${where}: malformed exercise line ${JSON.stringify(line)}; expected ` +
        `"- HH:MM <activity_id> <number>min  # <words>"`
    );
  }
  const [, time, id, minutes, comment] = m;
  checkTime(time, where);
  if (!Object.prototype.hasOwnProperty.call(activities, id)) {
    throw new Error(
      `${where}: unknown activity ${JSON.stringify(id)}; add it with a MET value to habits.json first`
    );
  }
  const min = parseFloat(minutes);
  if (!(min > 0)) throw new Error(`${where}: minutes must be positive`);
  return { time, id, minutes: min, met: activities[id].met, comment: comment || '' };
}

// Split a protocol body into its `## ` sections. The food and exercise sections
// must appear exactly once; every non-blank line in them must be an entry.
// `offset` is the number of file lines before the body, so errors cite file lines.
function parseBody(body, name, items, activities, L, offset = 0) {
  const sections = new Map();
  let current = null;
  let lineNo = offset;
  for (const line of body.split('\n')) {
    lineNo += 1;
    const h = line.match(/^## (.+?)\s*$/);
    if (h) {
      current = h[1];
      if (sections.has(current)) throw new Error(`${name}: section "## ${current}" appears twice`);
      sections.set(current, []);
      continue;
    }
    if (current !== null) sections.get(current).push({ line, lineNo });
  }
  for (const heading of [L.food_heading, L.exercise_heading]) {
    if (!sections.has(heading)) throw new Error(`${name}: missing section "## ${heading}"`);
  }
  const entries = (heading) =>
    sections.get(heading).filter(({ line }) => line.trim() !== '');
  const food = entries(L.food_heading).map(({ line, lineNo: n }) =>
    parseFoodLine(line, `${name} line ${n}`, items, L)
  );
  const exercise = entries(L.exercise_heading).map(({ line, lineNo: n }) =>
    parseExerciseLine(line, `${name} line ${n}`, activities)
  );
  return { food, exercise, sections };
}

module.exports = { FOOD_RE, EXERCISE_RE, parseFoodLine, parseExerciseLine, parseBody };
