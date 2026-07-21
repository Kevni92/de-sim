# Kontextbezogene Wirkungen

Issue #37 bindet die bestehende Wirkungs-Engine an Reformmodule und Szenariovergleich. `/wirkungen` bleibt als vertiefende Fachansicht erhalten, verwendet aber denselben Laufvertrag.

## Datenfluss

1. Reformparameter bleiben im zentralen Szenario.
2. `reform-effects.ts` ordnet geänderte Reformen über stabile IDs expliziten Wirkungspfaden zu.
3. Dokumentierte Übersetzungen erzeugen die Engine-Parameter.
4. Szenario, Modellbasis, Modellstufe, Zeitraum und Parameter bilden eine Eingabesignatur.
5. Der Wirkungs-Worker berechnet automatisch und speichert den Lauf mit dieser Signatur.
6. Modulansichten, Vergleich und Fachansicht lesen denselben Lauf.

## Zuordnung und Doppelzählung

Jede Verknüpfung enthält Reformkontext, Wirkungskette, Zeitpunkt, Ebene, Quantifizierungsstatus, Quellen und einen Überlappungsschlüssel. `primary` wird im Vergleich berücksichtigt. `reference-only` zeigt einen abhängigen Teilpfad, summiert ihn aber nicht zusätzlich. So wird etwa Arbeitsvolumen innerhalb des Kita-Pfads nicht doppelt gezählt.

## Zustände

- `quantified`: Euroband oder natürliche Einheit aus einem kompatiblen Lauf
- `directional`: fachlich begründete Richtung ohne Punktwert
- `unavailable`: nicht ausreichend belegt oder Datenbasis unzureichend
- `inactive`: Baseline unverändert, Modellstufe ungeeignet oder Lauf fehlt

Direkte Budgetwirkungen bleiben in der jeweiligen Steuer-, Einnahmen-, Ausgaben- oder Leistungslogik und werden nicht mit möglichen Folgewirkungen vermischt.

## Aktualität und Persistenz

Ein Lauf ist nur aktuell, wenn Modellstufe, Zeithorizont und Eingabesignatur passen. Request-IDs verhindern, dass verspätete Worker-Antworten neuere Ergebnisse überschreiben. Identische Läufe werden wiederverwendet.

Szenarioschema 6 ergänzt `effectRunReference` mit Lauf-ID, Modellversion, Bevölkerungslauf, Modellstufe, Zeitraum, Eingabesignatur und Berechnungszeitpunkt. Schema 1 bis 5 bleiben importierbar. Die automatische Referenzsynchronisierung erzeugt keinen eigenen Undo-Schritt.

## Zentrale Dateien

- `src/lib/reform-effects.ts`: Zuordnung, Parameter, Signatur und Vergleichsaggregation
- `src/components/ContextualEffectsPanel.tsx`: gemeinsame Moduldarstellung
- `src/workers/effects.worker.ts`: Berechnung und Wiederverwendung
- `src/App.tsx`: automatische Orchestrierung
- `src/EffectsRoute.tsx`: vertiefende Ansicht
- `tests/reform-effects.test.ts` und `e2e/contextual-effects.spec.ts`: Vertragsabnahme
