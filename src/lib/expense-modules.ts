import type { Confidence, ModelLevel } from "./types";

export const expenseModuleIds = [
  "social",
  "pension",
  "education",
  "family",
  "health",
  "defense",
  "infrastructure",
  "subsidies",
  "migration",
] as const;

export type ExpenseModuleId = (typeof expenseModuleIds)[number];

export interface ExpenseParameterDefinition {
  key: string;
  label: string;
  baseline: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}

export interface ExpenseModuleDefinition {
  id: ExpenseModuleId;
  label: string;
  shortLabel: string;
  baseline: number;
  confidence: Confidence;
  description: string;
  legalBasis: string;
  sourceIds: string[];
  feedbackSensitivity: number;
  uncertaintyPercent: number;
  beneficiaries: Array<{ label: string; share: number }>;
  lineIds: string[];
  parameters: ExpenseParameterDefinition[];
}

export interface ExpenseModuleResult {
  id: ExpenseModuleId;
  label: string;
  baseline: number;
  staticValue: number;
  value: number;
  staticDelta: number;
  feedbackAdjustment: number;
  delta: number;
  confidence: Confidence;
  uncertaintyPercent: number;
  modelLevel: ModelLevel;
  beneficiaries: Array<{ label: string; share: number }>;
  parameters: Record<string, number>;
  lineValues: Record<string, number>;
  components: Array<{ id: string; label: string; baseline: number; value: number }>;
}

const parameter = (
  key: string,
  label: string,
  baseline: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  description: string,
): ExpenseParameterDefinition => ({ key, label, baseline, min, max, step, unit, description });

