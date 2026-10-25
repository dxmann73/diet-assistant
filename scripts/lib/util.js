'use strict';
// Small shared helpers: argument parsing, rounding, dates, file reads.

const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.join(__dirname, '..', '..');

// Parse `--root <dir>` plus any extra `--<name> <value>` options listed in
// `options`. Everything else is positional. Unknown options throw.
function parseArgs(argv, { options = [], positional = [], usage }) {
  const opts = { root: DEFAULT_ROOT };
  const args = [];
  const known = new Set(['root', ...options]);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (!known.has(name)) throw new Error(`unknown option ${a}\nusage: ${usage}`);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`option ${a} needs a value\nusage: ${usage}`);
      }
      opts[name] = value;
      i += 1;
    } else {
      args.push(a);
    }
  }
  if (args.length !== positional.length) {
    throw new Error(
      `expected ${positional.length} argument(s) (${positional.join(', ') || 'none'}), ` +
        `got ${args.length}\nusage: ${usage}`
    );
  }
  opts.root = path.resolve(opts.root);
  positional.forEach((name, i) => {
    opts[name] = args[i];
  });
  return opts;
}

// Run a CLI main: print the error message and exit 1 instead of a stack trace.
function runMain(main) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}

// Round half away from zero to 2 decimals. Goes through the decimal string so
// 138.775 rounds to 138.78, not 138.77 as binary floats would.
function round2(x) {
  if (!Number.isFinite(x)) throw new Error(`cannot round ${x}`);
  if (Math.abs(x) < 1e-9) return 0;
  const sign = x < 0 ? -1 : 1;
  const r = sign * Number(Math.round(Number(`${Math.abs(x)}e2`)) + 'e-2');
  return r === 0 ? 0 : r; // no -0
}

// Fixed 2-decimal string, ASCII minus.
const fmt = (x) => round2(x).toFixed(2);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkDate(date) {
  if (!DATE_RE.test(date)) throw new Error(`date must be YYYY-MM-DD, got ${JSON.stringify(date)}`);
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw new Error(`not a calendar date: ${date}`);
  }
  return date;
}

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "Today" is the system clock in local time, like `date +%F`.
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found at ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${label} is not valid JSON: ${err.message}`);
  }
}

module.exports = {
  DEFAULT_ROOT,
  parseArgs,
  runMain,
  round2,
  fmt,
  DATE_RE,
  checkDate,
  addDays,
  today,
  readJson,
};
