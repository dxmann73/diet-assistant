'use strict';
// Status and warning lines of the CLI scripts follow profile.json language.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { REPO, enRoot, deRoot, writeProtocol, computeAndPaste } = require('./helpers');

function run(script, root, ...args) {
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', script), ...args, '--root', root], {
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Two closed days with a gap between them, the first without a weigh-in.
function twoDays(root, language) {
  writeProtocol(root, '2030-01-13', { language, status: 'closed' });
  computeAndPaste(root, '2030-01-13', language);
  writeProtocol(root, '2030-01-15', { language, status: 'closed', weight: 70.0 });
  computeAndPaste(root, '2030-01-15', language);
}

test('English: new-day, check-protocols and gen-chart lines', () => {
  const root = enRoot();
  assert.deepEqual(run('new-day.js', root, '2030-01-10'), {
    code: 0,
    stdout: 'Wrote protocols/2030-01-10.md\n',
    stderr: '',
  });
  fs.rmSync(path.join(root, 'protocols', '2030-01-10.md'));
  twoDays(root, 'en');
  assert.equal(run('check-protocols.js', root).stdout, 'OK: 2 protocols, frontmatter matches body\n');
  const chart = run('gen-chart-cdn.js', root);
  assert.equal(chart.code, 0);
  assert.equal(chart.stdout, 'Wrote charts/chart-cdn.html\n');
  assert.match(chart.stderr, /^WARN: 1 day\(s\) with no protocol file, charted at the 200 kcal away-day assumption: 2030-01-14$/m);
  assert.match(chart.stderr, /^WARN: implausible deficit\(s\), verify the block: 2030-01-13=2016/m);
});

test('German: new-day, check-protocols and gen-chart lines', () => {
  const root = deRoot();
  assert.equal(run('new-day.js', root, '2030-01-10').stdout, 'protocols/2030-01-10.md geschrieben\n');
  fs.rmSync(path.join(root, 'protocols', '2030-01-10.md'));
  twoDays(root, 'de');
  assert.equal(
    run('check-protocols.js', root).stdout,
    'OK: 2 Protokolle, Frontmatter passt zum berechneten Abschnitt\n'
  );
  const chart = run('gen-chart-cdn.js', root);
  assert.equal(chart.code, 0);
  assert.equal(chart.stdout, 'charts/chart-cdn.html geschrieben\n');
  assert.match(
    chart.stderr,
    /^WARNUNG: 1 Tag\(e\) ohne Protokolldatei, im Diagramm mit der Abwesenheits-Annahme von 200 kcal: 2030-01-14$/m
  );
  assert.match(chart.stderr, /^WARNUNG: unplausibles Defizit, bitte den metrics-Block prüfen: 2030-01-13=/m);
});

test('open days skip the implausible-deficit warning', () => {
  const root = enRoot();
  writeProtocol(root, '2030-01-13', { language: 'en', status: 'open' });
  computeAndPaste(root, '2030-01-13', 'en');
  const chart = run('gen-chart-cdn.js', root);
  assert.equal(chart.code, 0);
  assert.doesNotMatch(chart.stderr, /implausible/);
});

test('German: no weigh-in warning', () => {
  const root = deRoot();
  writeProtocol(root, '2030-01-15', { language: 'de', status: 'estimated', metrics: { deficit_kcal: 300 } });
  computeAndPaste(root, '2030-01-15', 'de');
  assert.match(
    run('gen-chart-cdn.js', root).stderr,
    /^WARNUNG: noch kein Wiegen; das Diagramm bleibt bis zum ersten Wiegen leer$/m
  );
});

test('a missing or invalid language fails fast; errors stay English', () => {
  const root = enRoot();
  twoDays(root, 'en');
  const file = path.join(root, 'profile.json');
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...profile, language: 'fr' }));
  for (const script of ['check-protocols.js', 'gen-chart-cdn.js']) {
    const r = run(script, root);
    assert.equal(r.code, 1, script);
    assert.match(r.stderr, /language must be one of en\|de, got "fr"/, script);
  }
  delete profile.language;
  fs.writeFileSync(file, JSON.stringify(profile));
  const r = run('new-day.js', root, '2030-01-20');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /missing key language/);
});
