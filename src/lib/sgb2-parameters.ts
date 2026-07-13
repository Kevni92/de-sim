import type { Sgb2EvidenceClass, Sgb2Parameter, Sgb2ParameterConstraints, Sgb2ParameterUnit, Sgb2RoundingRule, Sgb2UncertaintyClass } from "./sgb2-contracts";
import { SGB2_SOURCE_IDS } from "./sgb2-contracts";
import { berlin2026HousingParameters } from "./sgb2-housing-data";

export const VALID_FROM = "2026-07-01";
export const LEGAL_STATUS_DATE = "2026-07-01";

function numericParameter(
  id: string,
  value: number,
  unit: Sgb2ParameterUnit,
  sourceId: string,
  options: {
    evidenceClass?: Sgb2EvidenceClass;
    uncertaintyClass?: Sgb2UncertaintyClass;
    roundingRule?: Sgb2RoundingRule;
    notes?: string;
    constraints?: Sgb2ParameterConstraints;
  } = {},
): Sgb2Parameter<number> {
  return {
    id,
    value,
    unit,
    validFrom: VALID_FROM,
    validTo: null,
    legalStatusDate: LEGAL_STATUS_DATE,
    sourceId,
    evidenceClass: options.evidenceClass ?? "gesetz",
    uncertaintyClass: options.uncertaintyClass ?? "niedrig",
    roundingRule: options.roundingRule ?? (unit === "cent-pro-monat" ? "keine" : "kaufmaennisch-cent"),
    notes: options.notes,
    constraints: options.constraints,
  };
}

