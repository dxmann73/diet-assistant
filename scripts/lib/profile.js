'use strict';
// profile.json (body data and targets) and habits.json (METs, daily defaults,
// aliases): load, validate, and derive the day's targets.

const path = require('path');
const { readJson, round2, fmt } = require('./util');
const { LANGUAGES } = require('./labels');
const { ID_RE, unitFor } = require('./data');
const { parseFoodLine, parseExerciseLine } = require('./grammar');

const PROFILE_KEYS = [
  'language',
  'sex',
  'birth_year',
  'height_cm',
  'start_weight_kg',
  'activity_factor',
  'max_deficit_kcal',
  'protein_floor_g_per_kg',
  'protein_target_g_per_kg',
  'protein_top_g_per_kg',
  'fat_g_per_kg',
  'away_day_deficit_kcal',
];
const ACTIVITY_FACTORS = [1.2, 1.375, 1.55];
const MIN_BMI = 18.5;
const MIN_AGE = 18;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function onlyKeys(obj, allowed, where) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new Error(`${where}: unknown key ${JSON.stringify(key)}`);
  }
}

function positive(v, where) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    throw new Error(`${where} must be a positive number, got ${JSON.stringify(v)}`);
  }
  return v;
}

const bmi = (p) => p.start_weight_kg / (p.height_cm / 100) ** 2;

// `year` is the calendar year the profile is checked for (age gate).
function validateProfile(p, year) {
  const where = 'profile.json';
  if (!isObject(p)) throw new Error(`${where} must be a JSON object`);
  onlyKeys(p, PROFILE_KEYS, where);
  for (const key of PROFILE_KEYS) {
    if (!(key in p)) throw new Error(`${where}: missing key ${key}`);
  }
  if (!LANGUAGES.includes(p.language)) {
    throw new Error(`${where}: language must be one of ${LANGUAGES.join('|')}, got ${JSON.stringify(p.language)}`);
  }
  if (!['female', 'male'].includes(p.sex)) {
    throw new Error(`${where}: sex must be female|male, got ${JSON.stringify(p.sex)}`);
  }
  if (!Number.isInteger(p.birth_year) || p.birth_year < 1900 || p.birth_year > year) {
    throw new Error(`${where}: birth_year must be a whole year, got ${JSON.stringify(p.birth_year)}`);
  }
  for (const key of PROFILE_KEYS.slice(3)) positive(p[key], `${where}: ${key}`);
  if (!ACTIVITY_FACTORS.includes(p.activity_factor)) {
    throw new Error(
      `${where}: activity_factor must be one of ${ACTIVITY_FACTORS.join('|')}, got ${p.activity_factor}`
    );
  }
  if (
    !(p.protein_floor_g_per_kg <= p.protein_target_g_per_kg &&
      p.protein_target_g_per_kg <= p.protein_top_g_per_kg)
  ) {
    throw new Error(`${where}: protein must satisfy floor <= target <= top (g/kg)`);
  }
  // Safety gate: this tool is not for under-18s or underweight people.
  const age = year - p.birth_year;
  if (age < MIN_AGE) {
    throw new Error(`${where}: age ${age} is under ${MIN_AGE}; this tool is not for minors, see a doctor`);
  }
  const b = bmi(p);
  if (b < MIN_BMI) {
    throw new Error(
      `${where}: BMI ${b.toFixed(1)} at start_weight_kg is under ${MIN_BMI}; ` +
        'fat loss is not advised, see a doctor'
    );
  }
  return p;
}

function loadProfile(root, year) {
  return validateProfile(readJson(path.join(root, 'profile.json'), 'profile.json'), year);
}

