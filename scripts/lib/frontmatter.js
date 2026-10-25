'use strict';
// Flat frontmatter parser for protocols and recipes. Deliberately not a YAML
// library: only `key: value` lines and the indented `metrics:` block are read,
// and every value the scripts use must be a bare number, a token or null.

const fs = require('fs');
const path = require('path');
const { DATE_RE } = require('./util');

const STATUSES = ['closed', 'open', 'estimated'];
const METRIC_KEYS = [
  'maintenance_kcal',
  'deficit_kcal',
  'intake_kcal',
  'burn_kcal',
  'net_intake_kcal',
];

function splitFrontmatter(text, name) {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${name}: no frontmatter (must start with --- and end with ---)`);
  return { front: fm[1], body: text.slice(fm[0].length), frontRaw: fm[0] };
}

const stripComment = (raw) => raw.replace(/\s+#.*$/, '').trim();

// Top-level `key: value` (not indented). Returns undefined when the key is absent.
function topLevel(front, key) {
  const m = front.match(new RegExp(`^${key}:(.*)$`, 'm'));
  return m ? stripComment(m[1]) : undefined;
}

// "81.6" | "-317.51" | "−317.51" (U+2212) | "null" → number | null
function parseNumber(raw, name, key) {
  if (raw === undefined) throw new Error(`${name}: ${key} missing`);
  const v = stripComment(raw);
  if (v === '' || v === 'null' || v === '~') return null;
  // Strict: the whole value must be the number. parseFloat alone would accept
  // "1026.6 kcal" and silently drop the unit, hiding a malformed block.
  const normalized = v.replace('−', '-');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(
      `${name}: ${key} must be a bare number or null, got ${JSON.stringify(v)} ` +
        '(no units, no ~, no bold, see AGENTS.md "Metrics block")'
    );
  }
  return parseFloat(normalized);
}

function requireNumber(raw, name, key) {
  const n = parseNumber(raw, name, key);
  if (n === null) throw new Error(`${name}: ${key} must be a number, got null`);
  return n;
}

// The two-space-indented keys under `metrics:` until the next top-level key.
function metricsBlock(front, name) {
  const m = front.match(/^metrics:\n((?:[ \t]+\S[^\n]*\n?)*)/m);
  if (!m) throw new Error(`${name}: frontmatter has no metrics: block`);
  const raw = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const kv = line.match(/^[ \t]+([a-z_]+):(.*)$/);
    if (!kv) throw new Error(`${name}: unparseable metrics line: ${JSON.stringify(line)}`);
    if (kv[1] in raw) throw new Error(`${name}: metrics.${kv[1]} appears twice`);
    raw[kv[1]] = kv[2];
  }
  const known = new Set(['status', ...METRIC_KEYS]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) throw new Error(`${name}: unknown key metrics.${key}`);
  }
  const status = stripComment(raw.status || '');
  if (!STATUSES.includes(status)) {
    throw new Error(
      `${name}: metrics.status must be one of ${STATUSES.join('|')}, got ${JSON.stringify(status)}`
    );
  }
  const values = { status };
  for (const key of METRIC_KEYS) {
    values[key] = parseNumber(raw[key], name, `metrics.${key}`);
  }
  return values;
}

// Read one protocol's frontmatter. `strict` also enforces the chart contract:
// maintenance_kcal and deficit_kcal must be numbers on every day.
function readProtocol(file, { strict }) {
  const name = path.basename(file);
  const text = fs.readFileSync(file, 'utf8');
  const { front, body } = splitFrontmatter(text, name);
  const date = topLevel(front, 'date');
  if (`${date}.md` !== name) {
    throw new Error(`${name}: frontmatter date ${JSON.stringify(date)} does not match the filename`);
  }
  const weight_kg = parseNumber(topLevel(front, 'weight_kg'), name, 'weight_kg');
  if (weight_kg !== null && weight_kg <= 0) throw new Error(`${name}: weight_kg must be positive`);
  const metrics = metricsBlock(front, name);
  if (strict) {
    for (const key of ['maintenance_kcal', 'deficit_kcal']) {
      if (metrics[key] === null) {
        throw new Error(
          `${name}: metrics.${key} is null. Every day needs a value, even an assumed ` +
            'one; run node scripts/compute-day.js for the day and paste its block'
        );
      }
    }
  }
  return { date, name, text, front, body, weight_kg, metrics };
}

function protocolFiles(root) {
  const dir = path.join(root, 'protocols');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      if (!DATE_RE.test(f.slice(0, -3))) {
        throw new Error(`protocols/${f}: protocol files must be named YYYY-MM-DD.md`);
      }
      return path.join(dir, f);
    })
    .sort();
}

module.exports = {
  STATUSES,
  METRIC_KEYS,
  splitFrontmatter,
  stripComment,
  topLevel,
  parseNumber,
  requireNumber,
  metricsBlock,
  readProtocol,
  protocolFiles,
};