export const sgb2Parameters: Sgb2Parameter[] = [
  numericParameter("sgb2.standard-need.single", 56_300, "cent-pro-monat", SGB2_SOURCE_IDS.ruleRates2026, { constraints: { min: 0, max: 200_000, integer: true } }),
  numericParameter("sgb2.standard-need.partner", 50_600, "cent-pro-monat", SGB2_SOURCE_IDS.ruleRates2026, { constraints: { min: 0, max: 200_000, integer: true } }),
  numericParameter("sgb2.standard-need.adult-under-25", 45_100, "cent-pro-monat", SGB2_SOURCE_IDS.ruleRates2026, { constraints: { min: 0, max: 200_000, integer: true } }),
  numericParameter("sgb2.standard-need.child-14-17", 47_100, "cent-pro-monat", SGB2_SOURCE_IDS.ruleRates2026, { constraints: { min: 0, max: 200_000, integer: true } }),
  numericParameter("sgb2.standard-need.child-6-13", 39_000, "cent-pro-monat", SGB2_SOURCE_IDS.ruleRates2026, { constraints: { min: 0, max: 200_000, integer: true } }),
  numericParameter("sgb2.standard-need.child-0-5", 35_700, "cent-pro-monat", SGB2_SOURCE_IDS.ruleRates2026, { constraints: { min: 0, max: 200_000, integer: true } }),

  numericParameter("sgb2.additional-need.pregnancy-rate", 0.17, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),
  numericParameter("sgb2.additional-need.single-parent-primary-rate", 0.36, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),
  numericParameter("sgb2.additional-need.single-parent-per-child-rate", 0.12, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),
  numericParameter("sgb2.additional-need.single-parent-cap-rate", 0.60, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),
  numericParameter("sgb2.additional-need.disability-participation-rate", 0.35, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),

  numericParameter("sgb2.income.base-deduction", 10_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 100_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-1-lower", 10_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-1-upper", 52_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-1-rate", 0.20, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),
  numericParameter("sgb2.income.allowance-segment-2-lower", 52_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-2-upper", 100_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-2-rate", 0.30, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),
  numericParameter("sgb2.income.allowance-segment-3-lower", 100_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-3-upper", 120_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-3-child-upper", 150_000, "cent-pro-monat", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1_000_000, integer: true } }),
  numericParameter("sgb2.income.allowance-segment-3-rate", 0.10, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 1 } }),

  numericParameter("sgb2.reduction.first-breach-rate", 0.10, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 0.30 } }),
  numericParameter("sgb2.reduction.repeated-breach-rate", 0.20, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 0.30 } }),
  numericParameter("sgb2.reduction.further-breach-rate", 0.30, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 0.30 } }),
  numericParameter("sgb2.reduction.missed-appointment-rate", 0.10, "anteil", SGB2_SOURCE_IDS.law, { constraints: { min: 0, max: 0.30 } }),
  numericParameter("sgb2.reduction.default-duration-months", 3, "monate", SGB2_SOURCE_IDS.law, { constraints: { min: 1, max: 12, integer: true } }),

  numericParameter("sgb2.housing.grace-period-months", 12, "monate", SGB2_SOURCE_IDS.law, {
    notes: "Karenzzeit wird nur angewendet, wenn ein Leistungsbeginn als Laufzeitfakt vorliegt; Heizkosten bleiben getrennt geprüft.",
    constraints: { min: 0, max: 36, integer: true },
  }),
  numericParameter("sgb2.housing.grace-cap-factor", 1.5, "anteil", SGB2_SOURCE_IDS.law, {
    notes: "Ab Juli 2026 werden Unterkunftskosten auch während der Karenzzeit höchstens bis zum Eineinhalbfachen der abstrakten örtlichen Angemessenheitsgrenze anerkannt.",
    constraints: { min: 1, max: 3 },
  }),
  numericParameter("sgb2.housing.cost-reduction-transition-months", 6, "monate", SGB2_SOURCE_IDS.law, {
    notes: "Modellparameter für einen ausdrücklich gestarteten Kostensenkungszeitraum.",
    constraints: { min: 0, max: 24, integer: true },
  }),

  numericParameter("sgb2.legacy.recipient-index", 100, "index", SGB2_SOURCE_IDS.housingModel, {
    evidenceClass: "annahme",
    uncertaintyClass: "hoch",
    notes: "Nur zur verlustfreien Migration alter Aggregatszenarien; nicht Teil der individuellen Anspruchsberechnung.",
    constraints: { min: 0, max: 300 },
  }),
  numericParameter("sgb2.legacy.case-management-index", 100, "index", SGB2_SOURCE_IDS.housingModel, {
    evidenceClass: "annahme",
    uncertaintyClass: "hoch",
    notes: "Nur zur verlustfreien Migration alter Aggregatszenarien; Verwaltung und Eingliederung bleiben außerhalb des Anspruchsrechners.",
    constraints: { min: 0, max: 300 },
  }),
  numericParameter("sgb2.housing.fallback.cost-index", 100, "index", SGB2_SOURCE_IDS.housingModel, {
    evidenceClass: "modell",
    uncertaintyClass: "hoch",
    notes: "Übergangsparameter bis regionale kommunale Angemessenheitsgrenzen geladen sind.",
    constraints: { min: 0, max: 300 },
  }),
  numericParameter("sgb2.housing.floor-area.hh1", 50, "quadratmeter", SGB2_SOURCE_IDS.housingModel, { evidenceClass: "modell", uncertaintyClass: "hoch", constraints: { min: 0, max: 300 } }),
  numericParameter("sgb2.housing.floor-area.hh2", 65, "quadratmeter", SGB2_SOURCE_IDS.housingModel, { evidenceClass: "modell", uncertaintyClass: "hoch", constraints: { min: 0, max: 300 } }),
  numericParameter("sgb2.housing.floor-area.hh3", 80, "quadratmeter", SGB2_SOURCE_IDS.housingModel, { evidenceClass: "modell", uncertaintyClass: "hoch", constraints: { min: 0, max: 300 } }),
  numericParameter("sgb2.housing.floor-area.hh4", 95, "quadratmeter", SGB2_SOURCE_IDS.housingModel, { evidenceClass: "modell", uncertaintyClass: "hoch", constraints: { min: 0, max: 300 } }),
  numericParameter("sgb2.housing.floor-area.hh5plus", 110, "quadratmeter", SGB2_SOURCE_IDS.housingModel, { evidenceClass: "modell", uncertaintyClass: "hoch", constraints: { min: 0, max: 500 } }),
  ...berlin2026HousingParameters,
];
