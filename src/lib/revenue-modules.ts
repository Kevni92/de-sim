import type { Confidence, ModelLevel } from "./types";

export const revenueModuleIds = ["ust", "erb", "verm", "sozb", "kst", "kap", "energie"] as const;
export type RevenueModuleId = (typeof revenueModuleIds)[number];

export interface RevenueParameterDefinition {
  key: string;
  label: string;
  baseline: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
}

export interface RevenueModuleDefinition {
  id: RevenueModuleId;
  label: string;
  shortLabel: string;
  baseline: number;
  confidence: Confidence;
  description: string;
  legalBasis: string;
  sourceIds: string[];
  behaviorSensitivity: number;
  uncertaintyPercent: number;
  incidence: Array<{ label: string; share: number }>;
  parameters: RevenueParameterDefinition[];
}

export interface RevenueModuleResult {
  id: RevenueModuleId;
  label: string;
  baseline: number;
  staticValue: number;
  value: number;
  staticDelta: number;
  behavioralAdjustment: number;
  delta: number;
  confidence: Confidence;
  uncertaintyPercent: number;
  modelLevel: ModelLevel;
  incidence: Array<{ label: string; share: number }>;
  parameters: Record<string, number>;
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
): RevenueParameterDefinition => ({ key, label, baseline, min, max, step, unit, description });

