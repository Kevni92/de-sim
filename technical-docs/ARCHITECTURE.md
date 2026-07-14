# Architektur und technische Bestandsaufnahme

Stand dieser Bestandsaufnahme: `main` auf Commit `442487f072f238b3606957c52b7e2b2d528dfb95` vor Umsetzung von Issue #42.

Dieses Dokument beschreibt die bestehende Architektur. Es ist kein Wunschbild, das unabhängig vom Code gepflegt wird: Ändert ein Feature die hier beschriebene Struktur, muss dieselbe Änderung dieses Dokument im Feature-Branch aktualisieren.

## 1. Architektur in einem Satz

Der Deutschland-Simulator ist eine React-Anwendung mit zentralem, versioniertem Szenariozustand, reinen Fachmodellen in `src/lib/`, wiederverwendbaren UI-Bausteinen in `src/components/`, Seitenkomposition in `src/pages/` sowie typisierten Web-Worker-Grenzen für Persistenz und aufwendigere Berechnungen.

## 2. Daten- und Abhängigkeitsfluss

```text
Nutzerinteraktion
      ↓
Seite in src/pages
      ↓
wiederverwendbares Widget in src/components
      ↓
zentraler Szenariozustand / reine Fachlogik in src/lib
      ↓
typisierter Client in src/lib
      ↓
Web Worker in src/workers
      ↓
IndexedDB oder rechenintensive Modellberechnung
```

Ergebnisse laufen in umgekehrter Richtung zurück und werden zusammen mit Quellen-, Status- und Unsicherheitsinformationen dargestellt.

Verbindliche Abhängigkeitsrichtung:

- `src/pages/` darf `src/components/` und `src/lib/` verwenden.
- `src/components/` darf Typen und reine Hilfsfunktionen aus `src/lib/` verwenden.
- `src/lib/` enthält keine Seitenimporte und grundsätzlich keine React-Abhängigkeit.
- `src/workers/` verwendet Verträge und Fachlogik aus `src/lib/`.
- UI-Komponenten öffnen oder verändern IndexedDB niemals direkt.

## 3. Einstieg, Routing und Orchestrierung

### `src/main.tsx`

- initialisiert React im `StrictMode`,
- lädt globale und featurebezogene CSS-Dateien,
- liest den Hash der URL,
- rendert für `#/wirkungen` derzeit die gesonderte `EffectsRoute`,
- rendert für alle anderen Routen `App`.

Das Routing ist bewusst ohne externe Router-Bibliothek umgesetzt. Änderungen an einer Route müssen alle beteiligten Stellen konsistent halten: Routentyp, Navigation, Hash-Auswertung, Seitenrendering, Deep Links und E2E-Tests.

### `src/App.tsx`

`App.tsx` ist derzeit der zentrale Orchestrator. Dort liegen unter anderem:

- Hash-Routing für die Standardseiten,
- zentraler Szenariozustand mit Undo/Redo-Historie,
- Auswahl von Einnahmen- und Ausgabenmodulen,
- geladene Quellen und Kennzahlen,
- gespeicherte Szenarien,
- aktiver synthetischer Bevölkerungslauf,
- SGB-II-Vorschau,
- Zusammenführung von Steuer-, Einnahmen- und Ausgabenergebnissen,
- Öffnen des Quellen-Drawers,
- Laden, Speichern, Importieren und Exportieren von Szenarien.

Neue fachliche Zustände werden nicht ohne Grund als unabhängige lokale Kopie auf einer Seite angelegt. Gehört ein Wert zum Szenario, wird er in den versionierten Szenariovertrag integriert.

### `src/EffectsRoute.tsx`

Die Wirkungsansicht besitzt aktuell einen eigenen Routeneinstieg. Solange ein eigenes Issue diese Struktur nicht ändert, wird sie als bestehende Besonderheit respektiert und bei Routingänderungen mitgeprüft.

## 4. Seiten in `src/pages/`

Seiten sind für Layout, Zusammensetzung und Nutzerablauf zuständig. Sie sollen keine Persistenzschicht implementieren und keine parallelen Fachmodelle enthalten.

Aktuell bestehen insbesondere:

