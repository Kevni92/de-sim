import type { PersonalEffectStatement } from "./personal-effect-contracts";

export const personalEffectExamples: PersonalEffectStatement[] = [
  {
    id: "example-income-tax-top-rate-above-threshold",
    claimKey: "income-tax.top-rate",
    title: "Spitzensteuersatz oberhalb der relevanten Schwelle",
    perspective: "persoenlicher-haushalt",
    direction: "belastung",
    accuracy: "persoenlich-berechnet",
    layer: "direkt",
    value: { kind: "punktwert", amount: 480, unit: "€ pro Jahr", period: { fromYear: 2026, toYear: 2026 } },
    explanation: "Das zu versteuernde Einkommen des Beispielhaushalts liegt oberhalb der reformierten Schwelle.",
    affectedGroup: { description: "Steuerpflichtige mit zu versteuerndem Einkommen oberhalb der Schwelle", condition: "Ausreichendes zu versteuerndes Einkommen und passende Veranlagungsart", size: { kind: "bandbreite", lower: 100000, upper: 250000, unit: "Haushalte" } },
    evidence: { dataYear: 2026, legalYear: 2026, evidenceStatus: "modellrechnung", causality: "modelliert", confidence: "mittel", uncertainty: "Tarifliche Rechnung; keine vollständige Steuerberatung.", sourceIds: ["source-income-tax-model"] },
    profile: { used: ["zu versteuerndes Einkommen", "Veranlagungsart"], missing: [] },
    contextEffectIds: [],
  },
  {
    id: "example-income-tax-child-allowance-qualitative",
    claimKey: "income-tax.child-allowance",
    title: "Kinderfreibetrag mit offener Günstigerprüfung",
    perspective: "persoenlicher-haushalt",
    direction: "entlastung",
    accuracy: "qualitativ-eingeordnet",
    layer: "direkt",
    value: { kind: "gerichtet", summary: "Tarifliche Entlastung ist möglich; die vollständige Günstigerprüfung gegenüber Kindergeld ist nicht enthalten." },
    explanation: "Kindermerkmale liegen vor, aber die Systemgrenze erlaubt keine vollständige Vergleichsrechnung.",
    affectedGroup: { description: "Haushalte mit steuerlich berücksichtigungsfähigen Kindern", condition: "Mindestens ein berücksichtigungsfähiges Kind" },
    evidence: { dataYear: 2026, legalYear: 2026, evidenceStatus: "modellrechnung", causality: "modelliert", confidence: "mittel", uncertainty: "Ohne vollständige Günstigerprüfung kein persönlicher Punktwert.", sourceIds: ["source-income-tax-model"] },
    profile: { used: ["Kinderzahl", "Kinderaltersgruppen"], missing: ["vollständige Günstigerprüfung"] },
    contextEffectIds: ["family-demography-unavailable"],
  },
];
