# UX-Abnahmecheckliste für Standardflüsse

Diese Checkliste sichert das in Issue #33 definierte Komplexitätsbudget dauerhaft als manuelle Abnahme- und Regressionsregel ab. Sie ergänzt die automatisierten Playwright-Flows in [`e2e/issue-40-standard-flows.spec.ts`](../e2e/issue-40-standard-flows.spec.ts) um Prüfpunkte, die sich nicht sinnvoll automatisieren lassen (Sprache, visuelle Dominanz, Informationshierarchie).

Sie wird bei jeder Änderung an Hauptnavigation, Ergebnislayout, Bürgergeld-Standardmodus oder Einnahmemodulen erneut durchlaufen, bevor der zugehörige Pull Request als abnahmebereit gilt.

## Verbindliches Komplexitätsbudget

Für jede geprüfte Standardansicht gilt:

- [ ] Die Ansicht beantwortet genau eine erkennbare Hauptfrage.
- [ ] Es gibt höchstens eine visuell dominante primäre Aktion.
- [ ] Im ersten Ergebnisbereich erscheinen höchstens vier Kernkennzahlen.
- [ ] Seeds, IDs, Modellversionen und interne Quellenkennungen sind im Standardfluss nicht sichtbar, bevor ein Nachweis- oder Expertenbereich geöffnet wurde.
- [ ] Bevölkerung und Wirkungsregister müssen für den Standardfluss nicht geöffnet werden.
- [ ] Direkte Wirkung und mögliche Folgewirkungen sind visuell und begrifflich getrennt.
- [ ] Unsicherheit steht direkt bei der relevanten Aussage, nicht nur im Nachweis.
- [ ] Fachdetails sind in höchstens zwei gezielten Interaktionen erreichbar.
- [ ] Fachbegriffe werden bei erstem Auftreten erklärt; unnötige Abkürzungen fehlen.
- [ ] Ein nicht quantifizierbares Ergebnis wird als fachlicher Zustand gezeigt, nicht als Fehler.

## Flow A: Einnahmen- beziehungsweise Steueränderung

Ausgangspunkt: Dashboard → Hauptnavigation „Einnahmen" → ein implementiertes Modul (z. B. Umsatzsteuer).

- [ ] Der Nutzer erreicht das Modul ohne Umweg über Bevölkerung oder Wirkungsregister.
- [ ] Die zentrale Stellschraube ist klar beschriftet und ohne Fachjargon bedienbar.
- [ ] Nach der Änderung aktualisiert sich die direkte Wirkung ohne separaten Modellstart.
- [ ] „Wer ist betroffen?" zeigt eine verständliche Inzidenzangabe, keine reine Formel.
- [ ] „Mögliche Folgewirkungen" trennt sichtbar zwischen direkter und indirekter/verhaltensbedingter Wirkung.
- [ ] „Berechnung und Quellen" öffnet einen vollständigen Nachweis mit Parametern, Quellen, Unsicherheit und Grenzen.
- [ ] Nach Speichern und Neuladen bleibt der geänderte Wert erhalten.
- [ ] Mobil ist dieselbe fachliche Reihenfolge ohne horizontales Scrollen nutzbar.

## Flow B: Bürgergeldänderung

Ausgangspunkt: Dashboard → Hauptnavigation „Ausgaben und Leistungen" → Bürgergeld.

- [ ] Regelbedarf und Hinzuverdienst sind im Standardmodus in Alltagssprache änderbar.
- [ ] Die Ergebnis-Kennzahlen zeigen staatliche Wirkung, betroffene Menschen, typische Monatswirkung und Unsicherheit.
- [ ] Der Wechsel in den Expertenmodus zeigt denselben kanonischen Parametersatz konkret (Euro-, Prozent-, Regionalwerte).
- [ ] Der Rückweg in den Standardmodus verliert keine im Expertenmodus geänderten Werte.
- [ ] „Finanzierung, Berechnung und Quellen" bleibt aus dem Modul heraus erreichbar.
- [ ] „Alle Änderungen zurücksetzen" stellt zuverlässig die Baseline wieder her.
- [ ] Persistenz nach Neuladen ist für Standard- und Expertenwerte geprüft.

## Flow C: Erweiterte Prüfung ohne Zustandsverlust

Ausgangspunkt: ein geändertes Modul → Hauptnavigation „Nachweise".

- [ ] Bevölkerungslauf/Modellbasis und Wirkungsregister sind nur über „Nachweise" erreichbar, nicht über gleichrangige Hauptnavigationspunkte.
- [ ] Die Rückkehr zum ursprünglichen Modul verliert keinen zuvor geänderten Wert.
- [ ] Es gibt keine tote oder inkonsistente Navigationsroute.

## Tastatur und Fokus

- [ ] Alle Aufklapp-Bereiche (`<details>`/`<summary>`) sind per Tastatur fokussierbar und mit Enter zu öffnen.
- [ ] Modale Nachweis-Dialoge erhalten beim Öffnen sinnvollen Fokus und schließen mit Escape.
- [ ] Nach Schließen eines Dialogs kehrt der Fokus zu einem sinnvollen Element zurück.

## Durchführung

1. Zutreffenden Flow (A, B oder C) auf Desktop und danach auf einem mobilen Viewport durchlaufen.
2. Jeden Punkt einzeln abhaken; bei Abweichung die Fundstelle (Seite, Komponente) notieren statt den Punkt zu überspringen.
3. Aktuelle Screenshots der Standardansicht, der geöffneten Vertiefung und der mobilen Ansicht ablegen (siehe `test-results/issue-40-*` aus dem automatisierten Lauf als Ausgangspunkt).
4. Abweichungen als eigenes Issue anlegen, bevor der zugehörige Pull Request gemergt wird.

## Verhältnis zu automatisierten Tests

Die automatisierten Playwright-Flows in `e2e/issue-40-standard-flows.spec.ts` prüfen Struktur, Sichtbarkeit, Persistenz und die Abwesenheit technischer Kennungen im Standardfluss. Sie ersetzen diese Checkliste nicht: Sprachqualität, visuelle Dominanz und Informationshierarchie lassen sich nur manuell beurteilen.
