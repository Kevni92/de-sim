# Vertrag für persönliche Wirkungsaussagen

Issue #62 ergänzt den bestehenden Vertrag für allgemeine und langfristige Wirkungen um eine Perspektive auf persönliche Haushalte und ähnliche Kohorten. Die zentrale Implementierung liegt in [`src/lib/personal-effect-contracts.ts`](../src/lib/personal-effect-contracts.ts).

## Aussage-Dimensionen

Jede Aussage enthält:

- Perspektive: persönlicher Haushalt, ähnliche Kohorte, Zielgruppe, Staatshaushalt, kurzfristige Wirtschaft oder langfristiger Pfad.
- Richtung: konkrete Entlastung, konkrete Belastung, keine direkte Wirkung, gemischte Wirkung oder ungeklärt.
- Wirkungsebene: direkt, kurzfristige Reaktion, Rückkopplung, langfristig oder nicht monetär.
- Begründung und betroffene Gruppe einschließlich Voraussetzung und optionaler Größenordnung.
- Datenjahr, Rechtsstand, Evidenz-, Kausalitäts-, Konfidenz- und Unsicherheitsstatus sowie Quellen-IDs.
- verwendete und fehlende Profilangaben.

Eine Aussage referenziert vorhandene Kontextwirkungen nur über ihre stabile ID (`contextEffectIds`). Wirkungsketten werden nicht dupliziert und nicht automatisch zu einer persönlichen Direktwirkung umgedeutet.

## Quantifizierung

Die TypeScript-Union trennt vier Fälle:

| Werttyp | Zulässige Genauigkeitsstufe | Bedeutung |
| --- | --- | --- |
| `punktwert` | `persoenlich-berechnet` oder `aehnliche-haushalte-modelliert` | Betrag mit Einheit und Zeitraum |
| `bandbreite` | `persoenlich-berechnet` oder `aehnliche-haushalte-modelliert` | Untergrenze, optionaler Zentralwert und Obergrenze |
| `gerichtet` | `qualitativ-eingeordnet` | begründete Richtung ohne Punktwert |
| `nicht-bestimmbar` | `nicht-bestimmbar` | notwendige Grundlage fehlt; Richtung ist `unklar` |

Damit kann eine qualitative oder nicht bestimmbare Aussage nicht versehentlich einen Geldbetrag tragen. Direkte Wirkung, Kohortenmodell und unsichere Folgepfade bleiben getrennt.

## Validierung

`validatePersonalEffectStatement` prüft auch Daten aus JSON-, Worker- und Persistenzgrenzen. Unvollständige Evidenz, überlappende Profilfelder, ungültige Zeiträume und inkonsistente Wert-/Genauigkeitskombinationen werden abgewiesen.

`normalizePersonalEffectStatements` verwirft außerdem doppelte IDs sowie widersprüchliche Richtungen für denselben Claim, dieselbe Perspektive und Wirkungsebene. Die Fehler werden an den Aufrufer zurückgegeben; fehlerhafte Aussagen gelangen nicht in die Darstellungsmenge.

## Sprach- und Farbbedeutung

Die Richtung ist fachlich, nicht politisch:

- Grün darf später nur eine konkrete Entlastung oder günstige Richtung für die ausdrücklich benannte Perspektive unterstützen.
- Rot darf später nur eine konkrete Belastung oder ungünstige Richtung für diese Perspektive unterstützen.
- Neutral bleibt für keine direkte Wirkung, gemischte, ungeklärte und nicht bestimmbare Aussagen.
- Farbe ist nie der alleinige Informationsträger; Text und Symbol sind erforderlich.

Der Vertrag enthält bewusst keine Gesamtpunktzahl, Rangliste oder normative Bewertung.

## Referenz-Fixtures

`src/lib/personal-effect-fixtures.ts` enthält zwei geprüfte Beispiele:

- Spitzensteuersatz oberhalb einer relevanten Schwelle als persönlich berechneter Punktwert.
- Kinderfreibetrag mit Kindern als qualitative Aussage, weil die vollständige Günstigerprüfung gegenüber Kindergeld außerhalb der aktuellen Systemgrenze liegt.

Profilverwaltung, Kohorten-Matching, UI und konkrete Einkommensteuerintegration folgen in den abhängigen Issues #63, #66, #69 und #71.
