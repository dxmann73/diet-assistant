# diet-assistant

An AI agent that helps you lose fat while keeping muscle. You tell it what you ate and how you
moved, in plain words. It keeps a daily log in Markdown, runs small Node scripts for the math,
and tells you where you stand.

**Not medical advice.** This is a tracking tool, not a diagnosis or a treatment. Talk to a doctor
before you start a diet, especially with a health condition. It is not for people under 18,
people who are pregnant or breastfeeding, or people with a BMI under 18.5.

## For agents: setting up from this URL

A user handed you this URL and wants their own copy. Ask for a folder name (default `my-diet`),
then:

1. With `gh` logged in (`gh auth status`):
   `gh repo create <name> --private --template dxmann73/diet-assistant --clone`.
2. Without `gh` or without a GitHub account:
   `git clone https://github.com/dxmann73/diet-assistant <name>`, then right away
   `git -C <name> remote rename origin template`. Tell the user their log stays local until they
   add a private remote of their own.
3. Never fork this repo. Never push to `dxmann73/diet-assistant`.
4. `cd <name>` and follow its `AGENTS.md`, which starts onboarding. If you load `AGENTS.md` only
   at session start, ask the user to restart you in that folder and say "initialize".

## Get started

1. Open any AI coding agent (for example Codex or Claude Code) in an empty folder and say
   `Set me up with https://github.com/dxmann73/diet-assistant`
   (German: `Richte mir https://github.com/dxmann73/diet-assistant ein`).
2. The agent makes your own private copy and starts onboarding: it asks for your language,
   explains the approach, and walks you through a short questionnaire. Some agents need a
   restart in the new folder first; then say "initialize".
3. From then on, just tell it what you ate and did: "Breakfast 08:00, 60 g oats with 200 g
   yogurt", "walked 40 minutes", "compute today".

Your copy must be private, never a fork: your log is health data, and a fork of a public repo is
public.

## The approach

- **Moderate deficit, capped.** Default cap 500 kcal a day. Eating below maintenance is the goal;
  only exceeding the cap is flagged. A bigger deficit is hard to keep up, most people give up
  within a few weeks, and it makes muscle loss very likely, which defeats the goal.
- **Exercise raises the floor.** Every kcal burned in exercise raises the intake floor by one.
  The net intake floor stays the same.
- **Protein by bodyweight.** Floor 1.0 g/kg (the only protein flag), target 1.25 g/kg, top of the
  range 1.5 g/kg, from the day's weight.
- **Resistance training** is the main signal to keep muscle. Log it like any exercise.
- **Sports.** Swimming, running/jogging, cycling and gym training are logged. Pace, intensity
  and type of training set the matching MET value.
- **Weigh-ins.** A daily weigh-in (morning, fasted, same conditions) is recommended, never
  required. The 7-day average counts, not single readings.
- **Maintenance follows your weight.** It is recomputed daily from the 7-day average. When the
  average has not dropped for three weeks, the agent suggests reassessing.
- **Chart.** Actual weight against a theoretical weight from the summed deficits
  (7700 kcal per kg). A widening gap means the estimates drift.
- **No guessing.** Every food is costed from the database or asked about.

## How it works (low code)

The agent understands you; the scripts do the arithmetic.

- The agent turns your words into resolved lines in `protocols/YYYY-MM-DD.md`, asks about
  anything unknown, and adds new foods to `foods/foods.md`.
- `scripts/compute-day.js` computes the day: BMR (Mifflin-St Jeor), maintenance, intake, burn
  (MET × kg × hours), deficit, macro targets and flags, all with the working shown. The agent
  pastes its output into the log and never edits the numbers.
- `scripts/check-protocols.js` catches logs whose summary and numbers disagree;
  `scripts/gen-chart-cdn.js` draws `charts/chart-cdn.html`.
- Your settings live in three files the agent writes during onboarding: `profile.json` (body data
  and targets), `habits.json` (exercise MET values, daily defaults, what "a banana" means for
  you), `rules.md` (preferences such as reply style).

Everything is plain Markdown and JSON, readable without the agent. Node 20 or newer, no
dependencies.

## Files

```text
AGENTS.md            instructions for the agent
profile.json         your body data and targets (created at onboarding)
habits.json          MET values, daily defaults, aliases (created at onboarding)
rules.md             your preferences (created at onboarding)
foods/foods.md       food database, starts with 15 staples
recipes/             composed dishes, one file each
protocols/           one file per day
charts/              the weight chart
scripts/             the math
templates/           starting points for the files above
test/                tests for the scripts
```

## Tests

```sh
node --test
```

## Data sources

The starter values in `foods/foods.md` come from the Bundeslebensmittelschlüssel (BLS),
Version 4.0, published by the Max Rubner-Institut, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):

> Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 - Deutsche
> Nährstoffdatenbank. Karlsruhe. DOI:
> [10.25826/Data20251217-134202-0](https://doi.org/10.25826/Data20251217-134202-0)

BLS website: <https://www.blsdb.de/>. Changes: 15 foods were selected, and only energy, fat,
available carbohydrates, protein and total fibre per 100 g are used, rounded to whole kcal and
one decimal. Each row names its BLS code.

## License

MIT, see `LICENSE`. The BLS data keeps its CC BY 4.0 licence.
