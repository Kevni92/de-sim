import type { ModelLevel, TimeHorizon } from "./types";

export type CalculationFreshness = "current" | "updating" | "stale";

export interface ModelLevelOption {
  value: ModelLevel;
  label: string;
  description: string;
  caution: string;
}

export interface TimeHorizonOption {
  value: TimeHorizon;
  label: string;
}

export const MODEL_LEVEL_OPTIONS: readonly ModelLevelOption[] = [
  {
    value: "statisch",
    label: "Nur direkte Wirkung",
    description: "Unmittelbare finanzielle Erstwirkung ohne Verhaltensreaktion.",
    caution: "Der Zeitraum ordnet Ergebnisse zeitlich ein, ergänzt aber keine Folgewirkung.",
  },
  {
    value: "verhalten",
    label: "Mit kurzfristigen Reaktionen",
    description: "Dokumentierte kurzfristige Verhaltensanpassung und begrenzte Folgewirkungen.",
    caution: "Reaktionen werden getrennt von der direkten Wirkung ausgewiesen und bleiben Modellschätzungen.",
  },
  {
    value: "langfrist",
    label: "Langfristiges Szenario",
    description: "Zusätzliche Zeitpfade und langfristige Modellannahmen mit höherer Unsicherheit.",
    caution: "Langfristige Ergebnisse sind Szenariopfade und keine sichere Prognose.",
  },
] as const;

export const TIME_HORIZON_OPTIONS: readonly TimeHorizonOption[] = [
  { value: 1, label: "1 Jahr" },
  { value: 5, label: "5 Jahre" },
  { value: 10, label: "10 Jahre" },
  { value: 20, label: "20 Jahre" },
] as const;

export function modelLevelOption(level: ModelLevel): ModelLevelOption {
  return MODEL_LEVEL_OPTIONS.find((option) => option.value === level) ?? MODEL_LEVEL_OPTIONS[1];
}

export function modelLevelLabel(level: ModelLevel): string {
  return modelLevelOption(level).label;
}

export function modelLevelDescription(level: ModelLevel): string {
  return modelLevelOption(level).description;
}

export function modelLevelCaution(level: ModelLevel): string {
  return modelLevelOption(level).caution;
}

export function timeHorizonLabel(years: TimeHorizon | number): string {
  return TIME_HORIZON_OPTIONS.find((option) => option.value === years)?.label ?? `${years} Jahre`;
}

export function calculationFreshnessLabel(status: CalculationFreshness): string {
  if (status === "updating") return "Aktualisierung läuft";
  if (status === "stale") return "Verwendet ältere Einstellung";
  return "Aktuell";
}

export function resolveCalculationFreshness({
  loading,
  hasResult,
  runModelLevel,
  runHorizonYears,
  modelLevel,
  horizonYears,
  runInputSignature,
  inputSignature,
}: {
  loading: boolean;
  hasResult: boolean;
  runModelLevel?: ModelLevel;
  runHorizonYears?: number;
  modelLevel: ModelLevel;
  horizonYears: number;
  runInputSignature?: string;
  inputSignature?: string;
}): CalculationFreshness {
  if (loading) return "updating";
  if (!hasResult) return "stale";
  if (inputSignature && runInputSignature !== inputSignature) return "stale";
  return runModelLevel === modelLevel && runHorizonYears === horizonYears ? "current" : "stale";
}
