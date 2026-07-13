# AGENTS.md

## Projektziel

Dieses Repository enthält die Anwendung **Deutschland-Simulator**. Das verbindliche fachliche Pflichtenheft und Research Briefing liegt im separaten Repository:

- Dokumentation: https://github.com/Kevni92/de-sim-docs
- Lokales Submodul: `docs/reference`

## Verbindliche Arbeitsregeln

1. Vor fachlichen Änderungen die betroffenen Kapitel in `docs/reference/docs/` lesen.
2. Änderungen an Begriffen, Modellen, Quellen, Datenfeldern, Unsicherheitsregeln oder Nutzerflüssen müssen im selben Arbeitsgang im Dokumentationsrepository aktualisiert werden. Dafür ist ein eigener, verlinkter Docs-PR zulässig.
3. Das Design und Interaktionsmuster aus `Kevni92/staat-sklarheit` ist die visuelle Referenz. Insbesondere beibehalten: neutrales Türkis, flache Karten, kleine Radien, Drei-Spalten-Dashboard, tabellarische Einnahmen/Ausgaben und Quellen-Drawer.
4. Die Oberfläche darf nicht direkt auf IndexedDB zugreifen. Quellen und Szenarien laufen über den typisierten `LocalServerClient` und den Web Worker. Diese Grenze wird später durch einen echten Server ersetzt.
5. Keine Kennzahl ohne Datenjahr, Status, Unsicherheit und Quelle. Demonstrationswerte müssen sichtbar als Demo gekennzeichnet sein.
6. Keine politische Empfehlung, Parteienbewertung oder versteckte Gewichtung.

## Pull Requests

Jeder PR enthält:

- kurze fachliche und technische Zusammenfassung,
- nachvollziehbare Schritte für einen manuellen UI-Test,
- Ergebnis von Typecheck, Build und Playwright,
- bei sichtbaren UI-Änderungen einen aktuellen Screenshot,
- Hinweis auf den zugehörigen Docs-PR oder die Begründung, warum keine Dokumentationsänderung nötig ist.

## Tests

Vor Freigabe mindestens ausführen:

```bash
npm run typecheck
npm run build
npm run test:e2e -- --project=chromium
```

Playwright-Tests prüfen sichtbares Nutzerverhalten und dürfen sich nicht ausschließlich auf Implementierungsdetails stützen.