| Datei | Aufgabe |
| --- | --- |
| `OnboardingPage.tsx` | Einstieg und grundlegende Szenarioauswahl |
| `DashboardPage.tsx` | Haushaltsübersicht, Einnahmen, Ausgaben, Ergebnis, Verteilung, Regionen, Zeit und gespeicherte Szenarien |
| `IncomeTaxPage.tsx` | Einkommensteuerparameter, gesetzliche Baseline, Verteilung und Referenzhaushalte |
| `RevenueModulesPage.tsx` | weitere Einnahmenmodule mit einheitlicher Parameter- und Ergebnisstruktur |
| `ExpenseModulesPage.tsx` | Ausgabenmodule und Einbindung des Bürgergeld-/SGB-II-Editors |
| `PopulationPage.tsx` | technische Verwaltung, Kalibrierung und Prüfung synthetischer Bevölkerungsläufe |
| `EffectsPage.tsx` | direkte, indirekte und langfristige Wirkungsberechnung |
| `ComparisonPage.tsx` | Vergleich gespeicherter beziehungsweise aktiver Szenarien |
| `TransparencyPage.tsx` | Quellen, Methoden, Status, Unsicherheiten und Nachweise |

### Regel für neue Seiten

Eine neue Seite wird nur angelegt, wenn sie eine eigenständige Nutzeraufgabe erfüllt. Kleine Varianten bestehender Module werden in die vorhandene Modularchitektur integriert, statt eine parallele Seite mit eigener Logik zu erzeugen.

Seitenspezifische kleine Teilkomponenten dürfen zunächst in derselben Datei stehen. Werden sie wiederverwendet, komplex oder eigenständig testbar, werden sie nach `src/components/` verschoben.

## 5. Widgets und Komponenten in `src/components/`

Der Begriff „Widget“ bezeichnet in diesem Projekt einen wiederverwendbaren React-Baustein. Es gibt bewusst keinen separaten `widgets/`-Ordner; wiederverwendbare Widgets liegen in `src/components/`.

Wichtige bestehende Bausteine:

| Datei | Aufgabe |
| --- | --- |
| `AppBar.tsx` | Desktop- und Mobilnavigation, Szenarioname, Theme, Undo/Redo und Szenarioaktionen |
| `ScenarioPanel.tsx` | zentrale Szenarioeinstellungen wie Modellstufe und Zeithorizont |
| `SourceDrawer.tsx` | vollständiger Nachweis für Kennzahlen und Quellen |
| `EvidenceTooltip.tsx` | kompakte Vorschau auf Status, Konfidenz, Daten-/Rechtsstand, Quelle und Unsicherheit |
| `Tooltip.tsx` | generische zugängliche Tooltip-Grundlage |
| `ModuleDetailComponents.tsx` | gemeinsame Header, Kennzahlen und Modellstufen-Bausteine der Reformmodule |
| `Sgb2ExpenseEditor.tsx` | Bürgergeld-/SGB-II-Bearbeitung im Einfach- und Expertenmodus |
| `icons.tsx` | zentrale Zuordnung verwendeter Kategorie-Icons |

### Ablageregeln für neue Widgets

Ein Baustein gehört nach `src/components/`, wenn mindestens eines gilt:

- er wird auf mehreren Seiten oder Modulen verwendet,
- er bildet ein wiederkehrendes Interaktionsmuster,
- er kapselt relevante Zugänglichkeit oder Fokuslogik,
- er ist groß genug, um eine Seite unübersichtlich zu machen,
- er besitzt einen klaren, typisierten Props-Vertrag.

Ein Widget:

- erhält Daten und Ereignisse über Props,
- startet keine eigene alternative Persistenz,
- dupliziert keine Fachberechnung,
- verwendet vorhandene Karten-, Button-, Tooltip- und Evidenzmuster,
- unterstützt Tastaturbedienung sowie sinnvolle ARIA-Namen,
- funktioniert im vorgesehenen Desktop- und Mobil-Layout.

## 6. Fachlogik und Verträge in `src/lib/`

`src/lib/` ist die zentrale Schicht für Typen, reine Modelle, Szenarioverträge, Transparenzdaten und Clients.

### Zentrale Verträge

- `types.ts` enthält gemeinsam verwendete Typen für Szenarien, Quellen, Kennzahlen, Bevölkerung, Modellstufen und Worker-Nachrichten.
- `scenario-state.ts` definiert Standardszenario, Schema-Version, Normalisierung, Undo/Redo, JSON-Import und JSON-Export.

Änderungen am Szenariovertrag benötigen:

1. aktualisierten Typ,
2. sinnvollen Standardwert,
3. Normalisierung ungeprüfter oder älterer Daten,
4. gegebenenfalls neue Schema-Version,
5. Import-/Export- und Rückwärtskompatibilitätstests,
6. Aktualisierung technischer und fachlicher Dokumentation.

### Fachmodelle

Bestehende Modellbereiche umfassen unter anderem:

