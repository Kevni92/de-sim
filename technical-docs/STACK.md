# Stack und Entwicklungsumgebung

Dieses Dokument beschreibt den aktuell verwendeten technischen Stack. Versionsänderungen, neue zentrale Abhängigkeiten und geänderte Befehle werden im selben Feature-Branch hier nachgeführt.

## Laufzeit und Oberfläche

| Bereich | Aktueller Stand |
| --- | --- |
| UI | React 19 und React DOM 19 |
| Sprache | TypeScript 5.7 im Strict Mode |
| Build und Dev-Server | Vite 6 mit `@vitejs/plugin-react` |
| Icons | `lucide-react` |
| Styling | eigenes CSS mit globalen und featurebezogenen Stylesheets |
| Routing | eigenes Hash-Routing ohne externe Router-Bibliothek |
| Zustandsverwaltung | React Hooks und Reducer; zentraler Szenariozustand in `App.tsx` und `scenario-state.ts` |
| Browser-Persistenz | IndexedDB hinter einer Worker- und Client-Grenze |
| Hintergrundberechnung | ES-Module-Web-Worker für lokalen Serverersatz, Bevölkerung, Wirkungen und SGB-II-Vorschau |

Die Anwendung ist derzeit eine clientseitige Webanwendung. Es gibt keinen produktiven HTTP-Backend-Service. Der typisierte `LocalServerClient` bildet bewusst eine serverähnliche Grenze, damit die Implementierung später ersetzt werden kann, ohne dass UI-Komponenten direkt auf Persistenz zugreifen.

## Entwicklungswerkzeuge

| Werkzeug | Verwendung |
| --- | --- |
| npm | Installation und Skriptausführung |
| Node.js 22 | CI-Laufzeit und Unit-Test-Ausführung |
| TypeScript Compiler | Typecheck und Kompilierung der Unit-Tests |
| Node Test Runner | Ausführung der kompilierten Unit-Tests |
| Playwright 1.51 | End-to-End-Tests für Desktop Chrome und Pixel-7-Viewport |
| GitHub Actions | Qualitätsprüfung und Veröffentlichung |
| GitHub Pages | Veröffentlichung von `dist/` nach Merge auf `main` |

## Lokale Einrichtung

Das fachliche Repository ist als Submodul eingebunden. Deshalb vollständig klonen:

```bash
git clone --recurse-submodules https://github.com/Kevni92/de-sim.git
cd de-sim
npm install
```

Bei einem bereits vorhandenen Checkout:

```bash
git submodule update --init --recursive
npm install
```

## Zentrale Befehle

### Entwicklung

```bash
npm run dev
```

Vite läuft standardmäßig auf Port `4173`. Die Anwendung verwendet den Basis-Pfad `/de-sim/`.

### Typecheck

```bash
npm run typecheck
```

Der Befehl prüft Anwendung und Node-Konfiguration mit `tsc --noEmit`.

### Produktions-Build

```bash
npm run build
```

Der Build führt zuerst den Typecheck aus und erzeugt anschließend `dist/`.

### Unit-Tests

```bash
npm run test:unit
```

Die TypeScript-Tests unter `tests/` werden nach `.test-dist/` kompiliert und anschließend mit dem eingebauten Node-Test-Runner ausgeführt. Aktuell decken sie insbesondere Bevölkerung, Wirkungsmodell, SGB-II-Policy, Anspruch, Unterkunft, Aggregation und UI-Verträge ab.

### Playwright installieren

```bash
npx playwright install chromium
```

In CI werden zusätzlich die benötigten Systemabhängigkeiten mit `--with-deps` installiert.

### End-to-End-Tests

Desktop:

```bash
npm run test:e2e -- --project=chromium
```

Mobil:

```bash
npm run test:e2e -- --project=mobile-chromium
```

Alle Projekte:

```bash
npm run test:e2e
```

Playwright startet den Vite-Dev-Server auf `http://127.0.0.1:4173/de-sim/`. Traces werden beim ersten Retry erzeugt, Screenshots standardmäßig bei Fehlern.

### Vollständige lokale Prüfung

```bash
npm test
```

Dieser Befehl führt Build, Unit-Tests und alle Playwright-Projekte aus.

## TypeScript-Konfiguration

Die Anwendung wird mit folgenden zentralen Eigenschaften geprüft:

- Ziel `ES2022`,
- `strict: true`,
- ES-Module,
- Bundler-Modulauflösung,
- isolierte Module,
- JSX-Transform `react-jsx`,
- kein JavaScript-Fallback und kein Emit beim App-Typecheck.

Neue Dateien müssen diese Regeln ohne Abschwächung erfüllen. `any`, untypisierte Worker-Nachrichten und ungeprüfte JSON-Daten werden nicht als Abkürzung verwendet.

## Vite und Browserziel

`vite.config.ts` definiert:

- React-Plugin,
- Basis-Pfad `/de-sim/`,
- Build-Ziel `esnext`,
- ES-Modul-Format für Worker,
- Port `4173` für Entwicklung und Vorschau.

Änderungen am Basis-Pfad, Worker-Format oder Browserziel betreffen Routing, Playwright und GitHub Pages und benötigen deshalb ein eigenes Issue sowie Aktualisierungen an Tests und Dokumentation.

## CI

`.github/workflows/ci.yml` enthält zwei Qualitätsstufen:

1. **Typecheck, Build und Unit-Tests** für Pull Requests und Pushes auf `main`.
2. **Playwright Desktop und Mobil** für Nicht-Draft-Pull-Requests und Pushes auf `main`.

Fehlerdiagnosen und Browser-Artefakte werden zeitlich begrenzt als Workflow-Artefakte hochgeladen. Ein Draft-Pull-Request kann deshalb eine grüne schnelle Qualitätsprüfung haben, obwohl die vollständige Browserabnahme noch nicht gelaufen ist.

## Veröffentlichung

`.github/workflows/pages.yml` baut die Anwendung nach einem Push auf `main` mit Node 22 und veröffentlicht `dist/` über GitHub Pages. Manuelles Auslösen ist ebenfalls möglich.

Kein Feature-Branch veröffentlicht direkt. Veröffentlichung ist eine Folge eines geprüften Merges nach `main`.

## Regeln für neue Abhängigkeiten

Eine neue zentrale Bibliothek wird nur hinzugefügt, wenn:

- das Problem nicht sinnvoll mit dem bestehenden Stack gelöst werden kann,
- Nutzen, Auswirkungen und Alternativen im Issue dokumentiert sind,
- Bundle-, Wartungs- und Sicherheitsfolgen geprüft wurden,
- Architektur- und Stack-Dokumentation aktualisiert wurden,
- Tests den neuen Integrationspunkt abdecken.

Insbesondere werden keine zweite Zustandsverwaltung, Router-Bibliothek, UI-Komponentenbibliothek oder parallele Persistenzschicht ohne ausdrückliche Architekturentscheidung eingeführt.
