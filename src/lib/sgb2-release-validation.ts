export type Sgb2ReleaseComponentId = "standard-need" | "additional-need" | "accommodation" | "heating";
export type Sgb2ReleaseUncertaintyClass = "mittel" | "hoch";

export interface Sgb2ReleaseComparison {
  id: string;
  label: string;
  scopeLabel: string;
  period: string;
  sourceId: string;
  referenceValueCents: number;
  modelValueCents: number;
  absoluteDeviationCents: number;
  relativeDeviation: number;
  comparability: "mittel" | "niedrig";
  boundaryDifferences: string[];
}

export interface Sgb2ReleaseValidationResult {
  reproducibilityKey: string;
  qualityStatus: "prüfbar" | "eingeschränkt";
  qualityLabel: string;
  uncertaintyBand: {
    lowerCents: number;
    upperCents: number;
    relativeWidth: number;
    interpretation: string;
  };
  comparisons: Sgb2ReleaseComparison[];
  performance: {
    durationMs: number;
    warningThresholdMs: number;
    status: "innerhalb" | "überschritten";
    samplePersons: number;
    sampleBenefitUnits: number;
    simulatedBenefitUnitMonths: number;
  };
  modelLimitations: string[];
}

export interface Sgb2ReleaseValidationInput {
  runId: string;
  policyVersionId: string;
  modelVersion: string;
  periodFrom: string;
  periodTo: string;
  paymentCents: number;
  components: Array<{ id: Sgb2ReleaseComponentId; paymentCents: number }>;
  uncertaintyClass: Sgb2ReleaseUncertaintyClass;
  durationMs: number;
  samplePersons: number;
  sampleBenefitUnits: number;
  simulatedBenefitUnitMonths: number;
}

const FEDERAL_CASH_BENEFIT_2024_CENTS = 26_500_000_000 * 100;
const FEDERAL_KDU_PARTICIPATION_2024_CENTS = 11_100_000_000 * 100;
const FEDERAL_KDU_BASELINE_SHARE = 0.7;
const BUDGET_SOURCE_ID = "source-bundeshaushalt-2024-sgb2";

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error(`Ungültiger Monatswert ${value}.`);
  return year * 12 + month - 1;
}

