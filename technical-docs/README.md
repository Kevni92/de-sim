# Technische Dokumentation

Dieser Ordner beschreibt die technische Arbeitsweise und die aktuelle Anwendungsarchitektur des Deutschland-Simulators. Er liegt bewusst im App-Repository und nicht im fachlichen Submodul.

## Inhalt

| Dokument | Zweck |
| --- | --- |
| [`WORKFLOW.md`](WORKFLOW.md) | Verbindlicher Ablauf von Problem und Issue bis Branch, Tests, Pull Request, Review und Merge |
| [`STACK.md`](STACK.md) | Eingesetzte Technologien, Entwicklungsbefehle, CI und Veröffentlichung |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Technische Bestandsaufnahme, Ablageorte und Regeln für architekturtreue Erweiterungen |
| [`MODELLBASIS.md`](MODELLBASIS.md) | Automatische Standardbasis, Szenarioreferenz, Worker-Ablauf und Wiederherstellung fehlender Bevölkerungsläufe |

## Abgrenzung

- **Technische Dokumentation dieses Repositories:** Architektur, Stack, Ordner, Entwicklungsablauf und Agentenregeln. Änderungen erfolgen im jeweiligen App-Feature-Branch.
- **Fachliche Dokumentation:** Modelle, Begriffe, Daten, Quellen, Rechtsstände, Unsicherheiten und fachliche Nutzerabläufe. Sie wird im Submodul [`docs/reference`](../docs/reference) beziehungsweise im Repository [`Kevni92/de-sim-docs`](https://github.com/Kevni92/de-sim-docs) gepflegt.

## Aktualität ist Teil des Features

Eine Änderung ist nicht vollständig, wenn betroffene Dokumentation veraltet bleibt. Ändert ein Feature den Stack, die Architektur, Ablageorte, Tests oder den Entwicklungsablauf, werden die passenden Dateien in `technical-docs/` im selben Feature-Branch aktualisiert. Fachliche Änderungen erhalten im selben Arbeitsgang einen verlinkten Branch und Pull Request im Dokumentationsrepository.

Neue technische Dokumente werden hier im Inhaltsverzeichnis und zusätzlich in `AGENTS.md` verlinkt, sofern sie für alle Entwicklungsagenten verbindlich sind.