export const revenueModuleDefinitions: RevenueModuleDefinition[] = [
  {
    id: "ust",
    label: "Umsatzsteuer",
    shortLabel: "USt",
    baseline: 291.4,
    confidence: "mittel",
    description: "Regel- und ermäßigter Steuersatz mit einer getrennten Annahme zum Anteil ermäßigter Umsätze.",
    legalBasis: "§ 12 UStG · Regelsteuersatz 19 %, ermäßigter Satz 7 %",
    sourceIds: ["source-vat", "source-budget", "source-revenue-model"],
    behaviorSensitivity: 0.12,
    uncertaintyPercent: 12,
    incidence: [{ label: "Private Haushalte", share: 72 }, { label: "Staat und Gemeinwesen", share: 8 }, { label: "Unternehmen ohne Vorsteuerabzug", share: 20 }],
    parameters: [
      parameter("standardRate", "Regelsteuersatz", 19, 0, 30, 0.5, "%", "Steuersatz für regulär besteuerte Umsätze."),
      parameter("reducedRate", "Ermäßigter Steuersatz", 7, 0, 20, 0.5, "%", "Steuersatz für die im UStG begünstigten Umsätze."),
      parameter("reducedShare", "Anteil ermäßigter Umsätze", 32, 0, 70, 1, "%", "Modellanteil der steuerpflichtigen Bemessungsgrundlage mit ermäßigtem Satz."),
      parameter("passThrough", "Preisweitergabe", 90, 0, 100, 5, "%", "Anteil einer Satzänderung, der mittelfristig in Verbraucherpreisen ankommt."),
    ],
  },
  {
    id: "erb",
    label: "Erbschaft- und Schenkungsteuer",
    shortLabel: "ErbSt",
    baseline: 11.8,
    confidence: "niedrig",
    description: "Vereinfachtes Aufkommensmodell für durchschnittliche Tarifbelastung, persönliche Freibeträge und Betriebsvermögensverschonung.",
    legalBasis: "ErbStG · progressive Steuersätze nach Steuerklasse und Erwerb",
    sourceIds: ["source-inheritance", "source-budget", "source-revenue-model"],
    behaviorSensitivity: 0.25,
    uncertaintyPercent: 30,
    incidence: [{ label: "Große private Erwerbe", share: 58 }, { label: "Übrige private Erwerbe", share: 27 }, { label: "Betriebsvermögen", share: 15 }],
    parameters: [
      parameter("averageRate", "Durchschnittlicher Modellsteuersatz", 19, 0, 50, 1, "%", "Verdichteter Durchschnitt über Steuerklassen und Tarifstufen."),
      parameter("personalAllowance", "Persönlicher Referenzfreibetrag", 400000, 20000, 2000000, 10000, "€", "Referenzwert für Erwerbe durch Kinder; andere Verwandtschaftsgrade bleiben separat zu dokumentieren."),
      parameter("businessRelief", "Verschonung Betriebsvermögen", 85, 0, 100, 5, "%", "Modellierter Anteil begünstigten Betriebsvermögens, der von der Bemessungsgrundlage ausgenommen wird."),
    ],
  },
  {
    id: "verm",
    label: "Vermögensteuer",
    shortLabel: "VermSt",
    baseline: 0,
    confidence: "niedrig",
    description: "Szenariomodul für eine derzeit nicht erhobene Vermögensteuer. Die steuerliche Bemessungsgrundlage ist eine explizite Modellannahme.",
    legalBasis: "Derzeit keine Erhebung · ausschließlich hypothetisches Szenario",
    sourceIds: ["source-wealth", "source-revenue-model"],
    behaviorSensitivity: 0.35,
    uncertaintyPercent: 45,
    incidence: [{ label: "Topvermögen", share: 78 }, { label: "Unternehmerisches Vermögen", share: 17 }, { label: "Übrige Vermögen", share: 5 }],
    parameters: [
      parameter("rate", "Steuersatz", 0, 0, 3, 0.1, "%", "Jährlicher proportionaler Szenariosteuersatz."),
      parameter("allowance", "Persönlicher Freibetrag", 2000000, 250000, 10000000, 250000, "€", "Freibetrag je steuerpflichtiger Person im vereinfachten Modell."),
      parameter("valuationDiscount", "Bewertungsabschlag", 20, 0, 80, 5, "%", "Pauschaler Abschlag für Bewertungs-, Liquiditäts- und Verschonungsregeln."),
    ],
  },
  {
    id: "sozb",
    label: "Sozialversicherungsbeiträge",
    shortLabel: "Beiträge",
    baseline: 620,
    confidence: "mittel",
    description: "Gesamtmodell aus Renten-, Kranken-, Pflege- und Arbeitslosenversicherung einschließlich Beitragsbemessungsgrenzen.",
    legalBasis: "Beitragssätze und Rechengrößen 2026",
    sourceIds: ["source-social-insurance", "source-health-contributions", "source-budget", "source-revenue-model"],
    behaviorSensitivity: 0.08,
    uncertaintyPercent: 10,
    incidence: [{ label: "Beschäftigte", share: 47 }, { label: "Arbeitgeber", share: 47 }, { label: "Sonstige Beitragszahlende", share: 6 }],
    parameters: [
      parameter("pensionRate", "Rentenversicherung", 18.6, 0, 30, 0.1, "%", "Gesamtbeitragssatz bis zur Renten-BBG."),
      parameter("healthRate", "Krankenversicherung inkl. Zusatzbeitrag", 17.5, 0, 25, 0.1, "%", "Allgemeiner Beitragssatz 14,6 % plus durchschnittlicher Zusatzbeitrag 2026 von 2,9 %."),
      parameter("careRate", "Pflegeversicherung", 3.6, 0, 8, 0.1, "%", "Grundbeitrag ohne individuellen Kinderlosenzuschlag und Kinderabschläge."),
      parameter("unemploymentRate", "Arbeitslosenversicherung", 2.6, 0, 8, 0.1, "%", "Gesamtbeitragssatz zur Arbeitsförderung."),
      parameter("pensionCeiling", "BBG Rente/Arbeitslosigkeit", 101400, 50000, 180000, 1200, "€ / Jahr", "Jährliche Beitragsbemessungsgrenze 2026."),
      parameter("healthCeiling", "BBG Kranken/Pflege", 69750, 40000, 120000, 1200, "€ / Jahr", "Jährliche Beitragsbemessungsgrenze 2026."),
    ],
  },
  {
    id: "kst",
    label: "Körperschaftsteuer",
    shortLabel: "KSt",
    baseline: 46.1,
    confidence: "mittel",
    description: "Aufkommensmodell für Körperschaftsteuersatz, Solidaritätszuschlag, Verlustverrechnung und Investitionsanreize.",
    legalBasis: "KStG · Körperschaftsteuersatz 15 %",
    sourceIds: ["source-corporate-tax", "source-budget", "source-revenue-model"],
    behaviorSensitivity: 0.28,
    uncertaintyPercent: 28,
    incidence: [{ label: "Anteilseigner", share: 45 }, { label: "Beschäftigte", share: 25 }, { label: "Kundinnen und Kunden", share: 20 }, { label: "Sonstige", share: 10 }],
    parameters: [
      parameter("rate", "Körperschaftsteuersatz", 15, 0, 35, 0.5, "%", "Tariflicher Körperschaftsteuersatz."),
      parameter("solidarityRate", "Solidaritätszuschlag auf KSt", 5.5, 0, 10, 0.5, "%", "Zuschlag auf die festgesetzte Körperschaftsteuer."),
      parameter("lossOffset", "Nutzbare Verlustverrechnung", 70, 0, 100, 5, "%", "Verdichtete Modellquote der steuerlich nutzbaren Verlustverrechnung."),
      parameter("investmentAllowance", "Investitionsfördernde Abzüge", 0, 0, 40, 2, "%", "Pauschaler Anteil zusätzlicher Abzüge von der Bemessungsgrundlage."),
    ],
  },
  {
    id: "kap",
    label: "Kapitalertragsteuer",
    shortLabel: "KapESt",
    baseline: 9.8,
    confidence: "niedrig",
    description: "Vereinfachtes Modell der Abgeltungsteuer mit Sparer-Pauschbetrag und Verlustverrechnung.",
    legalBasis: "EStG · Kapitalertragsteuer grundsätzlich 25 %",
    sourceIds: ["source-capital-tax", "source-budget", "source-revenue-model"],
    behaviorSensitivity: 0.3,
    uncertaintyPercent: 35,
    incidence: [{ label: "Hohe Kapitalerträge", share: 64 }, { label: "Mittlere Kapitalerträge", share: 29 }, { label: "Kleine Kapitalerträge", share: 7 }],
    parameters: [
      parameter("rate", "Abgeltungsteuersatz", 25, 0, 50, 1, "%", "Steuersatz ohne Kirchensteuer; Solidaritätszuschlag wird in diesem Modul nicht separat simuliert."),
      parameter("saverAllowance", "Sparer-Pauschbetrag", 1000, 0, 10000, 100, "€", "Jährlicher Pauschbetrag je Einzelperson im Referenzfall."),
      parameter("lossOffset", "Verlustverrechnung", 100, 0, 100, 5, "%", "Modellierter Anteil an Verlusten, der mit positiven Kapitalerträgen verrechnet werden kann."),
    ],
  },
  {
    id: "energie",
    label: "Energie- und Verbrauchsteuern",
    shortLabel: "Verbrauch",
    baseline: 63.2,
    confidence: "niedrig",
    description: "Indexmodell für Kraftstoffe, Strom, Tabak und Alkohol. Unterschiedliche physische Mengeneinheiten werden nicht in einen Scheinsatz vermischt.",
    legalBasis: "EnergieStG, StromStG und weitere Verbrauchsteuergesetze",
    sourceIds: ["source-energy-taxes", "source-budget", "source-revenue-model"],
    behaviorSensitivity: 0.25,
    uncertaintyPercent: 30,
    incidence: [{ label: "Private Haushalte", share: 61 }, { label: "Verkehr und Logistik", share: 22 }, { label: "Übrige Unternehmen", share: 17 }],
    parameters: [
      parameter("fuelIndex", "Kraftstoffsteuer-Index", 100, 50, 180, 5, "Index", "Index 100 entspricht dem Baseline-Aufkommen aus Kraftstoffsteuern."),
      parameter("electricityIndex", "Stromsteuer-Index", 100, 0, 180, 5, "Index", "Index der durchschnittlichen Stromsteuerbelastung."),
      parameter("tobaccoIndex", "Tabaksteuer-Index", 100, 50, 200, 5, "Index", "Index der durchschnittlichen Tabaksteuerbelastung."),
      parameter("alcoholIndex", "Alkoholsteuer-Index", 100, 50, 200, 5, "Index", "Index der zusammengefassten Alkohol-Verbrauchsteuern."),
    ],
  },
];

