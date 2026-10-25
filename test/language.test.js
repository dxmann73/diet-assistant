'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { setLanguage } = require('../scripts/set-language');
const { checkI18n } = require('../scripts/check-i18n');
const { i18nRoot, makeRoot, FIXTURES } = require('./helpers');

const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');

test('check-i18n: the fixture German set passes', () => {
  assert.deepEqual(checkI18n(i18nRoot(), 'i18n/de'), { skipped: false, problems: [] });
});

test('check-i18n: skipped once i18n/ is gone; missing dir throws', () => {
  const root = makeRoot(path.join(FIXTURES, 'i18n', 'en'));
  assert.deepEqual(checkI18n(root, 'i18n/de'), { skipped: true, problems: [] });
  assert.throws(() => checkI18n(i18nRoot(), 'i18n/fr'), /i18n\/fr not found/);
});

test('check-i18n: reports structural and token defects', () => {
  const root = i18nRoot();
  const de = (f) => path.join(root, 'i18n', 'de', f);
  const sub = (f, a, b) => fs.writeFileSync(de(f), fs.readFileSync(de(f), 'utf8').replace(a, b));
  fs.rmSync(de('README.md'));
  sub('AGENTS.md', '## Protokoll-Grammatik', '### Protokoll-Grammatik');
  sub('AGENTS.md', '- 12:30 banane 90g', '- 12:30 banana 90g');
  sub('templates/protocol.template.md', '## Sport', '## Exercise');
  sub('templates/profile.template.json', '"de"', '"en"');
  sub('templates/habits.template.json', '"id": "banane"', '"id": "banana"');
  sub('recipes/rezept_beispiel.md', 'serving_default: 1 Portion', 'serving_default: 1 serving');
  sub('foods/foods.md', /\| ei \|.*\n/, '');
  const { problems } = checkI18n(root, 'i18n/de');
  const expect = [
    /missing README\.md/,
    /AGENTS\.md: heading levels/,
    /AGENTS\.md example: .*unknown food or recipe id "banana"/,
    /protocol\.template\.md: missing "## Sport"/,
    /language must be "de", got "en"/,
    /habits\.template\.json: .*id "banana" is not a food or recipe/,
    /rezept_beispiel\.md: serving_default must be "<n> Portion"/,
    /2 foods, English has 3/,
  ];
  for (const re of expect) assert.ok(problems.some((p) => re.test(p)), `${re} not in:\n${problems.join('\n')}`);
});

test('set-language de: archives English, moves German to the root, removes i18n/', () => {
  const root = i18nRoot();
  const englishAgents = read(root, 'AGENTS.md');
  const germanAgents = read(root, 'i18n/de/AGENTS.md');
  setLanguage(root, 'de');
  assert.equal(read(root, 'AGENTS.md'), germanAgents);
  assert.equal(read(root, 'archive/en/AGENTS.md'), englishAgents);
  assert.ok(fs.existsSync(path.join(root, 'recipes', 'rezept_beispiel.md')));
  assert.ok(!fs.existsSync(path.join(root, 'recipes', 'example.md')));
  assert.ok(fs.existsSync(path.join(root, 'archive', 'en', 'recipes', 'example.md')));
  assert.ok(!fs.existsSync(path.join(root, 'i18n')));
  assert.match(read(root, 'templates/profile.template.json'), /"language": "de"/);
  assert.throws(() => setLanguage(root, 'en'), /language was already chosen/);
});

test('set-language en: archives German, keeps English, removes i18n/', () => {
  const root = i18nRoot();
  const englishAgents = read(root, 'AGENTS.md');
  setLanguage(root, 'en');
  assert.equal(read(root, 'AGENTS.md'), englishAgents);
  assert.ok(fs.existsSync(path.join(root, 'archive', 'de', 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(root, 'i18n')));
  assert.deepEqual(checkI18n(root, 'i18n/de'), { skipped: true, problems: [] });
});

test('set-language refuses bad input and leaves the tree untouched', () => {
  assert.throws(() => setLanguage(i18nRoot(), 'fr'), /language must be en or de/);

  const extra = i18nRoot();
  fs.mkdirSync(path.join(extra, 'i18n', 'fr'));
  assert.throws(() => setLanguage(extra, 'de'), /i18n\/ must contain exactly de\//);

  const archived = i18nRoot();
  fs.mkdirSync(path.join(archived, 'archive'));
  assert.throws(() => setLanguage(archived, 'de'), /archive\/ already exists/);

  const missing = i18nRoot();
  fs.rmSync(path.join(missing, 'README.md'));
  assert.throws(() => setLanguage(missing, 'de'), /README\.md is missing/);
  assert.ok(fs.existsSync(path.join(missing, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(missing, 'archive')));
});
