#!/usr/bin/env node
// Pick the file language once, at onboarding.
//   en: i18n/de/ → archive/de/
//   de: each English original of the translated set → archive/en/<same path>,
//       i18n/de/* → repo root
// Then i18n/ is removed. Refuses when i18n/ is absent (language already chosen).
// Nothing reads archive/; the agent commits the result.
//
// usage: node scripts/set-language.js <en|de> [--root <dir>]

const fs = require('fs');
const path = require('path');
const { parseArgs, runMain } = require('./lib/util');
const { englishSet, listFiles } = require('./lib/i18n');

const USAGE = 'node scripts/set-language.js <en|de> [--root <dir>]';

function move(root, from, to) {
  const dst = path.join(root, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(path.join(root, from), dst);
}

function setLanguage(root, language) {
  if (!['en', 'de'].includes(language)) {
    throw new Error(`language must be en or de, got ${JSON.stringify(language)}\nusage: ${USAGE}`);
  }
  const i18n = path.join(root, 'i18n');
  if (!fs.existsSync(i18n)) {
    throw new Error('i18n/ is absent: the language was already chosen. Switching later is not supported.');
  }
  const entries = fs.readdirSync(i18n);
  if (entries.join() !== 'de') {
    throw new Error(`i18n/ must contain exactly de/, found: ${entries.join(', ') || 'nothing'}`);
  }
  if (fs.existsSync(path.join(root, 'archive'))) throw new Error('archive/ already exists; not overwriting');

  const moved = [];
  if (language === 'en') {
    move(root, 'i18n/de', 'archive/de');
    moved.push('i18n/de/ → archive/de/');
  } else {
    const english = englishSet(root);
    const german = listFiles(path.join(i18n, 'de'));
    // Check everything before the first move so a failure leaves the tree untouched.
    for (const f of english) {
      if (!fs.existsSync(path.join(root, f))) throw new Error(`${f} is missing; cannot archive it`);
    }
    const englishSetLookup = new Set(english);
    for (const f of german) {
      if (fs.existsSync(path.join(root, f)) && !englishSetLookup.has(f)) {
        throw new Error(`${f} exists and is not part of the English set; not overwriting`);
      }
    }
    for (const f of english) {
      move(root, f, `archive/en/${f}`);
      moved.push(`${f} → archive/en/${f}`);
    }
    for (const f of german) {
      move(root, `i18n/de/${f}`, f);
      moved.push(`i18n/de/${f} → ${f}`);
    }
  }
  const left = listFiles(i18n);
  if (left.length) throw new Error(`files left in i18n/ after the move: ${left.join(', ')}`);
  fs.rmSync(i18n, { recursive: true });
  return moved;
}

function main(argv) {
  const opts = parseArgs(argv, { positional: ['language'], usage: USAGE });
  const moved = setLanguage(opts.root, opts.language);
  for (const m of moved) console.log(m);
  console.log(`Language set to ${opts.language}. i18n/ removed. Commit the result.`);
}

module.exports = { setLanguage };

if (require.main === module) runMain(main);
