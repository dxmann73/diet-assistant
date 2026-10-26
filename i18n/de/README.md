# diet-assistant

Ein KI-Agent, der dir hilft, dein Wunschgewicht zu erreichen, ohne einfach nur zu hungern: Fett
abbauen, Muskeln erhalten. Du sagst ihm in einfachen Worten, was du gegessen und wie du dich
bewegt hast. Er führt ein tägliches Protokoll in Markdown, führt kleine Node-Skripte für die
Berechnungen aus und sagt dir, wo du stehst.

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
   deiner Sprache, erklärt die Methode und stellt fünf kurze Fragen (Geschlecht, Geburtsjahr,
   Größe, Gewicht, Alltag). Alles andere lernt er unterwegs. Manche Agenten müssen zuerst im
   neuen Ordner neu gestartet werden; sage danach „initialize“.
3. Erzähle ihm danach einfach, was du gegessen und gemacht hast: „Frühstück 08:00, 60 g
   Haferflocken mit 200 g Joghurt“, „40 Minuten spazieren gegangen“, „heute berechnen“.

Deine Kopie muss privat sein und darf niemals ein Fork sein: Dein Protokoll enthält
Gesundheitsdaten, und ein Fork eines öffentlichen Repositorys ist öffentlich.

## Die Methode

Ziel ist, dein Wunschgewicht zu erreichen, ohne einfach nur zu hungern. Wer nur hungert, bringt
den Körper dazu, seinen Energieverbrauch zu senken und, wenn er sich wenig bewegt, Muskeln
abzubauen. Drei Grundsätze:

1. **Höchstens 500 kcal Defizit am Tag.** So bleibt es erträglich, und du hältst durch.
2. **Iss immer mindestens deinen Grundumsatz** (das, was der Körper in Ruhe verbraucht).
3. **Beweg dich jeden Tag so viel wie möglich**, um die 500 kcal zu erreichen. Wenn du dich
   mehr bewegst, iss so viel, dass das Defizit bei höchstens 500 kcal bleibt.

Der Grund: Bei 500 kcal bleibt der Hunger begrenzt und auch über längere Zeit erträglich, und
der Körper baut kaum oder gar keine Muskeln ab.

- **Wiegen.** Morgens, nüchtern, nach dem Toilettengang, immer unter gleichen Bedingungen. Das
  Gewicht schwankt von Tag zu Tag, oft um ein Kilo oder mehr, vor allem durch Wasser.
  Das ist völlig normal und kein Grund zur Sorge. Es zählt das 7-Tage-Mittel.
- **Schätzen ist erlaubt.** An Tagen, an denen du dich nicht wiegen kannst, auswärts isst oder
  zu einem Essen oder einer Feier eingeladen bist: einfach schätzen und es nicht zu genau
  nehmen. Die Methode ist auf lange Sicht angelegt.
- **Eiweiß und Fett.** Empfohlen ist mindestens 1.0 g Eiweiß pro kg Körpergewicht (Ziel
  1.25 g/kg, Obergrenze 1.5 g/kg). Der Grund ist, dass viele Menschen zu wenig Eiweiß essen
  und wir insbesondere beim Abnehmen auf ausreichende Eiweißzufuhr achten sollten, um
  Muskelverlust zu vermeiden. Für Fett sind es 0.8 g pro kg.
- **Das Kaloriendefizit ist eine Vorgabe.** Die 500 kcal stehen in `profile.json`
  (`max_deficit_kcal`) und können dort geändert werden.

## Das Diagramm

![Tatsächliches und theoretisches Gewicht über fünf Monate](docs/chart-example.png)

Ein echtes Protokoll über fünf Monate (Beschriftung auf Englisch). Das Diagramm hat zwei Linien:

- **Theoretisches Gewicht** (blau, gestrichelt): beginnt beim ersten Wiegen und sinkt um das
  berechnete Defizit jedes Tages, mit 7700 kcal pro kg. Das Defizit ergibt sich aus dem
  Erhaltungsbedarf (Grundumsatz × Aktivitätsfaktor für deinen Alltag) minus dem, was du
  gegessen hast, plus dem Verbrauch beim Sport. Gefüllte Punkte sind abgeschlossene Tage, hohle
  Punkte offene oder geschätzte Tage.
- **Tatsächliches Gewicht** (grün): deine morgendlichen Wiegewerte.

Einzelne Werte schwanken mit Wasser und Essen; es zählt der Verlauf. Laufen die beiden Linien
über Wochen auseinander, stimmen die Schätzungen nicht (zum Beispiel der Aktivitätsfaktor oder
die Portionsgrößen), und es ist Zeit, sie zu überprüfen. (Die dünne orange Linie bei 80 kg ist
eine persönliche Ziellinie aus diesem Protokoll; sie gehört nicht zur Vorlage.)

## So funktioniert es (mit wenig Code)

Der Agent versteht dich; die Skripte rechnen.

- Der Agent wandelt deine Worte in eindeutig zugeordnete Zeilen in `protocols/YYYY-MM-DD.md` um,
  fragt bei Unbekanntem nach und ergänzt neue Lebensmittel in `foods/foods.md`.
- `scripts/compute-day.js` berechnet den Tag: Grundumsatz (BMR, Mifflin-St Jeor),
  Erhaltungsbedarf, Aufnahme, Verbrauch Sport (MET × kg × hours), Defizit, Nährstoffziele und
  Warnungen, jeweils mit Rechenweg. Der Agent fügt die Ausgabe ins Protokoll ein und ändert nie
  die Zahlen. Der Erhaltungsbedarf folgt dem 7-Tage-Mittel des Gewichts.
- `scripts/check-protocols.js` erkennt Protokolle, deren Zusammenfassung und Zahlen nicht
  übereinstimmen; `scripts/gen-chart-cdn.js` zeichnet `charts/chart-cdn.html`.
- Deine Einstellungen stehen in drei Dateien, die der Agent bei der Einrichtung schreibt:
  `profile.json` (Körperdaten und Ziele), `habits.json` (MET-Werte für Sport, tägliche
  Standardeinträge, was „eine Banane“ für dich bedeutet), `rules.md` (Vorlieben wie der
  Antwortstil). Wiederholt sich eine Mahlzeit oder Aktivität, bietet der Agent an, daraus ein
  Rezept oder einen täglichen Standardeintrag zu machen.

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
docs/                das Bild für die README
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
