import type { Sgb2PolicyBundle, Sgb2ScenarioReference } from "./sgb2-contracts";
import { SGB2_FALLBACK_HOUSING_DATASET_ID, SGB2_HOUSING_SCHEMA_VERSION, SGB2_MODEL_VERSION, SGB2_POLICY_2026_ID, SGB2_POLICY_SCHEMA_VERSION, SGB2_SOURCE_IDS } from "./sgb2-contracts";
import { berlin2026HousingDataset } from "./sgb2-housing-data";
import { LEGAL_STATUS_DATE, VALID_FROM, sgb2Parameters } from "./sgb2-parameters";

export const defaultSgb2PolicyBundle: Sgb2PolicyBundle = {
  policy: {
    id: SGB2_POLICY_2026_ID,
    name: "Grundsicherung für Arbeitsuchende – Rechtsbaseline Juli 2026",
    legalStatusDate: LEGAL_STATUS_DATE,
    validFrom: VALID_FROM,
    validTo: null,
    terminology: "grundsicherungsgeld",
    schemaVersion: SGB2_POLICY_SCHEMA_VERSION,
    modelVersion: SGB2_MODEL_VERSION,
    parameterIds: sgb2Parameters.map((item) => item.id),
    sourceIds: Object.values(SGB2_SOURCE_IDS),
    changeNotes: [
      "Erste versionierte Policy-Struktur für den Bürgergeld-/Grundsicherungsgeld-Milestone.",
      "Regionale Unterkunftsgrenzen sind bewusst vom bundesweiten Leistungsrecht getrennt.",
      "Berliner AV-Wohnen-Richtwerte 2026 sind als erster vollständiger regionaler Referenzdatensatz integriert.",
    ],
  },
  parameters: sgb2Parameters,
  standardNeedRules: [
    { id: "standard-need-single", priority: 10, eligibilityPredicate: { kind: "adult-single", description: "Alleinstehende, Alleinerziehende und Volljährige mit minderjährigem Partner." }, monthlyAmountParameterId: "sgb2.standard-need.single", sourceId: SGB2_SOURCE_IDS.ruleRates2026 },
    { id: "standard-need-partner", priority: 20, eligibilityPredicate: { kind: "adult-partner", description: "Volljährige Partner in einer Bedarfsgemeinschaft." }, monthlyAmountParameterId: "sgb2.standard-need.partner", sourceId: SGB2_SOURCE_IDS.ruleRates2026 },
    { id: "standard-need-adult-under-25", priority: 30, eligibilityPredicate: { kind: "adult-under-25", description: "Volljährige unter 25 Jahren ohne eigenen Haushalt beziehungsweise mit nicht zugesichertem Umzug.", ageMin: 18, ageMax: 24 }, monthlyAmountParameterId: "sgb2.standard-need.adult-under-25", sourceId: SGB2_SOURCE_IDS.ruleRates2026 },
    { id: "standard-need-child-14-17", priority: 40, eligibilityPredicate: { kind: "child-age-band", description: "Kinder von 14 bis 17 Jahren.", ageMin: 14, ageMax: 17 }, monthlyAmountParameterId: "sgb2.standard-need.child-14-17", sourceId: SGB2_SOURCE_IDS.ruleRates2026 },
    { id: "standard-need-child-6-13", priority: 50, eligibilityPredicate: { kind: "child-age-band", description: "Kinder von 6 bis 13 Jahren.", ageMin: 6, ageMax: 13 }, monthlyAmountParameterId: "sgb2.standard-need.child-6-13", sourceId: SGB2_SOURCE_IDS.ruleRates2026 },
    { id: "standard-need-child-0-5", priority: 60, eligibilityPredicate: { kind: "child-age-band", description: "Kinder von 0 bis 5 Jahren.", ageMin: 0, ageMax: 5 }, monthlyAmountParameterId: "sgb2.standard-need.child-0-5", sourceId: SGB2_SOURCE_IDS.ruleRates2026 },
  ],
  additionalNeedRules: [
    { id: "additional-need-pregnancy", priority: 10, eligibilityPredicate: { kind: "pregnancy", description: "Schwangerschaft ab der gesetzlich maßgeblichen Woche." }, basis: "standard-need", rateParameterId: "sgb2.additional-need.pregnancy-rate", sourceId: SGB2_SOURCE_IDS.law, uncertaintyClass: "niedrig" },
    { id: "additional-need-single-parent-primary", priority: 20, eligibilityPredicate: { kind: "single-parent", description: "Gesetzliche Hauptfallgruppe für Alleinerziehende abhängig von Zahl und Alter der Kinder." }, basis: "standard-need", rateParameterId: "sgb2.additional-need.single-parent-primary-rate", capGroup: "single-parent", capParameterId: "sgb2.additional-need.single-parent-cap-rate", sourceId: SGB2_SOURCE_IDS.law, uncertaintyClass: "niedrig" },
    { id: "additional-need-single-parent-per-child", priority: 30, eligibilityPredicate: { kind: "single-parent", description: "Alternativer Mehrbedarf je Kind mit gemeinsamer Obergrenze." }, basis: "standard-need", rateParameterId: "sgb2.additional-need.single-parent-per-child-rate", capGroup: "single-parent", capParameterId: "sgb2.additional-need.single-parent-cap-rate", sourceId: SGB2_SOURCE_IDS.law, uncertaintyClass: "niedrig" },
    { id: "additional-need-disability-participation", priority: 40, eligibilityPredicate: { kind: "disability-participation", description: "Bestimmte Leistungen zur Teilhabe oder Eingliederungshilfe." }, basis: "standard-need", rateParameterId: "sgb2.additional-need.disability-participation-rate", sourceId: SGB2_SOURCE_IDS.law, uncertaintyClass: "mittel" },
  ],
  incomeTypes: [
    { id: "employment", label: "Erwerbseinkommen", countableByDefault: true, privilegedPossible: false, allocation: "person", sourceId: SGB2_SOURCE_IDS.law },
    { id: "self-employment", label: "Einkommen aus selbstständiger Tätigkeit", countableByDefault: true, privilegedPossible: false, allocation: "person", sourceId: SGB2_SOURCE_IDS.law },
    { id: "unemployment-insurance", label: "Arbeitslosengeld und Entgeltersatz", countableByDefault: true, privilegedPossible: false, allocation: "person", sourceId: SGB2_SOURCE_IDS.law },
    { id: "pension", label: "Rente und Versorgungsbezug", countableByDefault: true, privilegedPossible: false, allocation: "person", sourceId: SGB2_SOURCE_IDS.law },
    { id: "child-benefit", label: "Kindergeld", countableByDefault: true, privilegedPossible: false, allocation: "child", sourceId: SGB2_SOURCE_IDS.law },
    { id: "maintenance", label: "Unterhalt und Unterhaltsvorschuss", countableByDefault: true, privilegedPossible: false, allocation: "child", sourceId: SGB2_SOURCE_IDS.law },
    { id: "housing-benefit", label: "Wohngeld und andere vorrangige Wohnleistung", countableByDefault: true, privilegedPossible: false, allocation: "benefit-unit", sourceId: SGB2_SOURCE_IDS.law },
    { id: "other", label: "Sonstige laufende Einnahme", countableByDefault: true, privilegedPossible: true, allocation: "person", sourceId: SGB2_SOURCE_IDS.law },
  ],
  incomeDeductionRules: [
    { id: "deduction-taxes", appliesToIncomeTypes: ["employment", "self-employment"], calculationType: "actual", priority: 10, sourceId: SGB2_SOURCE_IDS.law },
    { id: "deduction-social-contributions", appliesToIncomeTypes: ["employment", "self-employment"], calculationType: "actual", priority: 20, sourceId: SGB2_SOURCE_IDS.law },
    { id: "deduction-necessary-insurance", appliesToIncomeTypes: ["employment", "self-employment", "other"], calculationType: "actual", priority: 30, sourceId: SGB2_SOURCE_IDS.law },
    { id: "deduction-work-expenses", appliesToIncomeTypes: ["employment", "self-employment"], calculationType: "actual", priority: 40, sourceId: SGB2_SOURCE_IDS.law },
    { id: "deduction-base-employment", appliesToIncomeTypes: ["employment", "self-employment"], calculationType: "fixed", parameterId: "sgb2.income.base-deduction", priority: 50, sourceId: SGB2_SOURCE_IDS.law },
  ],
  earnedIncomeAllowanceSegments: [
    { id: "earned-income-allowance-1", lowerExclusiveParameterId: "sgb2.income.allowance-segment-1-lower", upperInclusiveParameterId: "sgb2.income.allowance-segment-1-upper", rateParameterId: "sgb2.income.allowance-segment-1-rate", sourceId: SGB2_SOURCE_IDS.law },
    { id: "earned-income-allowance-2", lowerExclusiveParameterId: "sgb2.income.allowance-segment-2-lower", upperInclusiveParameterId: "sgb2.income.allowance-segment-2-upper", rateParameterId: "sgb2.income.allowance-segment-2-rate", sourceId: SGB2_SOURCE_IDS.law },
    { id: "earned-income-allowance-3", lowerExclusiveParameterId: "sgb2.income.allowance-segment-3-lower", upperInclusiveParameterId: "sgb2.income.allowance-segment-3-upper", childRelatedUpperInclusiveParameterId: "sgb2.income.allowance-segment-3-child-upper", rateParameterId: "sgb2.income.allowance-segment-3-rate", sourceId: SGB2_SOURCE_IDS.law },
  ],
  reductionRules: [
    { id: "reduction-first-breach", trigger: "first-breach", rateParameterId: "sgb2.reduction.first-breach-rate", durationMonthsParameterId: "sgb2.reduction.default-duration-months", sourceId: SGB2_SOURCE_IDS.law },
    { id: "reduction-repeated-breach", trigger: "repeated-breach", rateParameterId: "sgb2.reduction.repeated-breach-rate", durationMonthsParameterId: "sgb2.reduction.default-duration-months", sourceId: SGB2_SOURCE_IDS.law },
    { id: "reduction-further-breach", trigger: "further-breach", rateParameterId: "sgb2.reduction.further-breach-rate", durationMonthsParameterId: "sgb2.reduction.default-duration-months", sourceId: SGB2_SOURCE_IDS.law },
    { id: "reduction-missed-appointment", trigger: "missed-appointment", rateParameterId: "sgb2.reduction.missed-appointment-rate", durationMonthsParameterId: "sgb2.reduction.default-duration-months", sourceId: SGB2_SOURCE_IDS.law },
  ],
  priorityBenefits: [
    { id: "priority-child-benefit", label: "Kindergeld", incomeTypeId: "child-benefit", allocation: "child", sourceId: SGB2_SOURCE_IDS.law },
    { id: "priority-maintenance", label: "Unterhalt und Unterhaltsvorschuss", incomeTypeId: "maintenance", allocation: "child", sourceId: SGB2_SOURCE_IDS.law },
    { id: "priority-housing-benefit", label: "Wohngeld", incomeTypeId: "housing-benefit", allocation: "benefit-unit", sourceId: SGB2_SOURCE_IDS.law },
    { id: "priority-unemployment-insurance", label: "Arbeitslosengeld", incomeTypeId: "unemployment-insurance", allocation: "person", sourceId: SGB2_SOURCE_IDS.law },
  ],
  housingDatasets: [
    {
      id: SGB2_FALLBACK_HOUSING_DATASET_ID,
      schemaVersion: SGB2_HOUSING_SCHEMA_VERSION,
      regionId: "DE",
      validFrom: VALID_FROM,
      validTo: null,
      publicationDate: "2026-07-13",
      method: "Projektweiter Modell-Fallback mit Wohnflächenstruktur; kommunale Miet- und Heizkostengrenzen fehlen bewusst.",
      sourceId: SGB2_SOURCE_IDS.housingModel,
      evidenceClass: "modell",
      uncertaintyClass: "hoch",
      status: "placeholder",
      modelCostIndexParameterId: "sgb2.housing.fallback.cost-index",
      rules: [
        { id: "hh1", householdSizeMin: 1, householdSizeMax: 1, adequateFloorAreaParameterId: "sgb2.housing.floor-area.hh1", hardshipRuleIds: [] },
        { id: "hh2", householdSizeMin: 2, householdSizeMax: 2, adequateFloorAreaParameterId: "sgb2.housing.floor-area.hh2", hardshipRuleIds: [] },
        { id: "hh3", householdSizeMin: 3, householdSizeMax: 3, adequateFloorAreaParameterId: "sgb2.housing.floor-area.hh3", hardshipRuleIds: [] },
        { id: "hh4", householdSizeMin: 4, householdSizeMax: 4, adequateFloorAreaParameterId: "sgb2.housing.floor-area.hh4", hardshipRuleIds: [] },
        { id: "hh5plus", householdSizeMin: 5, adequateFloorAreaParameterId: "sgb2.housing.floor-area.hh5plus", hardshipRuleIds: [] },
      ],
    },
    berlin2026HousingDataset,
  ],
};

export const defaultSgb2ScenarioReference: Sgb2ScenarioReference = {
  policyVersionId: SGB2_POLICY_2026_ID,
  parameterOverrides: [],
  housingDatasetOverrides: [],
  financingOverrides: [],
  populationRunId: null,
  modelVersion: SGB2_MODEL_VERSION,
  migrationNotes: [],
};
