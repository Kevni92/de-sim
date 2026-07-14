# Verbindlicher Entwicklungsablauf

Dieser Ablauf gilt für Menschen, Codex, Claude und andere Entwicklungsagenten. Er ersetzt keine fachliche Entscheidung, sondern stellt sicher, dass Änderungen nachvollziehbar, prüfbar und dokumentiert umgesetzt werden.

## 1. Grundregeln

1. **Das Repository beschreibt den Ist-Stand, das Issue den gewünschten Soll-Stand.** Vor einer Planung werden `main`, relevante offene Issues, Pull Requests, Tests und betroffene Dokumente geprüft.
2. **Fachliches Problem zuerst, Implementierung danach.** Neue Features, Modelländerungen, relevante Fehlerbehebungen und größere technische Umbauten benötigen vor dem ersten Code-Commit ein ausreichend beschriebenes Issue.
3. **Niemals direkt auf `main` arbeiten oder pushen.** Jede Änderung erfolgt auf einem eigenen Branch und gelangt ausschließlich über einen Pull Request nach `main`.
4. **Keine Abkürzung an der Architektur vorbei.** Vorhandene Grenzen zwischen UI, Fachlogik, Worker, Persistenz und Dokumentation bleiben erhalten.
5. **Dokumentation ist Teil des Features.** Veraltete technische oder fachliche Dokumentation blockiert den Abschluss.
6. **Politische Neutralität bleibt verbindlich.** Keine Empfehlung, Parteienbewertung oder versteckte normative Gewichtung implementieren.
7. **Keine Zugangsdaten einchecken.** Tokens, Schlüssel, lokale Umgebungsdateien und vertrauliche Daten gehören weder in Issues noch in Commits oder Dokumentation.

## 2. Von der Idee zum Issue

Vor dem Anlegen eines Issues wird der aktuelle Code gelesen. Bereits vorhandene Funktionen, offene Issues und bekannte Architekturentscheidungen werden nicht aus Erinnerung angenommen.

Ein umsetzungsbereites Issue enthält mindestens:

- **Problem und Ausgangslage** mit konkretem Ist-Stand,
- **Ziel** und erwarteten Nutzer- oder Entwicklernutzen,
- **Nicht-Ziele**, damit der Umfang begrenzt bleibt,
- **fachliches und technisches Konzept**,
- **Nutzerablauf, Zustände und Fehlerfälle**, wenn eine Oberfläche betroffen ist,
- **Akzeptanzkriterien** als überprüfbare Checkliste,
- **Testanforderungen**,
- **Auswirkung auf technische und fachliche Dokumentation**,
- **Abhängigkeiten, Reihenfolge und offene Fragen**.

Das Issue beschreibt das Ergebnis, nicht nur eine Dateiliste. Unklare fachliche Annahmen werden vor der Implementierung sichtbar gemacht.

## 3. Haupt-Issues und Unter-Issues

Größere Vorhaben werden in ein Haupt-Issue und unabhängig umsetzbare Unter-Issues zerlegt.

### Haupt-Issue

Das Haupt-Issue enthält:

- gemeinsames Zielbild und Nicht-Ziele,
- übergreifenden Nutzerablauf,
- gemeinsame Akzeptanzkriterien,
- Reihenfolge und Abhängigkeiten,
- Links auf alle Unter-Issues,
- Bedingungen für den Gesamtabschluss.

### Unter-Issue

Jedes Unter-Issue enthält:

- einen klar abgegrenzten Teil des Problems,
- einen Link auf das Haupt-Issue,
- eigene Akzeptanzkriterien und Tests,
- seine Abhängigkeiten,
- eine eigenständig prüfbare Definition of Done.

### Native Sub-Issues und aktueller Fallback

Native GitHub-Sub-Issues sind zu bevorzugen, sobald die verwendete GitHub-Integration die Aktionen zum Hinzufügen, Entfernen und Sortieren von Sub-Issues bereitstellt.

Falls die aktuell verwendete Agenten- oder Connector-Schnittstelle diese Aktion nicht anbietet, gilt folgender Fallback:

1. Die Unteraufgaben werden als normale Issues angelegt.
2. Im Body jedes Unter-Issues steht gut sichtbar `Übergeordnet: #<Nummer>` beziehungsweise der vollständige Link bei einem anderen Repository.
3. Das Haupt-Issue enthält eine nummerierte Liste oder Checkliste aller Unter-Issues mit Links und Umsetzungsreihenfolge.
4. Im Haupt-Issue wird ein Kommentar hinterlegt, der ausdrücklich erklärt, dass diese Issues die beabsichtigten Unter-Issues sind und die native Verknüpfung wegen der aktuell verwendeten Schnittstelle noch fehlt.
5. Der Kommentar nennt Abhängigkeiten und Integrationsreihenfolge, damit die Hierarchie auch ohne native Darstellung eindeutig bleibt.
6. Sobald die native API über das verwendete Werkzeug verfügbar ist, werden die vorhandenen Issues nativ verknüpft; es werden keine Duplikate angelegt. Der Fallback-Kommentar wird anschließend aktualisiert.

