# AGENTS.md: diet assistant

Instructions for the AI agent working in this repo.

## Purpose

Help one person lose fat while keeping muscle. They tell you what they ate and how they moved;
you log it in a daily protocol, run the scripts that do the math, and report the result. Metric
units only (kg, cm, g, ml, kcal).

## Start of every session

1. If `profile.json` is missing, or the user asks to start or set up in any words and any
   language ("initialize", "set me up", "initialisieren", "lass uns beginnen" …), run
   [Onboarding](#onboarding). Do nothing else first.
2. Otherwise read `habits.json` and `rules.md` before you answer. `rules.md` overrides the
   defaults in this file.
3. Ignore `archive/`. It holds the language that was not chosen. No script reads it.
4. Never write personal rules or numbers into this file. They belong in `profile.json`,
   `habits.json` or `rules.md`.

## Division of labour

You interpret the user, resolve every item to an id and an amount, ask about anything missing,
write protocol lines, run the scripts, and report their output. **You never do daily arithmetic
yourself.** The scripts compute targets, intake, burn, deficit and flags. The one exception is
recipe totals (see [Recipes](#recipes)).

Fail fast. Never guess macros, amounts or MET values. If something is unknown, ask. If a script
throws, fix the input it names, or ask the user; never work around it.

## Files

| file | holds | who changes it |
| --- | --- | --- |
| `profile.json` | body data and targets | you, only after the user confirms |
| `habits.json` | MET per activity, daily defaults, food-name aliases | you, when the user teaches a rule |
| `rules.md` | preferences without numbers: reply style, report order, chart display | you, when the user teaches a rule |
| `protocols/YYYY-MM-DD.md` | one file per day | you, every day |
| `foods/foods.md` | food database | you, when a new food appears |
| `recipes/<id>.md` | composed dishes | you, when the user describes one |
| `charts/chart-cdn.html` | weight chart | `scripts/gen-chart-cdn.js` only |
| `templates/` | starting points for the files above | nobody, after onboarding |

Keep the shipped starter foods in `foods/foods.md` and the example recipe `recipes/example.md`.
Do not delete them unless the user asks.

## Scripts

All run with Node 20 or newer, no dependencies. All accept `--root <dir>` (default: this repo).

| command | does |
| --- | --- |
| `node scripts/check-profile.js` | validates `profile.json`, `habits.json`, `rules.md`; prints targets with working |
| `node scripts/new-day.js <date>` | creates `protocols/<date>.md` with the daily defaults; never overwrites |
| `node scripts/compute-day.js <date>` | prints the metrics block and the computed section for that day; writes nothing |
| `node scripts/check-protocols.js` | checks every metrics block against its computed section |
| `node scripts/gen-chart-cdn.js` | redraws `charts/chart-cdn.html` |
| `node scripts/set-language.js <en\|de>` | onboarding only: picks the file language |
| `node scripts/check-i18n.js` | maintainers only: checks the German file set |

"Today" is `date +%F`.

## Daily workflow

1. If today's protocol does not exist, run `node scripts/new-day.js $(date +%F)`. It writes the
   daily defaults from `habits.json`. If the user skipped a default, delete its line. If they
   changed it, edit the line.
2. Turn every message into protocol lines (see [Protocol grammar](#protocol-grammar)). Resolve
   words through `habits.json` aliases first. Ask when an amount, a food or an activity is
   unclear. "A handful" is not an amount; ask for grams.
3. A weigh-in goes into the frontmatter as `weight_kg: 79.3` (a bare number).
4. After every edit to a protocol, run `node scripts/compute-day.js <date>`. Paste its two parts
   into the protocol **verbatim**: the `metrics:` block replaces the old `metrics:` block in the
   frontmatter; the computed section replaces everything from the computed heading
   (`## Computed`) to the end of the file. Never edit those numbers by hand.
5. Then run `node scripts/check-protocols.js` and `node scripts/gen-chart-cdn.js`. Both must
   exit 0.
6. Report from the script output: intake, burn, net intake, deficit, protein against floor and
   target, fat and carbs against target, and every flag. Follow the report order and chart
   display in `rules.md`. Without an `inline-vis` rule, tell the user to open
   `charts/chart-cdn.html`.

"Close the day" means: set `status: closed` in the metrics block, run steps 4 and 5 again, then
commit the day's protocol and any new foods or recipes with `git commit`. Never push unless the
user asks.

A day away with nothing itemized: create the file, set `status: estimated`, keep the food and
exercise headings, run `compute-day.js` and paste as usual. It uses the deficit already in the
block, or `away_day_deficit_kcal` from `profile.json` when the block has none.

## Protocol grammar

Lines are resolved, not raw words. One item per line. The user's own words go into the trailing
comment.

```text
- HH:MM <id> <number><unit>  # <user's words>
- HH:MM <activity_id> <number>min  # <user's words>
```

- Food lines go under `## Food`, exercise lines under `## Exercise`. Every non-blank line in
  those two sections must be such a line.
- `<id>` is an id from `foods/foods.md` or a recipe id from `recipes/`.
- `<unit>` must match the item's basis: `g` for `100g` foods, `ml` for `100ml` foods, `pc` for
  per-piece foods, `serving` for recipes. Examples: `90g`, `250ml`, `2 pc`, `1 serving`.
- `<activity_id>` is a key of `habits.json` `activities`. Duration in minutes only. If the user
  gives only a distance, ask how long it took.
- Map swimming to `swimming`, running/jogging to `running`, cycling to `cycling` and strength
  training at the gym to `gym`. For running/jogging ask for the pace, for other gym sessions ask
  for the type of training; settle the matching MET value before computing.
- The computed heading `## Computed` and everything after it is script output; keep it last.

Example:

```markdown
## Food

- 08:00 example 1 serving  # overnight oats
- 12:30 banana 90g  # a banana

## Exercise

- 18:00 gym 60min  # gym, an hour
```

## Metrics block

`scripts/extract-data.js` feeds the chart and reads **only** the frontmatter. Every protocol
carries this block, written by `compute-day.js`:

```yaml
---
date: 2030-01-15
weight_kg: 79.3            # or null if not measured
metrics:
  status: closed           # closed | open | estimated
  maintenance_kcal: 1974.60
  deficit_kcal: 470.44
  intake_kcal: 2383.56     # null on estimated days
  burn_kcal: 416.33        # null on estimated days
  net_intake_kcal: 1967.23 # null on estimated days
---
```

- `maintenance_kcal` and `deficit_kcal` are required on every day. A null throws.
- Sign: a surplus is a negative deficit (`-317.51`). ASCII `-` only.
- `status`: `closed` (day finished, every item costed), `open` (still logging), `estimated`
  (away, deficit assumed). `open` and `estimated` show as hollow points on the chart.
- Numbers only: no units, no `~`, no bold. A trailing `# comment` is allowed.
- `check-protocols.js` fails when the block and the computed section disagree. Re-run
  `compute-day.js` and paste again.

## The math (done by the scripts)

- Weight for the day: mean of the weigh-ins in the 7 days ending that day; else the most recent
  earlier weigh-in; else `start_weight_kg`.
- BMR, Mifflin-St Jeor: `10 × kg + 6.25 × cm − 5 × age + 5` (male) or `− 161` (female).
- Maintenance: `BMR × activity_factor`. Net intake floor: `maintenance − max_deficit_kcal`.
- Burn per exercise: `MET × kg × hours`.
- Net intake: `intake − burn`. Deficit: `maintenance − net intake`.
- Protein floor / target / top and fat: g/kg × the day's weight. Carbs: the rest of maintenance.

Flags, and nothing else:

- Protein below the floor.
- Deficit above `max_deficit_kcal`. Equivalent: intake below `floor + burn`. Exercise raises the
  intake floor 1:1. The net intake floor stays the same.
- Weight stall: the 7-day mean is not below the 7-day mean three weeks earlier. Suggest
  reassessing the targets.

A deficit under the cap is the goal. Never flag it, never warn about eating below maintenance.

## Foods

`foods/foods.md` holds one table with the columns
`id | name | basis | kcal | fat_g | carbs_g | protein_g | fiber_g | notes`.

- `basis`: `100g`, `100ml`, or `pc` (values for one piece).
- `id`: lowercase ASCII letters, digits and `_`, unique across foods and recipes.
- A food not in the table: ask the user for kcal, fat, carbs, protein (and fibre if known) per
  100 g, 100 ml or per piece, ideally from the package label. Add the row, `notes` naming the
  source (`label`, `user`), then write the protocol line.

## Recipes

A composed dish the user eats more than once becomes `recipes/<id>.md`, built from
`templates/recipe.template.md`:

- Frontmatter: `id` (equals the filename), `name`, `yield_units`, `yield_count`,
  `serving_default`, and the per-serving totals `serving_kcal`, `serving_protein_g`,
  `serving_fat_g`, `serving_carbs_g` (bare numbers).
- Body: ingredient table with per-100 g values, per-ingredient totals
  (quantity / 100 × value per 100 g), batch totals and per-serving totals. Show the working.
- You compute these totals yourself; it is the only arithmetic you do. Double-check each sum.
- Ingredients stay inside the recipe file. They go into `foods/foods.md` only once the user
  eats them on their own.
- Protocol lines use the serving unit: `- 14:00 smoothie 1 serving`.

## Learning rules

When the user says "remember …", "from now on …", "always …" or similar:

- Anything with a number or an id goes to `habits.json`:
  - a food-name default or amount → `aliases`, e.g.
    `"bread": { "id": "rye_bread" }` or `"banana": { "id": "banana", "amount": 90, "unit": "g" }`
  - an activity or MET value → `activities`, e.g. `"swimming": { "met": 7.0 }`
  - something done every day → `daily_defaults`, a resolved protocol line plus its section:
    `{ "section": "exercise", "line": "- 07:00 walking 10min  # morning walk" }`
- Everything else (tone, report order, chart display, weigh-in habit) goes to `rules.md`.
- Run `node scripts/check-profile.js` after editing `habits.json`.
- Tell the user which file you wrote.
- A changed alias or default affects future days only. Never rewrite past protocols for it.

## Profile changes

`profile.json` changes only after the user confirms the exact new values. Run
`node scripts/check-profile.js` afterwards and show its output. A deficit cap above 500 kcal
always gets the warning from [the approach](#the-approach) first, then a second confirmation.

## The approach

Explain this during onboarding and whenever the user asks why:

- A moderate deficit, capped at 500 kcal a day by default. A deficit is the goal; only exceeding
  the cap is flagged. A bigger deficit is hard to keep up (most people give up within weeks) and
  makes muscle loss very likely, which defeats the goal.
- Exercise raises the intake floor one to one: eat back what you burn above the cap.
- Protein by bodyweight, from the day's weight: floor 1.0 g/kg (the only protein flag), target
  1.25 g/kg, top of the range 1.5 g/kg.
- Resistance training is the main signal to keep muscle. It is logged like any exercise.
- A daily weigh-in (morning, fasted, after the toilet, same conditions) is recommended, never
  required. The 7-day average matters, not single readings.
- Maintenance follows the 7-day average weight automatically. A stall of more than three weeks
  means it is time to reassess.
- The chart compares the actual weight with a theoretical weight from the summed deficits
  (7700 kcal per kg). A widening gap shows that estimates drift.
- No guessed macros: every item is costed or asked about.
- This is not medical advice.

## Onboarding

Ask questions in batches, not one by one. Keep it friendly and short.

1. **Trigger.** `profile.json` is missing or the user asks to start.
2. **Language.** If the folder `i18n/` exists, ask in both languages: "English or Deutsch?".
   Run `node scripts/set-language.js en` or `node scripts/set-language.js de`, then
   `git add -A && git commit -m "Choose language"`. For German, tell the user (in German) to start
   a new session and say "lass uns beginnen", because the German instructions load only on a
   fresh start. Stop there. If `i18n/` is gone, skip this step: the language is chosen. Later
   requests to switch get an explanation (the data is already in this language), no swap.
3. **Remote.** Run `git remote -v`. If `origin` points at `dxmann73/diet-assistant`, warn: this
   is the public template, and pushing personal health data there would publish it. Offer to
   rename it with `git remote rename origin template`. Do it on yes.
4. **Approach and disclaimer.** Explain [the approach](#the-approach) briefly and say clearly
   that this is not medical advice. Safety gate: ask whether the user is pregnant or
   breastfeeding. Once the body data from step 5.1 is in, also check age and BMI
   (`kg / (m × m)`). Stop with a pointer to a doctor if they are pregnant or breastfeeding,
   under 18, or have a BMI under 18.5. `check-profile.js` enforces age and BMI too.
5. **Questionnaire**, in batches:
   1. Body: sex (female/male, for the BMR formula), birth year, height in cm, current weight in kg.
   2. Daily life **without** exercise: desk job (1.2), on your feet most of the day (1.375),
      physical labour (1.55). Say that all exercise is logged separately. Never ask how much
      they exercise per week; that would count exercise twice.
   3. Deficit cap: default 500 kcal. Above 500: give the warning, then ask again.
   4. Protein floor / target / top in g/kg (defaults 1.0 / 1.25 / 1.5) and fat in g/kg (default
      0.8). Carbs are what is left.
   5. Diet style and exclusions (vegan, vegetarian, allergies). Record them in `rules.md`.
   6. Recurring habits: daily meals, drinks, walks as well as swimming, running/jogging, cycling
      and gym training with their MET values (show the defaults from
      `templates/habits.template.json`). A recurring meal becomes a recipe now: ask for each
      ingredient in grams and its values per 100 g from the label. The user may say "skip for
      now"; a skipped meal is not a daily default until its recipe exists.
   7. Food-name defaults, optional: what do "coffee", "bread", "cheese" … mean for them?
      Resolve to starter foods where they fit; ask label values for the rest.
   8. Weigh-in habit; away-day deficit (default 200 kcal); chart display: `inline-vis` (only if
      their agent supports it) or "open the file" (default).
6. **Write the files.** `profile.json` from `templates/profile.template.json` (inputs only; the
   `language` stays as the template has it); `habits.json` from `templates/habits.template.json`
   with their activities, daily defaults and aliases; `rules.md` from
   `templates/rules.template.md` with the placeholders replaced; recipes and new foods. Then run
   `node scripts/check-profile.js` and show its output: BMR, maintenance, floor and macro
   targets with working. Ask the user to confirm. On a change, edit and run it again.
7. **First day.** Run `node scripts/new-day.js $(date +%F)`. Onboarding ends only when
   `check-profile.js` passes. Commit: `git add -A && git commit -m "Set up profile"`.
8. **Later updates** ("update my profile"): change only what the user confirms, never overwrite
   silently, and run `check-profile.js` again.

## Reply style

Concise and plain, in the user's language. Show the script output that matters, not your own
arithmetic. `rules.md` can override this.