export function inclusiveMonthCount(periodFrom: string, periodTo: string) {
  const count = monthIndex(periodTo) - monthIndex(periodFrom) + 1;
  if (count <= 0) throw new Error(`Ergebniszeitraum ${periodFrom} bis ${periodTo} ist ungültig.`);
  return count;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createSgb2ReproducibilityKey(input: Pick<Sgb2ReleaseValidationInput, "runId" | "policyVersionId" | "modelVersion" | "periodFrom" | "periodTo" | "paymentCents" | "components">) {
  const components = [...input.components]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${Math.round(item.paymentCents)}`)
    .join("|");
  return `sgb2-${fnv1a([input.runId, input.policyVersionId, input.modelVersion, input.periodFrom, input.periodTo, Math.round(input.paymentCents), components].join("|"))}`;
}

function componentValue(input: Sgb2ReleaseValidationInput, id: Sgb2ReleaseComponentId) {
  return input.components.find((item) => item.id === id)?.paymentCents ?? 0;
}

function comparison(
  id: string,
  label: string,
  scopeLabel: string,
  modelValueCents: number,
  referenceValueCents: number,
  boundaryDifferences: string[],
): Sgb2ReleaseComparison {
  const absoluteDeviationCents = modelValueCents - referenceValueCents;
  return {
    id,
    label,
    scopeLabel,
    period: "Ist 2024",
    sourceId: BUDGET_SOURCE_ID,
    referenceValueCents,
    modelValueCents,
    absoluteDeviationCents,
    relativeDeviation: absoluteDeviationCents / referenceValueCents,
    comparability: "mittel",
    boundaryDifferences,
  };
}

function performanceWarningThreshold(samplePersons: number) {
  if (samplePersons <= 2_500) return 15_000;
  if (samplePersons <= 10_000) return 60_000;
  return 120_000;
}

export function buildSgb2ReleaseValidation(input: Sgb2ReleaseValidationInput): Sgb2ReleaseValidationResult {
  if (!Number.isFinite(input.paymentCents) || input.paymentCents < 0) throw new Error("Der SGB-II-Zahlungsanspruch muss nichtnegativ und endlich sein.");
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) throw new Error("Die Berechnungsdauer muss nichtnegativ und endlich sein.");
  const months = inclusiveMonthCount(input.periodFrom, input.periodTo);
  const annualizationFactor = 12 / months;
  const cashModelCents = Math.round((componentValue(input, "standard-need") + componentValue(input, "additional-need")) * annualizationFactor);
  const federalKduModelCents = Math.round((componentValue(input, "accommodation") + componentValue(input, "heating")) * FEDERAL_KDU_BASELINE_SHARE * annualizationFactor);
  const relativeWidth = input.uncertaintyClass === "hoch" ? 0.2 : 0.1;
  const warningThresholdMs = performanceWarningThreshold(input.samplePersons);

  return {
    reproducibilityKey: createSgb2ReproducibilityKey(input),
    qualityStatus: input.uncertaintyClass === "hoch" ? "eingeschränkt" : "prüfbar",
    qualityLabel: input.uncertaintyClass === "hoch"
      ? "Technisch reproduzierbar, fachlich durch KdU-Fallbacks eingeschränkt"
      : "Technisch reproduzierbar mit transparentem amtlichem Vergleich",
    uncertaintyBand: {
      lowerCents: Math.max(0, Math.round(input.paymentCents * (1 - relativeWidth))),
      upperCents: Math.round(input.paymentCents * (1 + relativeWidth)),
      relativeWidth,
      interpretation: "Dokumentierte Sensitivitätskennzeichnung; kein statistisches Konfidenzintervall.",
    },
    comparisons: [
      comparison(
        "federal-cash-benefit-2024",
        "Bürgergeld – Bundeshaushaltstitel 1101 681 12",
        "Regelbedarf und Mehrbedarfe",
        cashModelCents,
        FEDERAL_CASH_BENEFIT_2024_CENTS,
        [
          "Der Modellwert wird aus dem Zeitraum Juli bis Dezember 2026 auf zwölf Monate annualisiert.",
          "Der amtliche Ist-Wert 2024 und der Rechtsstand Juli 2026 sind zeitlich nur teilweise vergleichbar.",
          "Der Haushaltstitel trennt Regelbedarf und Mehrbedarfe nicht in derselben Granularität wie das Modell.",
        ],
      ),
      comparison(
        "federal-kdu-participation-2024",
        "Bundesbeteiligung an Unterkunft und Heizung – Titel 1101 632 11",
        "Bundesanteil Unterkunft und Heizung",
        federalKduModelCents,
        FEDERAL_KDU_PARTICIPATION_2024_CENTS,
        [
          "Der Modellwert wird aus dem Zeitraum Juli bis Dezember 2026 auf zwölf Monate annualisiert.",
          "Die Baseline verwendet die offen ausgewiesene bundesweite Modellquote von 70 Prozent Bund.",
          "Der Haushaltstitel trennt Unterkunft und Heizung nicht in derselben Granularität wie das Modell.",
        ],
      ),
    ],
    performance: {
      durationMs: Math.round(input.durationMs),
      warningThresholdMs,
      status: input.durationMs <= warningThresholdMs ? "innerhalb" : "überschritten",
      samplePersons: input.samplePersons,
      sampleBenefitUnits: input.sampleBenefitUnits,
      simulatedBenefitUnitMonths: input.simulatedBenefitUnitMonths,
    },
    modelLimitations: [
      "Nichtinanspruchnahme wird nicht modelliert.",
      "Verwaltungskosten, Eingliederungsleistungen sowie Kranken- und Pflegeversicherungsbeiträge liegen außerhalb des direkten Zahlungsanspruchs.",
      "Fehlende kommunale Unterkunftsdaten können einen Modell-Fallback und damit hohe Unsicherheit auslösen.",
      "Langfristige Verhaltens-, Arbeitsmarkt- und Demografieeffekte sind nicht Bestandteil dieser direkten Mikrosimulation.",
    ],
  };
}
