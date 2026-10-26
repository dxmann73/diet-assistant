# Personal rules

Your preferences. They override the defaults in `AGENTS.md`. The assistant adds a rule here when
you teach it something without a number or an id ("from now on, …", "remember that …"). Rules
with a number or an id (amounts, MET values, daily defaults) go to `habits.json` instead.

## Reply style

- Concise and plain.

## Report order

In every report:

1. The chart: inline if the agent can show it, otherwise a pointer to `charts/chart-cdn.html`.
2. Open questions, all in one batch. Skip this when there are none.
3. The day's deficit, then the rest of the balance.
