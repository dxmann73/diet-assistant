#!/usr/bin/env node
// Check a translated file set (default i18n/de) against the English set at the
// repo root: same files (recipe filenames differ by id), same heading
// structure, same frontmatter and JSON keys, same number of foods and recipes,
// localized tokens from the label table, and every referenced id resolves
// inside the set. Exits 0 with "skipped" when i18n/ is absent.
//
// usage: node scripts/check-i18n.js [--dir <i18n subdir>] [--root <dir>]

const fs = require('fs');
const path = require('path');
const { parseArgs, runMain } = require('./lib/util');
const { LABELS } = require('./lib/labels');
const { splitFrontmatter } = require('./lib/frontmatter');
const { loadFoods, loadRecipes, ID_RE } = require('./lib/data');
const { validateHabits } = require('./lib/profile');
const { FOOD_RE, EXERCISE_RE, parseFoodLine, parseExerciseLine } = require('./lib/grammar');
const { englishSet, listFiles, splitFences, headingLevels, headingTexts } = require('./lib/i18n');

const USAGE = 'node scripts/check-i18n.js [--dir <i18n subdir>] [--root <dir>]';
// Maps whose keys are translated ids or words; their values' keys must match.
const ID_MAPS = new Set(['activities', 'aliases']);

const frontKeys = (text, name) =>
  splitFrontmatter(text, name)
    .front.split('\n')
    .map((l) => l.match(/^(\s*)([a-z_]+):/))
    .filter(Boolean)
    .map((m) => `${m[1]}${m[2]}`);