- `income-tax.ts` für die Einkommensteuer,
- `revenue-modules.ts` für weitere Einnahmen,
- `expense-modules.ts` für Ausgaben,
- `population-model.ts` für synthetische Bevölkerung,
- `long-term-effects.ts` und angrenzende Dateien für Wirkungen,
- `sgb2-policy.ts`, `sgb2-claim.ts`, `sgb2-housing.ts`, `sgb2-aggregation.ts`, `sgb2-ui.ts` und weitere `sgb2-*`-Dateien für Bürgergeld/SGB II,
- `sim-data.ts` für gemeinsame Darstellungs- und Baseline-Daten.

Fachberechnungen sind möglichst reine Funktionen: gleiche Eingabe, gleiche Ausgabe. React-Zustand, DOM-Zugriffe und IndexedDB gehören nicht in diese Funktionen.

### Transparenz

Featurebezogene Transparenzdateien stellen Quellen und Kennzahlen für die lokale Datenbasis bereit, zum Beispiel für Einnahmen, Ausgaben, Wirkungen und SGB II.

Für neue oder geänderte Kennzahlen sind mindestens zu pflegen:

- eindeutige ID und verständliche Bezeichnung,
- Datenjahr,
- Rechtsstand,
- Status wie amtlich, Modell oder Annahme,
- Konfidenz,
- Unsicherheitsbeschreibung,
- bekannte Grenzen,
- zugehörige Quellen-IDs.

Es gibt keine unmarkierten Demonstrationswerte und keine scheinexakten Ergebnisse ohne Nachweis.

### Clients

- `local-server-client.ts` kapselt die typisierte Kommunikation mit lokalem Server-, Bevölkerungs- und Wirkungs-Worker.
- `sgb2-preview-client.ts` kapselt die SGB-II-Vorschau.

Die Clients serialisieren Anfragen derzeit bewusst über eine Promise-Kette. Neue UI-Funktionen verwenden diese Clients oder erweitern ihre typisierten Verträge, statt direkt Worker oder IndexedDB anzusprechen.

## 7. Worker in `src/workers/`

Aktuell bestehen unter anderem:

- versionierte `local-server-v*.worker.ts` für lokale Quellen-, Kennzahlen-, Szenario- und Draft-Persistenz,
- `population.worker.ts` für Erzeugung, Aktivierung, Abfragen und Kalibrierung synthetischer Bevölkerungsläufe,
- `effects.worker.ts` für Wirkungsregister und Wirkungsberechnungen,
- `sgb2-preview.worker.ts` für gewichtete Bürgergeld-/SGB-II-Vorschauen.

Die lokale Datenbank heißt derzeit `de-sim-local-server`. Die versionierten Local-Server-Worker bauen aufeinander auf und ergänzen Daten beziehungsweise Migrationen. Eine Änderung an Stores oder Versionen muss bestehende lokale Daten berücksichtigen und darf keine stille, unprüfbare Löschung verursachen.

Ein neuer Worker ist nur gerechtfertigt, wenn Berechnung, Isolation oder Persistenz dies erfordern. Für kleine synchrone Berechnungen bleibt `src/lib/` der richtige Ort.

## 8. Zustand und Persistenz

Der zentrale Szenarioentwurf enthält unter anderem:

- Name und Beschreibung,
- Rechts- und Datenjahr,
- Modellstufe und Zeithorizont,
- Einnahmen- und Ausgabenänderungen,
- Einkommensteuerparameter,
- Wirkungsparameter,
- Annahmen und Quellen,
- Modellversionen,
- Referenz auf den Bevölkerungslauf,
- versionierten SGB-II-Policy-Vertrag.

Die React-Historie ermöglicht Undo und Redo. Persistente Szenarien, aktiver Draft, Quellen, Kennzahlen und Modellläufe werden über Worker und IndexedDB verwaltet.

Verbindlich:

- keine direkte IndexedDB-Nutzung aus Seiten oder Komponenten,
- keine stillen Ersatzläufe bei fehlenden Referenzen,
- fehlende oder veraltete Modellbasis als sichtbaren Zustand behandeln,
- IDs und Modellversionen im Szenario erhalten, wenn sie für Reproduzierbarkeit erforderlich sind,
- UI-Komplexität und technische Reproduzierbarkeit getrennt lösen, nicht gegeneinander ausspielen.

## 9. Styling und visuelle Architektur

Das Styling erfolgt mit eigenen CSS-Dateien, die in `src/main.tsx` geladen werden. Neben `styles.css` bestehen featurebezogene Dateien für Navigation, Dashboard, Evidenztooltips, Transparenz, Einkommensteuer, Einnahmen, Ausgaben, SGB II, Bevölkerung und Wirkungen.