export const revenueModuleDefinitionById = Object.fromEntries(
  revenueModuleDefinitions.map((definition) => [definition.id, definition]),
) as Record<RevenueModuleId, RevenueModuleDefinition>;

export function revenueParameterKey(moduleId: RevenueModuleId, parameterKey: string) {
  return `param.${moduleId}.${parameterKey}`;
}

export const defaultRevenueParameters = Object.fromEntries(
  revenueModuleDefinitions.flatMap((definition) => definition.parameters.map((item) => [revenueParameterKey(definition.id, item.key), item.baseline])),
) as Record<string, number>;

function readParameters(module: RevenueModuleDefinition, changes: Record<string, number>) {
  return Object.fromEntries(module.parameters.map((item) => {
    const value = changes[revenueParameterKey(module.id, item.key)];
    return [item.key, typeof value === "number" && Number.isFinite(value) ? value : item.baseline];
  })) as Record<string, number>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function staticValue(moduleId: RevenueModuleId, p: Record<string, number>) {
  switch (moduleId) {
    case "ust": {
      const reducedShare = clamp(p.reducedShare, 0, 100) / 100;
      const baselineWeightedRate = 19 * 0.68 + 7 * 0.32;
      const weightedRate = p.standardRate * (1 - reducedShare) + p.reducedRate * reducedShare;
      return 291.4 * weightedRate / baselineWeightedRate;
    }
    case "erb": {
      const allowanceFactor = Math.pow(400000 / Math.max(20000, p.personalAllowance), 0.22);
      const taxableBusinessShare = Math.max(1, 100 - p.businessRelief);
      const reliefFactor = Math.pow(taxableBusinessShare / 15, 0.18);
      return 11.8 * p.averageRate / 19 * allowanceFactor * reliefFactor;
    }
    case "verm": {
      if (p.rate <= 0) return 0;
      const allowanceFactor = Math.pow(2000000 / Math.max(250000, p.allowance), 0.35);
      const valuationFactor = Math.max(0.05, 1 - p.valuationDiscount / 100) / 0.8;
      const modeledTaxBaseBn = 1100 * allowanceFactor * valuationFactor;
      return modeledTaxBaseBn * p.rate / 100;
    }
    case "sozb": {
      const baselineRate = 18.6 + 17.5 + 3.6 + 2.6;
      const rate = p.pensionRate + p.healthRate + p.careRate + p.unemploymentRate;
      const pensionCeilingFactor = Math.pow(Math.max(50000, p.pensionCeiling) / 101400, 0.35);
      const healthCeilingFactor = Math.pow(Math.max(40000, p.healthCeiling) / 69750, 0.35);
      const ceilingFactor = 0.65 + 0.22 * pensionCeilingFactor + 0.13 * healthCeilingFactor;
      return 620 * rate / baselineRate * ceilingFactor;
    }
    case "kst": {
      const effectiveRate = p.rate * (1 + p.solidarityRate / 100);
      const baselineEffectiveRate = 15 * 1.055;
      const lossFactor = Math.pow(Math.max(1, p.lossOffset) / 70, 0.25);
      const allowanceFactor = Math.max(0.45, 1 - p.investmentAllowance / 100 * 0.35);
      return 46.1 * effectiveRate / baselineEffectiveRate * lossFactor * allowanceFactor;
    }
    case "kap": {
      const allowanceFactor = Math.pow(1000 / Math.max(100, p.saverAllowance), 0.12);
      const lossFactor = Math.pow(Math.max(1, p.lossOffset) / 100, 0.15);
      return 9.8 * p.rate / 25 * allowanceFactor * lossFactor;
    }
    case "energie": {
      const weightedIndex = p.fuelIndex * 0.45 + p.electricityIndex * 0.15 + p.tobaccoIndex * 0.28 + p.alcoholIndex * 0.12;
      return 63.2 * weightedIndex / 100;
    }
  }
}

function behaviorAdjustment(delta: number, sensitivity: number, level: ModelLevel) {
  if (level === "statisch" || Math.abs(delta) < 0.0001) return 0;
  const levelFactor = level === "verhalten" ? 1 : 1.65;
  const offsetShare = Math.min(0.65, sensitivity * levelFactor);
  const cutFactor = delta < 0 ? 0.55 : 1;
  return -delta * offsetShare * cutFactor;
}

export function calculateRevenueModule(moduleId: RevenueModuleId, changes: Record<string, number>, modelLevel: ModelLevel): RevenueModuleResult {
  const definition = revenueModuleDefinitionById[moduleId];
  const parameters = readParameters(definition, changes);
  const rawStaticValue = Math.max(0, staticValue(moduleId, parameters));
  const staticDelta = rawStaticValue - definition.baseline;
  const behavioralAdjustment = behaviorAdjustment(staticDelta, definition.behaviorSensitivity, modelLevel);
  const value = Math.max(0, rawStaticValue + behavioralAdjustment);
  return {
    id: moduleId,
    label: definition.label,
    baseline: definition.baseline,
    staticValue: rawStaticValue,
    value,
    staticDelta,
    behavioralAdjustment,
    delta: value - definition.baseline,
    confidence: definition.confidence,
    uncertaintyPercent: definition.uncertaintyPercent + (modelLevel === "langfrist" ? 10 : modelLevel === "verhalten" ? 4 : 0),
    modelLevel,
    incidence: definition.incidence,
    parameters,
  };
}

export function calculateRevenueModules(changes: Record<string, number>, modelLevel: ModelLevel) {
  return revenueModuleIds.map((id) => calculateRevenueModule(id, changes, modelLevel));
}

export function revenueResultsById(results: RevenueModuleResult[]) {
  return Object.fromEntries(results.map((result) => [result.id, result])) as Record<RevenueModuleId, RevenueModuleResult>;
}