export const expenseModuleDefinitions: ExpenseModuleDefinition[] = [
  {
    id: "social",
    label: "Bürgergeld und Unterkunft",
    shortLabel: "Grundsicherung",
    baseline: 53.8,
    confidence: "mittel",
    description: "Regelbedarfe, Zahl der Bedarfsgemeinschaften, Unterkunftskosten und Verwaltungsaufwand werden getrennt parametrisiert.",
    legalBasis: "SGB II · Regelbedarf, Mehrbedarfe sowie Unterkunft und Heizung",
    sourceIds: ["source-citizen-benefit", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.18,
    uncertaintyPercent: 16,
    beneficiaries: [
      { label: "Leistungsberechtigte Haushalte", share: 71 },
      { label: "Vermietende und Energieversorgung", share: 17 },
      { label: "Verwaltung und Eingliederung", share: 12 },
    ],
    lineIds: ["buerger", "wohnen"],
    parameters: [
      parameter("benefitIndex", "Regelbedarfsniveau", 100, 70, 140, 1, "Index", "Index 100 entspricht dem gesetzlichen und im Baseline-Aggregat enthaltenen Leistungsniveau."),
      parameter("recipientIndex", "Bedarfsgemeinschaften", 100, 60, 140, 1, "Index", "Index für die Zahl und Zusammensetzung der leistungsberechtigten Bedarfsgemeinschaften."),
      parameter("housingIndex", "Unterkunfts- und Heizkosten", 100, 60, 160, 1, "Index", "Index der anerkannten durchschnittlichen Kosten für Unterkunft und Heizung."),
      parameter("caseManagementIndex", "Verwaltung und Eingliederung", 100, 60, 160, 1, "Index", "Index für Jobcenter-Verwaltung, Beratung und Eingliederungsleistungen innerhalb des Aggregats."),
    ],
  },
  {
    id: "pension",
    label: "Rente",
    shortLabel: "Rente",
    baseline: 128.4,
    confidence: "mittel",
    description: "Bundesbezogene Rentenausgaben werden über Rentenwert, Zahl der Leistungsbeziehenden, Bundeszuschuss und Referenzalter fortgeschrieben.",
    legalBasis: "SGB VI · gesetzliche Rentenversicherung und Bundeszuschüsse",
    sourceIds: ["source-pension-report", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.08,
    uncertaintyPercent: 12,
    beneficiaries: [
      { label: "Altersrenten", share: 74 },
      { label: "Erwerbsminderung", share: 11 },
      { label: "Hinterbliebene und sonstige", share: 15 },
    ],
    lineIds: ["rente"],
    parameters: [
      parameter("pensionValueIndex", "Rentenwert", 100, 80, 130, 1, "Index", "Index der durchschnittlichen Rentenzahlung je Leistungsfall."),
      parameter("beneficiaryIndex", "Leistungsbeziehende", 100, 80, 125, 1, "Index", "Demografischer Index der Zahl und Struktur der Rentenbeziehenden."),
      parameter("federalGrantIndex", "Bundeszuschuss", 100, 70, 140, 1, "Index", "Politisch gesetzter Index des Bundesanteils an der Finanzierung."),
      parameter("retirementAge", "Referenzalter", 67, 63, 70, 0.5, "Jahre", "Vereinfachtes Referenzalter; Übergangs- und Vertrauensschutzregeln werden nicht als Einzelfälle simuliert."),
    ],
  },
  {
    id: "education",
    label: "Bildung und Schulen",
    shortLabel: "Bildung",
    baseline: 22.6,
    confidence: "niedrig",
    description: "Bundes-, Länder- und kommunalbezogene Bildungsausgaben werden als verdichtetes Aggregat mit Lernenden, Ausgaben je Person und Investitionsvollzug modelliert.",
    legalBasis: "Gemeinschaftsaufgabe über Bund, Länder und Kommunen · keine einzelne Tarifnorm",
    sourceIds: ["source-education-finance", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.12,
    uncertaintyPercent: 24,
    beneficiaries: [
      { label: "Schülerinnen und Schüler", share: 61 },
      { label: "Lehr- und Betreuungspersonal", share: 25 },
      { label: "Gebäude, Digitales und Verwaltung", share: 14 },
    ],
    lineIds: ["bildung"],
    parameters: [
      parameter("perStudentIndex", "Ausgaben je Lernendem", 100, 70, 160, 1, "Index", "Index für Personal-, Sach- und Transferausgaben je Lernendem."),
      parameter("learnerIndex", "Zahl der Lernenden", 100, 80, 125, 1, "Index", "Index der relevanten Schüler-, Ausbildungs- und Studierendenzahl."),
      parameter("digitalIndex", "Digital- und Gebäudeinvestitionen", 100, 40, 220, 5, "Index", "Index zusätzlicher Investitionen in digitale Infrastruktur und Gebäude."),
      parameter("executionRate", "Mittelabfluss", 100, 40, 100, 1, "%", "Anteil der veranschlagten Mittel, der im Modelljahr tatsächlich abfließt."),
    ],
  },
  {
    id: "family",
    label: "Kitas und Familienleistungen",
    shortLabel: "Familie und Kita",
    baseline: 63.7,
    confidence: "mittel",
    description: "Familientransfers und Kindertagesbetreuung werden als getrennte Teilaggregate berechnet und anschließend zusammengeführt.",
    legalBasis: "EStG/BKGG, SGB VIII und Finanzierungsvereinbarungen der föderalen Ebenen",
    sourceIds: ["source-family-benefits", "source-daycare", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.16,
    uncertaintyPercent: 18,
    beneficiaries: [
      { label: "Familientransfers", share: 67 },
      { label: "Kindertagesbetreuung", share: 23 },
      { label: "Verwaltung und Infrastruktur", share: 10 },
    ],
    lineIds: ["familie", "kita"],
    parameters: [
      parameter("benefitIndex", "Familienleistungsniveau", 100, 70, 150, 1, "Index", "Index der monetären Familienleistungen im Ausgangsaggregat."),
      parameter("uptakeIndex", "Anspruchs- und Nutzungsquote", 100, 80, 120, 1, "Index", "Index der anspruchsberechtigten Kinder und tatsächlichen Inanspruchnahme."),
      parameter("placesIndex", "Betreuungsplätze", 100, 70, 150, 1, "Index", "Index der finanzierten Plätze in Kindertageseinrichtungen und Kindertagespflege."),
      parameter("qualityIndex", "Personal- und Qualitätskosten", 100, 70, 170, 1, "Index", "Index für Personalschlüssel, Vergütung, Öffnungszeiten und Qualitätsmaßnahmen."),
    ],
  },
  {
    id: "health",
    label: "Gesundheit und Pflege",
    shortLabel: "Gesundheit und Pflege",
    baseline: 153.8,
    confidence: "mittel",
    description: "Gesundheits- und Pflegeausgaben werden getrennt nach Leistungsvolumen, Vergütung, Pflegefällen und Präventionsannahme modelliert.",
    legalBasis: "SGB V und SGB XI · gesetzliche Kranken- und Pflegeversicherung",
    sourceIds: ["source-health-spending", "source-care-benefits", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.2,
    uncertaintyPercent: 18,
    beneficiaries: [
      { label: "Ambulante und stationäre Versorgung", share: 53 },
      { label: "Pflegebedürftige und Angehörige", share: 32 },
      { label: "Arzneimittel, Prävention und Verwaltung", share: 15 },
    ],
    lineIds: ["gesundheit", "pflege"],
    parameters: [
      parameter("serviceVolumeIndex", "Gesundheitsleistungen", 100, 75, 145, 1, "Index", "Index der Menge ambulanter, stationärer und weiterer Gesundheitsleistungen."),
      parameter("reimbursementIndex", "Vergütungsniveau", 100, 75, 145, 1, "Index", "Index der durchschnittlichen Vergütung und Preise im Gesundheitswesen."),
      parameter("careRecipientIndex", "Pflegebedürftige", 100, 80, 140, 1, "Index", "Index der Zahl und Pflegegradstruktur der Leistungsbeziehenden."),
      parameter("careBenefitIndex", "Pflegeleistungsniveau", 100, 75, 150, 1, "Index", "Index der Geld- und Sachleistungen der Pflegeversicherung."),
      parameter("preventionSavings", "Präventionsbedingte Entlastung", 0, 0, 20, 0.5, "%", "Szenarioannahme zur mittelfristigen Verringerung des Gesundheitsleistungsvolumens; keine sichere Prognose."),
    ],
  },
  {
    id: "defense",
    label: "Verteidigung",
    shortLabel: "Verteidigung",
    baseline: 71.8,
    confidence: "mittel",
    description: "Personal, Ausrüstung, Betrieb und Mittelabfluss werden als getrennte Treiber des Verteidigungshaushalts geführt.",
    legalBasis: "Einzelplan 14 und ergänzende Sondervermögen des Bundes",
    sourceIds: ["source-defense-budget", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.06,
    uncertaintyPercent: 15,
    beneficiaries: [
      { label: "Personal", share: 31 },
      { label: "Ausrüstung und Beschaffung", share: 43 },
      { label: "Betrieb, Infrastruktur und Sonstiges", share: 26 },
    ],
    lineIds: ["vert"],
    parameters: [
      parameter("equipmentIndex", "Ausrüstung und Beschaffung", 100, 50, 220, 5, "Index", "Index der Beschaffungs- und Ausrüstungsmittel."),
      parameter("personnelIndex", "Personal", 100, 70, 150, 1, "Index", "Index für Personalstärke, Besoldung und Versorgung."),
      parameter("readinessIndex", "Betrieb und Einsatzbereitschaft", 100, 60, 180, 1, "Index", "Index laufender Betriebs-, Übungs- und Bereitschaftsausgaben."),
      parameter("executionRate", "Mittelabfluss", 100, 50, 100, 1, "%", "Anteil der geplanten Mittel, der im Modelljahr tatsächlich abfließt."),
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastruktur",
    shortLabel: "Infrastruktur",
    baseline: 34.1,
    confidence: "niedrig",
    description: "Neue Investitionen, Erhalt und tatsächlicher Mittelabfluss werden getrennt ausgewiesen.",
    legalBasis: "Bundeshaushalt, Verkehrshaushalt und Sondervermögen Infrastruktur und Klimaneutralität",
    sourceIds: ["source-infrastructure-budget", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.14,
    uncertaintyPercent: 25,
    beneficiaries: [
      { label: "Schiene und öffentlicher Verkehr", share: 37 },
      { label: "Straßen, Brücken und Wasserwege", share: 38 },
      { label: "Digitales und sonstige Infrastruktur", share: 25 },
    ],
    lineIds: ["infra"],
    parameters: [
      parameter("newInvestmentIndex", "Neuinvestitionen", 100, 50, 250, 5, "Index", "Index neuer Infrastrukturvorhaben."),
      parameter("maintenanceIndex", "Erhalt und Sanierung", 100, 50, 220, 5, "Index", "Index für Bestandserhalt, Sanierung und Ersatzinvestitionen."),
      parameter("executionRate", "Mittelabfluss", 100, 35, 100, 1, "%", "Anteil der veranschlagten Investitionsmittel mit tatsächlichem Ausgabenabfluss."),
    ],
  },
  {
    id: "subsidies",
    label: "Subventionen",
    shortLabel: "Subventionen",
    baseline: 41.7,
    confidence: "niedrig",
    description: "Finanzhilfen und Steuervergünstigungen werden als getrennte Komponenten behandelt; Zielgenauigkeit und Auslaufen sind explizite Szenarioparameter.",
    legalBasis: "Subventionsbericht der Bundesregierung · Finanzhilfen und Steuervergünstigungen",
    sourceIds: ["source-subsidy-report", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.25,
    uncertaintyPercent: 30,
    beneficiaries: [
      { label: "Unternehmen und Branchen", share: 58 },
      { label: "Private Haushalte", share: 24 },
      { label: "Gemeinwirtschaftliche Ziele", share: 18 },
    ],
    lineIds: ["sub"],
    parameters: [
      parameter("financialAidIndex", "Finanzhilfen", 100, 30, 180, 5, "Index", "Index direkter Finanzhilfen innerhalb des Ausgangsaggregats."),
      parameter("taxBenefitIndex", "Steuervergünstigungen", 100, 30, 180, 5, "Index", "Index der als Ausgabenäquivalent geführten Steuervergünstigungen."),
      parameter("targetingSavings", "Zielgenauigkeits-Einsparung", 0, 0, 40, 1, "%", "Modellannahme zur Verringerung von Mitnahmeeffekten ohne proportionalen Leistungsabbau."),
      parameter("phaseOut", "Auslaufender Anteil", 0, 0, 60, 1, "%", "Anteil des Aggregats, der im Szenario schrittweise beendet wird."),
    ],
  },
  {
    id: "migration",
    label: "Migration und Asyl",
    shortLabel: "Migration und Asyl",
    baseline: 29.8,
    confidence: "niedrig",
    description: "Unterbringung, Verfahren, Integration sowie Bildung und weitere Bereiche bleiben getrennte Teilaggregate.",
    legalBasis: "AsylbLG, AufenthG, Integrationskurse sowie Ausgaben von Bund, Ländern und Kommunen",
    sourceIds: ["source-migration-statistics", "source-federal-budget-2026", "source-expense-model"],
    feedbackSensitivity: 0.18,
    uncertaintyPercent: 35,
    beneficiaries: [
      { label: "Unterbringung und Existenzsicherung", share: 33 },
      { label: "Verfahren und Verwaltung", share: 17 },
      { label: "Integration und Bildung", share: 27 },
      { label: "Weitere föderale Aufgaben", share: 23 },
    ],
    lineIds: ["migration"],
    parameters: [
      parameter("accommodationIndex", "Unterbringung", 100, 50, 180, 5, "Index", "Index des Teilaggregats für Unterbringung und existenzsichernde Leistungen."),
      parameter("procedureIndex", "Verfahren und Verwaltung", 100, 50, 180, 5, "Index", "Index der Ausgaben für Registrierung, Verfahren, Gerichte und Verwaltung."),
      parameter("integrationIndex", "Integration", 100, 40, 220, 5, "Index", "Index der Sprach-, Beratungs- und Integrationsangebote."),
      parameter("educationOtherIndex", "Bildung und weitere Bereiche", 100, 50, 180, 5, "Index", "Index für Bildung, Gesundheit und weitere föderale Aufgaben im Ausgangsaggregat."),
    ],
  },
];

export const expenseModuleDefinitionById = Object.fromEntries(
  expenseModuleDefinitions.map((definition) => [definition.id, definition]),
) as Record<ExpenseModuleId, ExpenseModuleDefinition>;

export function expenseParameterKey(moduleId: ExpenseModuleId, parameterKey: string) {
  return `expense.param.${moduleId}.${parameterKey}`;
}

export const defaultExpenseParameters = Object.fromEntries(
  expenseModuleDefinitions.flatMap((definition) => definition.parameters.map((item) => [expenseParameterKey(definition.id, item.key), item.baseline])),
) as Record<string, number>;

function readParameters(definition: ExpenseModuleDefinition, changes: Record<string, number>) {
  return Object.fromEntries(definition.parameters.map((item) => {
    const value = changes[expenseParameterKey(definition.id, item.key)];
    return [item.key, typeof value === "number" && Number.isFinite(value) ? value : item.baseline];
  })) as Record<string, number>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function staticLineValues(moduleId: ExpenseModuleId, p: Record<string, number>) {
  switch (moduleId) {
    case "social": {
      const recipients = p.recipientIndex / 100;
      return {
        buerger: 46.9 * recipients * (0.82 * p.benefitIndex / 100 + 0.18 * p.caseManagementIndex / 100),
        wohnen: 6.9 * recipients * p.housingIndex / 100,
      };
    }
    case "pension": {
      const ageFactor = clamp(1 - (p.retirementAge - 67) * 0.015, 0.9, 1.08);
      return { rente: 128.4 * (0.45 * p.pensionValueIndex / 100 + 0.35 * p.beneficiaryIndex / 100 + 0.2 * p.federalGrantIndex / 100) * ageFactor };
    }
    case "education": {
      const mix = 0.6 * p.perStudentIndex / 100 + 0.2 * p.learnerIndex / 100 + 0.2 * p.digitalIndex / 100;
      return { bildung: 22.6 * mix * p.executionRate / 100 };
    }
    case "family":
      return {
        familie: 55.3 * (0.75 * p.benefitIndex / 100 + 0.25 * p.uptakeIndex / 100),
        kita: 8.4 * p.placesIndex / 100 * p.qualityIndex / 100,
      };
    case "health": {
      const preventionFactor = clamp(1 - p.preventionSavings / 100 * 0.25, 0.9, 1);
      return {
        gesundheit: 92.1 * p.serviceVolumeIndex / 100 * p.reimbursementIndex / 100 * preventionFactor,
        pflege: 61.7 * p.careRecipientIndex / 100 * p.careBenefitIndex / 100,
      };
    }
    case "defense": {
      const mix = 0.4 * p.equipmentIndex / 100 + 0.3 * p.personnelIndex / 100 + 0.3 * p.readinessIndex / 100;
      return { vert: 71.8 * mix * p.executionRate / 100 };
    }
    case "infrastructure": {
      const mix = 0.55 * p.newInvestmentIndex / 100 + 0.45 * p.maintenanceIndex / 100;
      return { infra: 34.1 * mix * p.executionRate / 100 };
    }
    case "subsidies": {
      const mix = 0.55 * p.financialAidIndex / 100 + 0.45 * p.taxBenefitIndex / 100;
      const targeting = clamp(1 - p.targetingSavings / 100 * 0.5, 0.75, 1);
      const phaseOut = clamp(1 - p.phaseOut / 100 * 0.5, 0.7, 1);
      return { sub: 41.7 * mix * targeting * phaseOut };
    }
    case "migration":
      return {
        migration: 9.8 * p.accommodationIndex / 100 + 5.1 * p.procedureIndex / 100 + 4.4 * p.integrationIndex / 100 + 10.5 * p.educationOtherIndex / 100,
      };
  }
}

function componentValues(moduleId: ExpenseModuleId, p: Record<string, number>) {
  if (moduleId === "migration") {
    return [
      { id: "accommodation", label: "Unterbringung", baseline: 9.8, value: 9.8 * p.accommodationIndex / 100 },
      { id: "procedure", label: "Verfahren und Verwaltung", baseline: 5.1, value: 5.1 * p.procedureIndex / 100 },
      { id: "integration", label: "Integration", baseline: 4.4, value: 4.4 * p.integrationIndex / 100 },
      { id: "education-other", label: "Bildung und weitere Bereiche", baseline: 10.5, value: 10.5 * p.educationOtherIndex / 100 },
    ];
  }
  if (moduleId === "family") {
    return [
      { id: "family-benefits", label: "Familienleistungen", baseline: 55.3, value: 55.3 * (0.75 * p.benefitIndex / 100 + 0.25 * p.uptakeIndex / 100) },
      { id: "daycare", label: "Kindertagesbetreuung", baseline: 8.4, value: 8.4 * p.placesIndex / 100 * p.qualityIndex / 100 },
    ];
  }
  if (moduleId === "health") {
    const preventionFactor = clamp(1 - p.preventionSavings / 100 * 0.25, 0.9, 1);
    return [
      { id: "health", label: "Gesundheit", baseline: 92.1, value: 92.1 * p.serviceVolumeIndex / 100 * p.reimbursementIndex / 100 * preventionFactor },
      { id: "care", label: "Pflege", baseline: 61.7, value: 61.7 * p.careRecipientIndex / 100 * p.careBenefitIndex / 100 },
    ];
  }
  if (moduleId === "social") {
    const recipients = p.recipientIndex / 100;
    return [
      { id: "citizen-benefit", label: "Bürgergeld und Eingliederung", baseline: 46.9, value: 46.9 * recipients * (0.82 * p.benefitIndex / 100 + 0.18 * p.caseManagementIndex / 100) },
      { id: "housing", label: "Unterkunft und Heizung", baseline: 6.9, value: 6.9 * recipients * p.housingIndex / 100 },
    ];
  }
  return [];
}

function feedbackAdjustment(delta: number, sensitivity: number, level: ModelLevel) {
  if (level === "statisch" || Math.abs(delta) < 0.0001) return 0;
  const levelFactor = level === "verhalten" ? 1 : 1.65;
  const reboundFactor = delta < 0 ? 0.7 : 1;
  return -delta * Math.min(0.55, sensitivity * levelFactor) * reboundFactor;
}

export function calculateExpenseModule(moduleId: ExpenseModuleId, changes: Record<string, number>, modelLevel: ModelLevel): ExpenseModuleResult {
  const definition = expenseModuleDefinitionById[moduleId];
  const parameters = readParameters(definition, changes);
  const rawLineValues = staticLineValues(moduleId, parameters);
  const staticValue = Object.values(rawLineValues).reduce((sum, value) => sum + value, 0);
  const staticDelta = staticValue - definition.baseline;
  const feedback = feedbackAdjustment(staticDelta, definition.feedbackSensitivity, modelLevel);
  const value = Math.max(0, staticValue + feedback);
  const ratio = staticValue > 0 ? value / staticValue : 0;
  const lineValues = Object.fromEntries(Object.entries(rawLineValues).map(([id, lineValue]) => [id, Math.max(0, lineValue * ratio)]));
  const components = componentValues(moduleId, parameters).map((item) => ({ ...item, value: item.value * ratio }));

  return {
    id: moduleId,
    label: definition.label,
    baseline: definition.baseline,
    staticValue,
    value,
    staticDelta,
    feedbackAdjustment: feedback,
    delta: value - definition.baseline,
    confidence: definition.confidence,
    uncertaintyPercent: definition.uncertaintyPercent + (modelLevel === "langfrist" ? 10 : modelLevel === "verhalten" ? 4 : 0),
    modelLevel,
    beneficiaries: definition.beneficiaries,
    parameters,
    lineValues,
    components,
  };
}

export function calculateExpenseModules(changes: Record<string, number>, modelLevel: ModelLevel) {
  return expenseModuleIds.map((id) => calculateExpenseModule(id, changes, modelLevel));
}

export function expenseResultsById(results: ExpenseModuleResult[]) {
  return Object.fromEntries(results.map((result) => [result.id, result])) as Record<ExpenseModuleId, ExpenseModuleResult>;
}

export const expenseModuleForLineId: Record<string, ExpenseModuleId> = {
  buerger: "social",
  wohnen: "social",
  rente: "pension",
  bildung: "education",
  familie: "family",
  kita: "family",
  gesundheit: "health",
  pflege: "health",
  vert: "defense",
  infra: "infrastructure",
  sub: "subsidies",
  migration: "migration",
};

export function expenseLineResultsById(results: ExpenseModuleResult[]) {
  const lines: Record<string, { moduleId: ExpenseModuleId; value: number; delta: number }> = {};
  results.forEach((result) => {
    Object.entries(result.lineValues).forEach(([lineId, value]) => {
      const baseline = result.id === "social" ? (lineId === "buerger" ? 46.9 : 6.9)
        : result.id === "family" ? (lineId === "familie" ? 55.3 : 8.4)
          : result.id === "health" ? (lineId === "gesundheit" ? 92.1 : 61.7)
            : result.baseline;
      lines[lineId] = { moduleId: result.id, value, delta: value - baseline };
    });
  });
  return lines;
}
