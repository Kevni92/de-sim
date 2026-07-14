# Automatische synthetische Modellbasis

Dieses Dokument beschreibt die technische Umsetzung der automatisch bereitgestellten synthetischen Bevölkerung aus Issue #35. Die fachliche Bedeutung, Quellen und Modellgrenzen liegen im Dokumentationsrepository.

## Zuständigkeiten

- `src/lib/population-basis.ts` definiert Standardparameter, deterministische Lauf-ID und den rekonstruierbaren Referenzvertrag.
- `src/lib/scenario-state.ts` speichert die Modellbasis ab Schema-Version 5 im zentralen Szenariozustand und migriert ältere Referenzen ohne erfundene Rekonstruktionsdaten.
- `src/lib/local-server-client.ts` stellt typisierte Aktionen für Standardbasis und identische Rekonstruktion bereit.
- `src/workers/population.worker.ts` sucht vorhandene Läufe, erzeugt fehlende Läufe deterministisch, aktiviert sie und verwaltet IndexedDB.
- `src/App.tsx` orchestriert Laden, Fehlerzustände, Szenarioreferenz und bewusste Nutzerentscheidungen.
- `src/components/ModelBasisStatus.tsx` zeigt in Reformansichten ausschließlich verständliche Zustände und Aktionen.
- `src/pages/PopulationPage.tsx` bleibt die erweiterte Prüfebene für IDs, Seed, Stichprobengröße, Kalibrierung und Laufverwaltung.

## Standardbasis

Die Standardparameter sind zentral und unveränderlich definiert:

```text
Seed: de-sim-2025
Stichprobengröße: 10.000
Baseline: de-2024-2025-v1
Modellversion: synthetic-population-0.7.0
```

Die Lauf-ID wird aus Seed, normalisierter Stichprobengröße, Baseline und Modellversion deterministisch abgeleitet. Der Worker prüft zuerst, ob genau dieser Lauf lokal gespeichert ist. Ein vorhandener Lauf wird aktiviert und wiederverwendet. Nur wenn er fehlt, wird er neu erzeugt.

## Szenariovertrag

Schema-Version 5 ergänzt `populationBasis`:

```text
runId
modelVersion
seed
sampleSize
baselineId
```

`populationRunId` und `populationModelVersion` bleiben vorerst für bestehende Verträge erhalten und werden mit `populationBasis` synchronisiert. Die SGB-II-Referenz zeigt auf dieselbe Lauf-ID.

Ältere Szenarien mit ausschließlich Lauf-ID und Modellversion werden als partielle Referenz normalisiert. Seed, Stichprobengröße und Baseline bleiben `null`; die Anwendung darf daraus keine Rekonstruktionsparameter erfinden.

## Ladeablauf

1. Eine Reformseite fordert erstmals eine Bevölkerung an.
2. Besitzt das Szenario eine Referenz, versucht der Worker exakt diesen Lauf zu aktivieren.
3. Besitzt das Szenario keine Referenz, wird `population:ensure-standard` aufgerufen.
4. Der geladene oder erzeugte Lauf wird als vollständige Referenz in das Szenario übernommen.
5. Einkommensteuer- und SGB-II-Berechnung verwenden die aktive Lauf-ID.

Die Bevölkerungsseite muss für diesen Ablauf nicht geöffnet werden.

## Fehlende Referenz

Ein fehlender referenzierter Lauf wird niemals durch den aktiven oder den Standardlauf ersetzt.

### Identische Rekonstruktion

`population:reconstruct` ist nur zulässig, wenn:

- alle Generationsparameter vorhanden sind,
- die Modellversion der aktuellen Version entspricht,
- die aus den Parametern berechnete Lauf-ID exakt der gespeicherten Lauf-ID entspricht.

Andernfalls lehnt der Worker die Rekonstruktion ab.

### Bewusster Basiswechsel

Für partielle oder veraltete Referenzen bietet die UI ausschließlich den bewussten Wechsel zur Standardbasis an. Erst die Nutzeraktion aktualisiert Bevölkerung-, Modell- und SGB-II-Referenz im Szenario.

## UI-Zustände

`ModelBasisStatus` unterscheidet:

- `preparing`
- `ready`
- `warning`
- `missing`
- `error`

Die Standardansicht zeigt keine Lauf-ID, keinen Seed, keine Stichprobengröße und keine interne Modellversion. Technische Details liegen in der erweiterten Prüfebene.

## Persistenz und Löschung

Läufe, Personen, Haushalte, SGB-II-Profile, Kalibrierung und Validierung liegen in getrennten IndexedDB-Stores. Wird der aktuell referenzierte Lauf gelöscht, bleibt die Szenarioreferenz erhalten. Dadurch wechselt die Oberfläche in den Zustand `missing` und kann die ursprüngliche Basis gegebenenfalls identisch rekonstruieren.

## Tests

Verpflichtend sind:

- Unit-Tests für stabile Lauf-ID, Referenzvalidierung, Schema-Migration und JSON-Rundlauf,
- Playwright-Einstieg in Einkommensteuer und Bürgergeld ohne manuellen Bevölkerungsschritt,
- Wiederverwendung des Standardlaufs nach Reload,
- identische Rekonstruktion eines gelöschten Laufs,
- bewusster Wechsel bei nicht rekonstruierbaren Altimporten,
- Export der vollständigen Referenz,
- Desktop- und Mobilprüfung sowie Screenshots.
