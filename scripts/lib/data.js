'use strict';
// Food database (foods/foods.md) and recipes (recipes/*.md). Every item gets a
// `basis` that fixes which unit a protocol line may use for it.

const fs = require('fs');
const path = require('path');
const { splitFrontmatter, topLevel, requireNumber } = require('./frontmatter');

const ID_RE = /^[a-z0-9_]+$/;
const FOOD_COLUMNS = [
  'id',
  'name',
  'basis',
  'kcal',
  'fat_g',
  'carbs_g',
  'protein_g',
  'fiber_g',
  'notes',
];
const RECIPE_NUMBER_KEYS = [
  'serving_kcal',
  'serving_protein_g',
  'serving_fat_g',
  'serving_carbs_g',
];

const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

function parseCellNumber(raw, where, key, { optional = false } = {}) {
  if (raw === '' && optional) return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`${where}: ${key} must be a plain non-negative number, got ${JSON.stringify(raw)}`);
  }
  return parseFloat(raw);
}

// Returns Map id → { id, name, basis, kcal, fat_g, carbs_g, protein_g, fiber_g, kind }.
// kind: 'per100' (basis 100g/100ml) or 'piece'.
function loadFoods(root, L) {
  const file = path.join(root, 'foods', 'foods.md');
  if (!fs.existsSync(file)) throw new Error(`foods/foods.md not found under ${root}`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const tables = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith('|') && (i === 0 || !lines[i - 1].trim().startsWith('|'))) {
      tables.push(i);
    }
  }
  if (tables.length !== 1) {
    throw new Error(`foods/foods.md must contain exactly one table, found ${tables.length}`);
  }
  const start = tables[0];
  const header = cells(lines[start]);
  if (header.join('|') !== FOOD_COLUMNS.join('|')) {
    throw new Error(
      `foods/foods.md: table columns must be ${FOOD_COLUMNS.join(' | ')}, got ${header.join(' | ')}`
    );
  }
  if (!/^\|?\s*:?-+/.test(lines[start + 1] || '')) {
    throw new Error('foods/foods.md: table header must be followed by a separator row');
  }
  const bases = new Set(['100g', '100ml', L.piece]);
  const foods = new Map();
  for (let i = start + 2; i < lines.length && lines[i].trim().startsWith('|'); i += 1) {
    const where = `foods/foods.md line ${i + 1}`;
    const c = cells(lines[i]);
    if (c.length !== FOOD_COLUMNS.length) {
      throw new Error(`${where}: expected ${FOOD_COLUMNS.length} cells, got ${c.length}`);
    }
    const [id, name, basis] = c;
    if (!ID_RE.test(id)) throw new Error(`${where}: id must match [a-z0-9_]+, got ${JSON.stringify(id)}`);
    if (foods.has(id)) throw new Error(`${where}: duplicate id ${id}`);
    if (!name) throw new Error(`${where}: name is empty`);
    if (!bases.has(basis)) {
      throw new Error(`${where}: basis must be one of ${[...bases].join(' | ')}, got ${JSON.stringify(basis)}`);
    }
    foods.set(id, {
      id,
      name,
      basis,
      kind: basis === L.piece ? 'piece' : 'per100',
      kcal: parseCellNumber(c[3], where, 'kcal'),
      fat_g: parseCellNumber(c[4], where, 'fat_g'),
      carbs_g: parseCellNumber(c[5], where, 'carbs_g'),
      protein_g: parseCellNumber(c[6], where, 'protein_g'),
      fiber_g: parseCellNumber(c[7], where, 'fiber_g', { optional: true }),
    });
  }
  return foods;
}

// Returns Map id → { id, name, kind: 'recipe', basis: <serving token>, kcal, ... per serving }.
function loadRecipes(root, L) {
  const dir = path.join(root, 'recipes');
  const recipes = new Map();
  if (!fs.existsSync(dir)) return recipes;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const where = `recipes/${f}`;
    const { front } = splitFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'), where);
    const id = topLevel(front, 'id');
    if (!id || !ID_RE.test(id)) throw new Error(`${where}: id must match [a-z0-9_]+, got ${JSON.stringify(id)}`);
    if (`${id}.md` !== f) throw new Error(`${where}: id ${id} must equal the filename`);
    const name = topLevel(front, 'name');
    if (!name) throw new Error(`${where}: name is empty`);
    const n = {};
    for (const key of RECIPE_NUMBER_KEYS) n[key] = requireNumber(topLevel(front, key), where, key);
    recipes.set(id, {
      id,
      name,
      basis: L.serving,
      kind: 'recipe',
      kcal: n.serving_kcal,
      protein_g: n.serving_protein_g,
      fat_g: n.serving_fat_g,
      carbs_g: n.serving_carbs_g,
    });
  }
  return recipes;
}

// One lookup for protocol lines: foods and recipes share the id space.
function loadItems(root, L) {
  const foods = loadFoods(root, L);
  const recipes = loadRecipes(root, L);
  for (const id of recipes.keys()) {
    if (foods.has(id)) throw new Error(`id ${id} is both a food and a recipe; ids must be unique`);
  }
  return new Map([...foods, ...recipes]);
}

// The unit a protocol line must use for an item.
function unitFor(item, L) {
  if (item.kind === 'recipe') return L.serving;
  if (item.kind === 'piece') return L.piece;
  return item.basis === '100ml' ? 'ml' : 'g';
}

module.exports = { ID_RE, FOOD_COLUMNS, RECIPE_NUMBER_KEYS, loadFoods, loadRecipes, loadItems, unitFor };
