# diet-assistant

Ein KI-Agent, der dir hilft, Fett abzubauen und Muskeln zu erhalten. Du sagst ihm in einfachen
Worten, was du gegessen und wie du dich bewegt hast. Er führt ein tägliches Protokoll in Markdown,
führt kleine Node-Skripte für die Berechnungen aus und sagt dir, wo du stehst.

**Keine medizinische Beratung.** Dies ist ein Werkzeug zum Protokollieren, keine Diagnose oder
Behandlung. Sprich mit einem Arzt, bevor du eine Diät beginnst, besonders bei einer Erkrankung.
Es ist nicht für Menschen unter 18, Schwangere, Stillende oder Menschen mit einem BMI unter 18.5
geeignet.

## Für Agenten: Einrichtung über diese URL

Ein Nutzer hat dir diese URL gegeben und möchte eine eigene Kopie. Frage nach einem Ordnernamen
(Standard `my-diet`), dann:

1. Wenn du über `gh` angemeldet bist (`gh auth status`):
   `gh repo create <name> --private --template dxmann73/diet-assistant --clone`.
2. Ohne `gh` oder ohne GitHub-Konto:
   `git clone https://github.com/dxmann73/diet-assistant <name>`, dann sofort
   `git -C <name> remote rename origin template`. Sage dem Nutzer, dass sein Protokoll lokal
   bleibt, bis er ein eigenes privates entferntes Repository hinzufügt.
3. Erstelle niemals einen Fork dieses Repositorys. Übertrage niemals mit Push an
   `dxmann73/diet-assistant`.
4. Führe `cd <name>` aus und befolge die dortige `AGENTS.md`, die die Einrichtung startet. Wenn
   du `AGENTS.md` nur beim Sitzungsstart lädst, bitte den Nutzer, dich in diesem Ordner neu zu
   starten und „initialize“ zu sagen.

## Erste Schritte

1. Öffne einen beliebigen KI-Programmieragenten (zum Beispiel Codex oder Claude Code) in einem
   leeren Ordner und sage
   `Richte mir https://github.com/dxmann73/diet-assistant ein`
   (alternativ auf Englisch: `Set me up with https://github.com/dxmann73/diet-assistant`).
2. Der Agent erstellt deine eigene private Kopie und beginnt mit der Einrichtung: Er fragt nach
   deiner Sprache, erklärt die Methode und führt dich durch einen kurzen Fragebogen. Manche
   Agenten müssen zuerst im neuen Ordner neu gestartet werden; sage danach „initialize“.
3. Erzähle ihm danach einfach, was du gegessen und gemacht hast: „Frühstück 08:00, 60 g
   Haferflocken mit 200 g Joghurt“, „40 Minuten spazieren gegangen“, „heute berechnen“.

Deine Kopie muss privat sein und darf niemals ein Fork sein: Dein Protokoll enthält
Gesundheitsdaten, und ein Fork eines öffentlichen Repositorys ist öffentlich.

## Die Methode

- **Mäßiges Defizit mit Obergrenze.** Die Obergrenze beträgt standardmäßig 500 kcal am Tag.
  Unter dem Erhaltungsbedarf zu essen ist das Ziel; nur das Überschreiten der Obergrenze führt
  zu einer Warnung. Ein größeres Defizit ist schwer durchzuhalten. Die meisten geben nach
  wenigen Wochen auf, und Muskelverlust wird sehr wahrscheinlich. Das verfehlt das Ziel.
- **Sport erhöht die Untergrenze.** Jede beim Sport verbrauchte kcal erhöht die Untergrenze
  der Aufnahme um eins. Die Netto-Aufnahme-Untergrenze bleibt gleich.
- **Eiweiß nach Körpergewicht.** Untergrenze 1.0 g/kg (die einzige Eiweißwarnung), Ziel
  1.25 g/kg, Obergrenze des Bereichs 1.5 g/kg, anhand des Gewichts für den Tag.
- **Krafttraining** ist das wichtigste Signal, um Muskeln zu erhalten. Protokolliere es wie
  jede sportliche Aktivität.
- **Sportarten.** Schwimmen, Laufen/Joggen, Fahrradfahren und Training im Fitnessstudio werden
  protokolliert. Tempo, Intensität und Trainingsart bestimmen den passenden MET-Wert.