Empfohlene Form für den Kommentar:

```md
## Beabsichtigte Unter-Issues

Die folgenden Issues gehören fachlich und technisch zu diesem Haupt-Issue. Die aktuell verwendete GitHub-Schnittstelle bietet die native Sub-Issue-Aktion noch nicht an; deshalb ist die Hierarchie vorübergehend über Links dokumentiert.

1. #<Nummer> – <Titel>
2. #<Nummer> – <Titel>

Reihenfolge und Abhängigkeiten: ...
```

Ein fachliches Dokumentations-Issue im Repository `Kevni92/de-sim-docs` wird separat verlinkt und im Parent-Kommentar als Dokumentationsabhängigkeit genannt.

## 4. Branch anlegen

Der Branch wird erst nach dem Issue angelegt und basiert auf dem aktuellen `main`.

```bash
git switch main
git pull --ff-only
git submodule update --init --recursive
git switch -c feat/42-kurzer-name
```

Erlaubte Präfixe:

- `feat/<issue>-<kurzname>` für Features,
- `fix/<issue>-<kurzname>` für Fehlerbehebungen,
- `docs/<issue>-<kurzname>` für Dokumentation,
- `refactor/<issue>-<kurzname>` für technische Umbauten,
- `test/<issue>-<kurzname>` für reine Teständerungen,
- `chore/<issue>-<kurzname>` für klar abgegrenzte Wartung.

Die Issue-Nummer ist verpflichtend. Branches werden nicht von einem veralteten lokalen Stand abgezweigt. Direkte Commits oder Force-Pushes auf `main` sind verboten.

## 5. Vor der Implementierung

Vor Änderungen werden gelesen:

1. das Issue und gegebenenfalls Haupt- sowie abhängige Unter-Issues,
2. `AGENTS.md` und die Dokumente in `technical-docs/`,
3. die betroffenen Kapitel in `docs/reference/docs/`,
4. die aktuellen Implementierungsdateien und angrenzenden Tests,
5. bestehende Pull Requests oder Entscheidungen, die denselben Bereich betreffen.

Danach wird der kleinste architekturkonforme Änderungsweg gewählt. Neue Frameworks, globale Zustandslösungen, Router, Datenbanken oder parallele Modellpfade dürfen nicht ohne eigenes Konzept und dokumentierte Entscheidung eingeführt werden.

## 6. Implementierung

- Änderungen bleiben auf den Umfang des Issues begrenzt.
- Fachlogik wird als typisierte, möglichst reine und deterministische Logik in `src/lib/` umgesetzt.
- Wiederverwendbare UI-Bausteine liegen in `src/components/`; Seitenkomposition liegt in `src/pages/`.
- UI-Code greift niemals direkt auf IndexedDB zu. Persistenz und rechenintensive Abläufe laufen über die typisierten Clients und Worker.
- Zentraler Szenariozustand wird nicht durch unabhängige lokale Schattenzustände ersetzt.
- Neue Kennzahlen erhalten Datenjahr, Rechtsstand, Status, Konfidenz, Unsicherheit, Einschränkungen und Quellenbezug.
- Direkte, indirekte und langfristige Wirkungen bleiben getrennt; fehlende Evidenz darf als nicht seriös quantifizierbar ausgewiesen werden.
- Bedienung, Tastaturfokus, mobile Darstellung, Lade-, Leer- und Fehlerzustände werden mitgedacht.
- Bestehende Designmuster werden wiederverwendet; die visuelle Referenz bleibt `Kevni92/staat-sklarheit`.

## 7. Dokumentation im selben Arbeitsgang

### Technische Dokumentation

Ändert ein Feature Architektur, Stack, Ordnerstruktur, Datenfluss, Teststrategie, CI oder Arbeitsablauf, werden `AGENTS.md` beziehungsweise die betroffenen Dateien in `technical-docs/` **im selben App-Feature-Branch** aktualisiert.

### Fachliche Dokumentation

Ändert ein Feature Begriffe, Modelle, Quellen, Datenfelder, Rechtsstände, Unsicherheitsregeln oder fachliche Nutzerabläufe, wird parallel ein passender Branch und Pull Request im Repository `Kevni92/de-sim-docs` erstellt und im App-Issue sowie App-Pull-Request verlinkt. Das Submodul wird nicht als Ersatz für einen ordentlichen Docs-Branch direkt überschrieben.

Kann eine Dokumentationsänderung ausnahmsweise nicht im selben Pull Request enthalten sein, muss der verlinkte Docs-Pull-Request bereits existieren und der verbleibende Ablauf eindeutig dokumentiert sein.

## 8. Commits