function validateHabits(h, items, L) {
  const where = 'habits.json';
  if (!isObject(h)) throw new Error(`${where} must be a JSON object`);
  onlyKeys(h, ['activities', 'daily_defaults', 'aliases', 'notes'], where);
  for (const key of ['activities', 'daily_defaults', 'aliases']) {
    if (!(key in h)) throw new Error(`${where}: missing key ${key}`);
  }
  if (!isObject(h.activities)) throw new Error(`${where}: activities must be an object`);
  for (const [id, a] of Object.entries(h.activities)) {
    const w = `${where}: activities.${id}`;
    if (!ID_RE.test(id)) throw new Error(`${w}: activity id must match [a-z0-9_]+`);
    if (!isObject(a)) throw new Error(`${w} must be an object like { "met": 3.0 }`);
    onlyKeys(a, ['met', 'notes'], w);
    positive(a.met, `${w}.met`);
  }
  if (!Array.isArray(h.daily_defaults)) throw new Error(`${where}: daily_defaults must be an array`);
  h.daily_defaults.forEach((d, i) => {
    const w = `${where}: daily_defaults[${i}]`;
    if (!isObject(d)) throw new Error(`${w} must be an object`);
    onlyKeys(d, ['section', 'line'], w);
    if (d.section === 'food') parseFoodLine(d.line, w, items, L);
    else if (d.section === 'exercise') parseExerciseLine(d.line, w, h.activities);
    else throw new Error(`${w}.section must be food|exercise, got ${JSON.stringify(d.section)}`);
  });
  if (!isObject(h.aliases)) throw new Error(`${where}: aliases must be an object`);
  for (const [word, a] of Object.entries(h.aliases)) {
    const w = `${where}: aliases.${JSON.stringify(word)}`;
    if (!isObject(a)) throw new Error(`${w} must be an object like { "id": "...", "amount": 90, "unit": "g" }`);
    onlyKeys(a, ['id', 'amount', 'unit', 'notes'], w);
    const item = items.get(a.id);
    if (!item) throw new Error(`${w}: id ${JSON.stringify(a.id)} is not a food or recipe`);
    if (('amount' in a) !== ('unit' in a)) throw new Error(`${w}: give amount and unit together or neither`);
    if ('amount' in a) {
      positive(a.amount, `${w}.amount`);
      const expected = unitFor(item, L);
      if (a.unit !== expected) {
        throw new Error(`${w}: ${a.id} is logged in ${expected}, got unit ${JSON.stringify(a.unit)}`);
      }
    }
  }
  return h;
}

function loadHabits(root, items, L) {
  return validateHabits(readJson(path.join(root, 'habits.json'), 'habits.json'), items, L);
}

// Targets for one day at one weight. Each step is rounded before the next uses
// it, so the printed working reproduces exactly.
function targets(p, weight, year) {
  const age = year - p.birth_year;
  const sexTerm = p.sex === 'male' ? 5 : -161;
  const bmr = round2(10 * weight + 6.25 * p.height_cm - 5 * age + sexTerm);
  const maintenance = round2(bmr * p.activity_factor);
  const floor = round2(maintenance - p.max_deficit_kcal);
  const proteinFloor = round2(p.protein_floor_g_per_kg * weight);
  const proteinTarget = round2(p.protein_target_g_per_kg * weight);
  const proteinTop = round2(p.protein_top_g_per_kg * weight);
  const fat = round2(p.fat_g_per_kg * weight);
  const carbs = round2((maintenance - 4 * proteinTarget - 9 * fat) / 4);
  return { year, weight, age, sexTerm, bmr, maintenance, floor, proteinFloor, proteinTarget, proteinTop, fat, carbs };
}

// Human-readable working for the targets, one markdown list line each.
function targetLines(L, p, t) {
  const sexTerm = t.sexTerm >= 0 ? `+ ${t.sexTerm}` : `− ${-t.sexTerm}`;
  const sex = p.sex === 'male' ? L.sex_male : L.sex_female;
  return [
    `- ${L.age}: ${t.year} − ${p.birth_year} = ${t.age}`,
    `- ${L.bmr(sex)}: 10 × ${fmt(t.weight)} + 6.25 × ${p.height_cm} − 5 × ${t.age} ${sexTerm} = ` +
      `${fmt(t.bmr)} kcal`,
    `- ${L.maintenance_formula}: ${fmt(t.bmr)} × ${p.activity_factor} = ${fmt(t.maintenance)} kcal`,
    `- ${L.floor_formula}: ${fmt(t.maintenance)} − ${p.max_deficit_kcal} = ${fmt(t.floor)} kcal`,
    `- ${L.protein_range}: ${fmt(t.proteinFloor)} / ${fmt(t.proteinTarget)} / ${fmt(t.proteinTop)} g ` +
      `(${p.protein_floor_g_per_kg} / ${p.protein_target_g_per_kg} / ${p.protein_top_g_per_kg} g/kg)`,
    `- ${L.fat_target}: ${p.fat_g_per_kg} × ${fmt(t.weight)} = ${fmt(t.fat)} g`,
    `- ${L.carbs_target}: (${fmt(t.maintenance)} − 4 × ${fmt(t.proteinTarget)} − 9 × ${fmt(t.fat)}) / 4 = ` +
      `${fmt(t.carbs)} g`,
  ];
}

module.exports = {
  PROFILE_KEYS,
  ACTIVITY_FACTORS,
  validateProfile,
  loadProfile,
  validateHabits,
  loadHabits,
  targets,
  targetLines,
};