// Key shape of a JSON value; translated id maps keep only their size and value shapes.
function shape(v, parentKey) {
  if (Array.isArray(v)) return v.map((x) => shape(x));
  if (v === null || typeof v !== 'object') return typeof v;
  if (ID_MAPS.has(parentKey)) {
    return Object.values(v).map((x) => shape(x)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  const out = {};
  for (const k of Object.keys(v)) out[k] = shape(v[k], k);
  return out;
}

// A file's text, or null when it is missing (the file-set check reports that).
const readIf = (base, rel) => {
  const p = path.join(base, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

// Check one file set rooted at `base` for internal consistency in `language`.
// Returns the parsed foods and recipes for the cross-set comparison.
function checkSet(base, language, label, problems) {
  const L = LABELS[language];
  const tryRun = (what, fn) => {
    try {
      return fn();
    } catch (err) {
      problems.push(`${label}: ${what}: ${err.message}`);
      return null;
    }
  };
  const foods = tryRun('foods/foods.md', () => loadFoods(base, L));
  const recipes = tryRun('recipes/', () => loadRecipes(base, L));
  if (!foods || !recipes) return { foods, recipes };
  const items = new Map([...foods, ...recipes]);

  // Recipes: serving_default uses the serving token.
  for (const f of fs.readdirSync(path.join(base, 'recipes')).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(base, 'recipes', f), 'utf8');
    const m = splitFrontmatter(text, f).front.match(/^serving_default:\s*(.*)$/m);
    if (!m || !new RegExp(`^\\d+(\\.\\d+)? ${L.serving}$`).test(m[1].trim())) {
      problems.push(`${label}: recipes/${f}: serving_default must be "<n> ${L.serving}"`);
    }
  }

  // Protocol template: localized section headings.
  const proto = readIf(base, 'templates/protocol.template.md');
  if (proto !== null) {
    const heads = headingTexts(proto);
    for (const h of [L.food_heading, L.exercise_heading, L.computed_heading]) {
      if (!heads.includes(h)) problems.push(`${label}: templates/protocol.template.md: missing "## ${h}"`);
    }
  }

  // Recipe template: serving token.
  const rt = readIf(base, 'templates/recipe.template.md');
  if (rt !== null && !new RegExp(`^serving_default: \\d+ ${L.serving}$`, 'm').test(rt)) {
    problems.push(`${label}: templates/recipe.template.md: serving_default must use "${L.serving}"`);
  }

  // Profile template language.
  tryRun('templates/profile.template.json', () => {
    const p = JSON.parse(fs.readFileSync(path.join(base, 'templates', 'profile.template.json'), 'utf8'));
    if (p.language !== language) throw new Error(`language must be "${language}", got ${JSON.stringify(p.language)}`);
  });

  // Habits template: aliases and daily defaults resolve within the set.
  let activities = {};
  tryRun('templates/habits.template.json', () => {
    const h = JSON.parse(fs.readFileSync(path.join(base, 'templates', 'habits.template.json'), 'utf8'));
    validateHabits(h, items, L);
    activities = h.activities;
    for (const word of Object.keys(h.aliases)) {
      if (word !== word.toLowerCase()) throw new Error(`alias ${JSON.stringify(word)} must be lowercase`);
    }
  });

  // Example protocol lines in fenced code of AGENTS.md and README.md resolve.
  for (const f of ['AGENTS.md', 'README.md']) {
    const text = readIf(base, f);
    if (text === null) continue;
    const lines = splitFences(text).fenced;
    lines.forEach((line) => {
      if (FOOD_RE.test(line) && !EXERCISE_RE.test(line)) {
        tryRun(`${f} example`, () => parseFoodLine(line, line, items, L));
      } else if (EXERCISE_RE.test(line)) {
        tryRun(`${f} example`, () => parseExerciseLine(line, line, activities));
      }
    });
    // Fenced example headings must be the localized ones too.
    for (const line of lines) {
      const m = line.match(/^## (.+)$/);
      if (!m) continue;
      const otherLang = Object.keys(LABELS).filter((k) => k !== language);
      for (const o of otherLang) {
        const O = LABELS[o];
        if ([O.food_heading, O.exercise_heading, O.computed_heading].includes(m[1])) {
          problems.push(`${label}: ${f}: example heading "## ${m[1]}" is ${o}, expected ${language}`);
        }
      }
    }
  }
  return { foods, recipes };
}

function checkI18n(root, dirRel) {
  const i18n = path.join(root, 'i18n');
  if (!fs.existsSync(i18n)) return { skipped: true, problems: [] };
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) throw new Error(`${dirRel} not found`);
  const problems = [];

  // 1. Same file set; recipe files are compared by count (their names are ids).
  const en = englishSet(root);
  const de = listFiles(dir);
  const nonRecipe = (list) => list.filter((f) => !f.startsWith('recipes/'));
  const recipeFiles = (list) => list.filter((f) => f.startsWith('recipes/'));
  const enSet = new Set(nonRecipe(en));
  const deSet = new Set(nonRecipe(de));
  for (const f of enSet) if (!deSet.has(f)) problems.push(`${dirRel}: missing ${f}`);
  for (const f of deSet) if (!enSet.has(f)) problems.push(`${dirRel}: extra file ${f}`);
  const enRecipes = recipeFiles(en);
  const deRecipes = recipeFiles(de);
  if (enRecipes.length !== deRecipes.length) {
    problems.push(`${dirRel}: ${deRecipes.length} recipe files, English has ${enRecipes.length}`);
  }
  for (const f of deRecipes) {
    const id = path.basename(f, '.md');
    if (!ID_RE.test(id)) problems.push(`${dirRel}: ${f}: recipe id must be ASCII [a-z0-9_]+`);
  }

  // 2. Same heading structure and frontmatter keys; JSON key shapes.
  const pairs = [...enSet].filter((f) => deSet.has(f)).map((f) => [f, f]);
  enRecipes.forEach((f, i) => deRecipes[i] && pairs.push([f, deRecipes[i]]));
  for (const [ef, df] of pairs) {
    const et = fs.readFileSync(path.join(root, ef), 'utf8');
    const dt = fs.readFileSync(path.join(dir, df), 'utf8');
    if (ef.endsWith('.json')) {
      try {
        const a = JSON.stringify(shape(JSON.parse(et)));
        const b = JSON.stringify(shape(JSON.parse(dt)));
        if (a !== b) problems.push(`${dirRel}/${df}: JSON keys differ from ${ef}`);
      } catch (err) {
        problems.push(`${dirRel}/${df}: ${err.message}`);
      }
      continue;
    }
    const el = headingLevels(et).join(',');
    const dl = headingLevels(dt).join(',');
    if (el !== dl) problems.push(`${dirRel}/${df}: heading levels [${dl}] differ from ${ef} [${el}]`);
    if (et.startsWith('---\n')) {
      try {
        const ek = frontKeys(et, ef).join(',');
        const dk = frontKeys(dt, df).join(',');
        if (ek !== dk) problems.push(`${dirRel}/${df}: frontmatter keys [${dk}] differ from ${ef} [${ek}]`);
      } catch (err) {
        problems.push(`${dirRel}/${df}: ${err.message}`);
      }
    }
  }

  // 3. Each set is internally consistent; same number of foods and recipes.
  const enParsed = checkSet(root, 'en', 'English set', problems);
  const deParsed = checkSet(dir, 'de', dirRel, problems);
  for (const k of ['foods', 'recipes']) {
    if (enParsed[k] && deParsed[k] && enParsed[k].size !== deParsed[k].size) {
      problems.push(`${dirRel}: ${deParsed[k].size} ${k}, English has ${enParsed[k].size}`);
    }
  }
  return { skipped: false, problems };
}

function main(argv) {
  const opts = parseArgs(argv, { options: ['dir'], usage: USAGE });
  const dirRel = opts.dir || 'i18n/de';
  const { skipped, problems } = checkI18n(opts.root, dirRel);
  if (skipped) {
    console.log('skipped: language already chosen (i18n/ is absent)');
    return;
  }
  if (problems.length) {
    console.error(`FAIL: ${problems.length} problem(s) in ${dirRel}:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`OK: ${dirRel} matches the English set`);
}

module.exports = { checkI18n };

if (require.main === module) runMain(main);
