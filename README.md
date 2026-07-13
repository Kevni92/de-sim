# Deutschland-Simulator

Interaktiver Simulator für Einnahmen, Ausgaben und direkte sowie indirekte Wirkungen politischer Änderungen. Das UI folgt dem Prototyp aus [`Kevni92/staat-sklarheit`](https://github.com/Kevni92/staat-sklarheit).

## Dokumentation

Die fachliche Dokumentation ist als Git-Submodul unter `docs/reference` eingebunden und wird im Repository [`Kevni92/de-sim-docs`](https://github.com/Kevni92/de-sim-docs) gepflegt.

```bash
git clone --recurse-submodules https://github.com/Kevni92/de-sim.git
```

## Entwicklung

```bash
npm install
npm run dev
```

## Prüfung

```bash
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e -- --project=chromium
```

## Lokaler Serverersatz

Die erste Fassung verwendet einen Web Worker als serverähnliche Grenze. Quellen und Szenarien werden in IndexedDB gespeichert. UI-Komponenten greifen ausschließlich über `LocalServerClient` auf diese Daten zu, damit später ein echter HTTP-/RPC-Server eingesetzt werden kann.

## Veröffentlichung

Nach einem Merge nach `main` baut `.github/workflows/pages.yml` die Anwendung und veröffentlicht `dist/` über GitHub Pages.