Commits sind klein, fachlich zusammenhängend und verständlich benannt. Unabhängige Änderungen werden nicht vermischt. Beispiele:

```text
feat: Einkommensteuer-Auswertung erweitern (#42)
fix: fehlenden Bevölkerungslauf behandeln (#42)
docs: Agentenworkflow dokumentieren (#42)
```

Vor dem Commit werden Diff und Status geprüft. Keine Build-Ausgaben, Testberichte, Screenshots außerhalb vorgesehener Pfade, Zugangsdaten oder zufällige lokale Änderungen committen.

## 9. Tests und Abnahme

Die Prüfung richtet sich nach dem Risiko der Änderung. Auslassungen werden im Pull Request begründet.

### Reine Markdown-Änderung

- alle geänderten Dateien vollständig lesen,
- relative Links und referenzierte Pfade prüfen,
- Diff gegen `main` prüfen,
- bestätigen, dass keine Laufzeitdatei verändert wurde.

Typecheck und Build sind bei ausschließlich dokumentarischen Änderungen optional. Der Pull Request nennt ausdrücklich, dass sie nicht ausgeführt wurden und warum.

### Fachlogik, Typen oder Szenariovertrag

Mindestens:

```bash
npm run typecheck
npm run build
npm run test:unit
```

Neue oder geänderte Rechenregeln erhalten passende Unit-Tests. Schemaänderungen prüfen Normalisierung, Rückwärtskompatibilität sowie Import und Export.

### UI-Änderung

Zusätzlich:

```bash
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile-chromium
```

Erforderlich sind sichtbares Nutzerverhalten, Tastaturbedienung, relevante Lade-/Fehlerzustände und aktuelle Screenshots der geänderten Oberfläche. Playwright-Tests dürfen nicht ausschließlich Implementierungsdetails prüfen.

### Worker, Persistenz oder Bevölkerungsläufe

Zusätzlich zu Unit-Tests werden Wiederherstellung, Reload, fehlende Referenzen, Serialisierung und relevante End-to-End-Abläufe geprüft. Die UI darf dabei weiterhin nur über den typisierten Client kommunizieren.

### CI

Die GitHub-Actions-Qualitätsprüfung führt Typecheck, Build und Unit-Tests aus. Die vollständigen Playwright-Tests laufen derzeit für Nicht-Draft-Pull-Requests und Pushes auf `main`. Ein Draft darf deshalb nicht allein wegen noch nicht gestarteter E2E-Prüfung als vollständig abgenommen gelten.

## 10. Pull Request

Der Branch wird gepusht und standardmäßig als Draft-Pull-Request gegen `main` geöffnet. Der Pull Request enthält:

- Verknüpfung zum Issue, vorzugsweise `Closes #<Nummer>`,
- fachliche und technische Zusammenfassung,
- Begründung und Auswirkung für Nutzer oder Entwickler,
- wichtige Architekturentscheidungen,
- ausgeführte Tests mit Ergebnis,
- nachvollziehbare manuelle Prüfschritte,
- Screenshots bei sichtbaren UI-Änderungen,
- Link auf den fachlichen Docs-Pull-Request oder eine begründete Aussage, warum keiner nötig ist,
- bekannte Grenzen, Risiken und offene Folgearbeiten.

Der Pull Request wird erst auf „Ready for review“ gesetzt, wenn Implementierung, Tests und Dokumentation vollständig sind.

## 11. Review, CI und Merge

- Review-Kommentare werden verstanden und gezielt umgesetzt; keine pauschalen Änderungen ohne Prüfung.
- Jede Änderung nach Review wird erneut passend getestet.
- Fehlgeschlagene CI-Prüfungen werden behoben, nicht umgangen oder deaktiviert.
- Ein Pull Request mit veralteter Dokumentation, roten Pflichtprüfungen oder unerfüllten Akzeptanzkriterien wird nicht gemergt.
- Merge erfolgt ausschließlich über GitHub nach Review. Danach wird der Feature-Branch gelöscht und das Issue erst geschlossen, wenn seine Abschlussbedingungen erfüllt sind.

## 12. Definition of Done

Eine Änderung ist abgeschlossen, wenn:

- [ ] Issue und gegebenenfalls Unter-Issues den tatsächlichen Umfang widerspiegeln,
- [ ] kein direkter Commit auf `main` erfolgt ist,
- [ ] die Implementierung die bestehende Architektur einhält,
- [ ] alle erforderlichen Tests erfolgreich sind,
- [ ] sichtbare Änderungen manuell und bei Bedarf per Screenshot geprüft sind,
- [ ] technische Dokumentation im App-Branch aktuell ist,
- [ ] fachliche Dokumentation aktualisiert und verlinkt ist oder nachvollziehbar nicht betroffen ist,
- [ ] der Pull Request alle Akzeptanzkriterien erfüllt,
- [ ] CI und Review abgeschlossen sind.