Die visuelle Referenz ist `Kevni92/staat-sklarheit`. Bestehende Grundmuster bleiben erhalten:

- neutrales Türkis,
- flache Karten,
- kleine Radien,
- ruhige tabellarische Haushaltsdarstellung,
- nachvollziehbare Quellen- und Evidenzinteraktionen,
- konsistente Desktop- und Mobilnavigation.

Neue Features verwenden vorhandene Klassen und Muster, bevor neue Varianten eingeführt werden. Globale CSS-Änderungen werden gegen alle Hauptseiten geprüft.

## 10. Tests

### Unit- und Modelltests

TypeScript-Tests liegen unter `tests/`. Sie werden in `.test-dist/` kompiliert und mit dem Node-Test-Runner ausgeführt. Bestehende Schwerpunkte sind Bevölkerung, Wirkungsmodell sowie SGB-II-Policy, -Population, -Anspruch, -Unterkunft, -Aggregation und UI-Verträge.

Neue Fachlogik erhält Tests auf derselben Schicht. UI-Komponenten werden nicht als Ersatz für fehlende Modelltests verwendet.

### End-to-End-Tests

Playwright-Tests liegen unter `e2e/`. Die Konfiguration enthält:

- `chromium` für Desktop Chrome,
- `mobile-chromium` mit Pixel-7-Geräteprofil,
- Vite als lokalen Webserver,
- Traces beim ersten Retry,
- Screenshots bei Fehlern.

E2E-Tests prüfen sichtbares Nutzerverhalten, Navigation, Persistenz, Fokus und zentrale Ergebnisänderungen. Für sichtbare Features werden aussagekräftige Abnahme-Screenshots ergänzt.

## 11. Fachliche und technische Dokumentation

- `docs/reference` ist das Git-Submodul des fachlichen Repositories `Kevni92/de-sim-docs`.
- `technical-docs` enthält technische Arbeitsweise und Architektur dieses App-Repositories.
- `AGENTS.md` ist nur der kurze Einstieg und Index.
- `CLAUDE.md` verweist ausschließlich auf `AGENTS.md`.

Ändert ein Feature beide Bereiche, werden App- und Docs-Änderungen als zusammengehörige, verlinkte Pull Requests umgesetzt.

## 12. Schrittfolge für ein neues Feature

1. Ist-Stand im Code, in Tests und Dokumentation prüfen.
2. Fachliches Problem und Ziel als Issue beschreiben; bei Bedarf Unter-Issues anlegen.
3. Feature-Branch vom aktuellen `main` erstellen.
4. Fachvertrag und Typen in `src/lib/` definieren oder erweitern.
5. Reine Berechnung und Transparenzdaten implementieren.
6. Nur bei Bedarf Worker- und Client-Vertrag erweitern.
7. Zentralen Szenariovertrag, Normalisierung und Persistenz anpassen, falls das Feature Szenariodaten enthält.
8. Bestehende Seite erweitern oder eine begründete neue Seite anlegen.
9. Wiederverwendbare Widgets in `src/components/` ablegen.
10. Routing, Navigation, Quellen-Drawer, mobile Ansicht und Zugänglichkeit konsistent halten.
11. Unit- und E2E-Tests sowie Screenshots ergänzen.
12. Technische Dokumentation im selben App-Branch und fachliche Dokumentation im verlinkten Docs-Branch aktualisieren.
13. Draft-Pull-Request öffnen und erst nach vollständiger Abnahme auf „Ready“ setzen.

## 13. Architekturregeln als Checkliste

Vor Abschluss eines Features prüfen:

- [ ] Keine Seite und kein Widget greift direkt auf IndexedDB zu.
- [ ] Fachlogik ist nicht in JSX dupliziert.
- [ ] Zentrale Szenariowerte besitzen genau eine führende Quelle.
- [ ] Worker-Nachrichten und JSON-Daten sind typisiert und normalisiert.
- [ ] Neue Kennzahlen besitzen Quelle, Status, Jahr, Unsicherheit und Grenzen.
- [ ] Direkte, indirekte und langfristige Wirkungen bleiben getrennt.
- [ ] Routen sind in Typ, Navigation, Rendering und Tests konsistent.
- [ ] Vorhandene Komponenten und CSS-Muster wurden wiederverwendet.
- [ ] Desktop, Mobil, Tastatur, Lade-, Leer- und Fehlerzustände sind geprüft.
- [ ] Unit- und E2E-Tests decken das Risiko ab.
- [ ] `technical-docs/` und gegebenenfalls `de-sim-docs` sind aktuell.
