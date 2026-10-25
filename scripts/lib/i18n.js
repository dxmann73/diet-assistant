'use strict';
// The translated file set and Markdown structure helpers shared by
// set-language.js and check-i18n.js.

const fs = require('fs');
const path = require('path');

// Files that exist once per language. Paths relative to the repo root.
function englishSet(root) {
  const templates = fs
    .readdirSync(path.join(root, 'templates'))
    .sort()
    .map((f) => `templates/${f}`);
  return ['AGENTS.md', 'README.md', ...templates, 'foods/foods.md', 'recipes/example.md'];
}

// Every file under `dir`, relative to it, sorted.
function listFiles(dir) {
  const out = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(r);
      else out.push(r);
    }
  };
  walk('');
  return out.sort();
}

// Lines outside fenced code blocks, and the fenced lines separately.
function splitFences(text) {
  const prose = [];
  const fenced = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    (inFence ? fenced : prose).push(line);
  }
  return { prose, fenced };
}

// Heading levels in order, e.g. [1, 2, 2, 3]. Fenced code is ignored.
function headingLevels(text) {
  return splitFences(text)
    .prose.map((l) => l.match(/^(#{1,6}) /))
    .filter(Boolean)
    .map((m) => m[1].length);
}

function headingTexts(text) {
  return splitFences(text)
    .prose.map((l) => l.match(/^#{1,6} (.+?)\s*$/))
    .filter(Boolean)
    .map((m) => m[1]);
}

module.exports = { englishSet, listFiles, splitFences, headingLevels, headingTexts };