- **Wiegen.** Tägliches Wiegen (morgens, nüchtern, unter gleichen Bedingungen) wird empfohlen,
  ist aber nie Pflicht. Das 7-Tage-Mittel zählt, nicht einzelne Messwerte.
- **Der Erhaltungsbedarf folgt deinem Gewicht.** Er wird täglich aus dem 7-Tage-Mittel neu
  berechnet. Wenn das Mittel drei Wochen lang nicht gesunken ist, schlägt der Agent vor, die
  Ziele zu überprüfen.
- **Diagramm.** Tatsächliches Gewicht im Vergleich zu einem theoretischen Gewicht aus den
  aufsummierten Defiziten (7700 kcal pro kg). Ein wachsender Abstand zeigt, dass die Schätzungen
  abweichen.
- **Keine Schätzungen ins Blaue.** Die Werte jedes Lebensmittels stammen aus der Datenbank oder
  werden erfragt.

## So funktioniert es (mit wenig Code)

Der Agent versteht dich; die Skripte rechnen.

- Der Agent wandelt deine Worte in eindeutig zugeordnete Zeilen in `protocols/YYYY-MM-DD.md` um,
  fragt bei Unbekanntem nach und ergänzt neue Lebensmittel in `foods/foods.md`.
- `scripts/compute-day.js` berechnet den Tag: Grundumsatz (BMR, Mifflin-St Jeor),
  Erhaltungsbedarf, Aufnahme, Verbrauch Sport (MET × kg × hours), Defizit, Nährstoffziele und
  Warnungen, jeweils mit Rechenweg. Der Agent fügt die Ausgabe ins Protokoll ein und ändert nie
  die Zahlen.
- `scripts/check-protocols.js` erkennt Protokolle, deren Zusammenfassung und Zahlen nicht
  übereinstimmen; `scripts/gen-chart-cdn.js` zeichnet `charts/chart-cdn.html`.
- Deine Einstellungen stehen in drei Dateien, die der Agent bei der Einrichtung schreibt:
  `profile.json` (Körperdaten und Ziele), `habits.json` (MET-Werte für Sport, tägliche
  Standardeinträge, was „eine Banane“ für dich bedeutet), `rules.md` (Vorlieben wie der
  Antwortstil).

Alles ist einfaches Markdown und JSON und auch ohne den Agenten lesbar. Node 20 oder neuer,
keine Abhängigkeiten.

## Dateien

```text
AGENTS.md            Anweisungen für den Agenten
profile.json         deine Körperdaten und Ziele (bei der Einrichtung erstellt)
habits.json          MET-Werte, tägliche Standardeinträge, Aliasnamen (bei der Einrichtung erstellt)
rules.md             deine Vorlieben (bei der Einrichtung erstellt)
foods/foods.md       Lebensmitteldatenbank, beginnt mit 15 Grundnahrungsmitteln
recipes/             zusammengesetzte Gerichte, je eine Datei
protocols/           eine Datei pro Tag
charts/              das Diagramm zum Gewichtsverlauf
scripts/             die Berechnungen
templates/           Vorlagen für die obigen Dateien
test/                Tests für die Skripte
```

## Tests

```sh
node --test
```

## Datenquellen

Die Ausgangswerte in `foods/foods.md` stammen aus dem Bundeslebensmittelschlüssel (BLS),
Version 4.0, veröffentlicht vom Max Rubner-Institut, lizenziert unter
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):

> Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 - Deutsche
> Nährstoffdatenbank. Karlsruhe. DOI:
> [10.25826/Data20251217-134202-0](https://doi.org/10.25826/Data20251217-134202-0)

BLS-Webseite: <https://www.blsdb.de/>. Änderungen: 15 Lebensmittel wurden ausgewählt. Verwendet
werden nur Energie, Fett, verfügbare Kohlenhydrate, Eiweiß und Gesamtballaststoffe pro 100 g,
gerundet auf ganze kcal und eine Nachkommastelle. Jede Zeile nennt ihren BLS-Code.

## Lizenz

MIT, siehe `LICENSE`. Die BLS-Daten behalten ihre Lizenz CC BY 4.0.
