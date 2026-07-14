# Zentraler Berechnungsrahmen

## Zweck

`modelLevel` und `horizonYears` sind bereits Teil des zentralen Szenariozustands. Issue #36 macht diesen Vertrag auch in der Bedienung verbindlich: Fachseiten dürfen die Werte anzeigen, aber nicht als eigenen lokalen Zustand verändern.

## Datenvertrag

Die internen Werte bleiben aus Gründen der Rückwärtskompatibilität unverändert:

| Interner Wert | Sichtbarer Begriff |
| --- | --- |
| `statisch` | Nur direkte Wirkung |
| `verhalten` | Mit kurzfristigen Reaktionen |
| `langfrist` | Langfristiges Szenario |

Der Zeithorizont bleibt als `1 | 5 | 10 | 20` Jahre im Szenario gespeichert. Es ist keine Schemaänderung erforderlich; bestehende Szenarien, Import, Export, Undo und Redo verwenden weiterhin dieselben Felder.

Die sichtbaren Begriffe und Erläuterungen liegen zentral in `src/lib/scenario-calculation.ts`. Fachseiten dürfen keine eigenen Bezeichnungsfunktionen ergänzen.

## Bearbeitung und Darstellung

Die einzige reguläre Schreibstelle ist `ScenarioPanel`:

- Modellstufe und Zeithorizont stehen zusammen im Abschnitt **Berechnungsrahmen**.
- Die Langfriststufe weist ausdrücklich darauf hin, dass sie keine sichere Prognose liefert.
- `ModuleCalculationContextCard` zeigt die aktuelle Einstellung auf Fachseiten schreibgeschützt.
- Die Aktion **Im Szenario ändern** öffnet den Drawer über das Ereignis `de-sim:open-scenario-calculation-settings` und fokussiert die Modellstufe.

Das Ereignis transportiert keine fachlichen Werte. Es öffnet lediglich die zentrale Oberfläche; Quelle der Wahrheit bleibt der Szenariozustand.

## Aktualität von Ergebnissen

`CalculationFreshness` kennt drei Zustände:

- `current`: sichtbares Ergebnis entspricht Modellstufe und Zeitraum des Szenarios,
- `updating`: eine Neuberechnung läuft; ein vorhandenes älteres Ergebnis darf zur Orientierung sichtbar bleiben,
- `stale`: ein sichtbares Ergebnis verwendet eine ältere Einstellung und wird nicht als aktuell dargestellt.

Die Wirkungsroute aktualisiert nach Szenarioänderungen automatisch. Jede Berechnung erhält eine fortlaufende Request-ID. Nur die Antwort der jüngsten Anfrage darf `run`, Fehler- oder Ladezustand aktualisieren. Damit kann eine verspätete Worker-Antwort keinen neueren Szenariozustand überschreiben.

Direkte Ergebnisse anderer Fachmodule werden synchron aus dem zentralen Szenario berechnet. Mögliche Folgewirkungen bleiben begrifflich und visuell von der direkten Wirkung getrennt.

## Testvertrag

- Unit-Tests sichern Begriffe, Migration, Aktualitätsstatus sowie Undo und Redo.
- Playwright prüft die zentrale Bearbeitung, Fokusführung, Übernahme auf Einnahmen, Einkommensteuer und Ausgaben sowie Persistenz nach Neuladen.
- Die Wirkungsprüfung sichert automatische Neuberechnung, Zwischenstatus und das Verwerfen veralteter Bedienmuster.
- Desktop und Mobil erzeugen aktuelle Screenshots als CI-Artefakte.
