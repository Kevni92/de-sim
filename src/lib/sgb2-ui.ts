import { defaultSgb2PolicyBundle, type Sgb2Parameter, type Sgb2ScenarioReference } from "./sgb2-policy";
import type { Sgb2ReleaseValidationResult } from "./sgb2-release-validation";

export type Sgb2UiMode = "simple" | "expert";
export type Sgb2UiGroupId = "standard-needs" | "additional-needs" | "income-allowances" | "housing";

export interface Sgb2UiGroup {
  id: Sgb2UiGroupId;
  label: string;
  description: string;
  parameterIds: string[];
}

export interface Sgb2UiField {
  id: string;
  label: string;
  description: string;
  section: Sgb2UiGroupId;
}

export interface Sgb2UiPreviewComponent {
  id: "standard-need" | "additional-need" | "accommodation" | "heating";
  label: string;
  baselineCents: number;
  scenarioCents: number;
  deltaCents: number;
}

export interface Sgb2UiPreviewPayer {
  payer: string;
  label: string;
  scenarioCents: number;
}

export interface Sgb2UiPreviewResult {
  runId: string;
  periodFrom: string;
  periodTo: string;
  baselinePaymentCents: number;
  scenarioPaymentCents: number;
  deltaPaymentCents: number;
  affectedBenefitUnits: number;
  affectedPersons: number;
  weightedPaymentMonths: number;
  components: Sgb2UiPreviewComponent[];
  payers: Sgb2UiPreviewPayer[];
  calibrationAdjustmentCents: number;
  sourceIds: string[];
  uncertaintyClass: "mittel" | "hoch";
  limitations: string[];
  releaseValidation: Sgb2ReleaseValidationResult;
}

const parameters = defaultSgb2PolicyBundle.parameters;
const parameterMap = new Map(parameters.map((parameter) => [parameter.id, parameter]));

const idsWithPrefix = (...prefixes: string[]) => parameters
  .filter((parameter) => prefixes.some((prefix) => parameter.id.startsWith(prefix)))
  .map((parameter) => parameter.id)
  .sort((a, b) => a.localeCompare(b));

const curatedHousingIds = [
  ...idsWithPrefix("sgb2.housing.berlin-2026.gross-cold-rent."),
  ...idsWithPrefix("sgb2.housing.berlin-2026.heating.natural-gas.501-1000."),
  "sgb2.housing.grace-period-months",
  "sgb2.housing.grace-cap-factor",
  "sgb2.housing.cost-reduction-transition-months",
  "sgb2.housing.fallback.cost-index",
].filter((id) => parameterMap.has(id));

export const sgb2UiGroups: Sgb2UiGroup[] = [
  {
    id: "standard-needs",
    label: "Regelbedarfe",
    description: "Monatliche Eurobeträge für Erwachsene, Partner und Kinder.",
    parameterIds: idsWithPrefix("sgb2.standard-need."),
  },
  {
    id: "additional-needs",
    label: "Mehrbedarfe",
    description: "Prozentsätze für Schwangerschaft, Alleinerziehende und Teilhabe.",
    parameterIds: idsWithPrefix("sgb2.additional-need."),
  },
  {
    id: "income-allowances",
    label: "Freibeträge",
    description: "Grundabzug, Einkommensgrenzen und gestufte Erwerbstätigenfreibeträge.",
    parameterIds: idsWithPrefix("sgb2.income."),
  },
  {
    id: "housing",
    label: "Unterkunft und Heizung",
    description: "Berliner Richtwerte, Heizgrenzen sowie Karenz- und Fallbackparameter.",
    parameterIds: curatedHousingIds,
  },
];

const labels: Record<string, string> = {
  "sgb2.standard-need.single": "Alleinstehende Erwachsene",
  "sgb2.standard-need.partner": "Erwachsene Partner",
  "sgb2.standard-need.adult-under-25": "Erwachsene unter 25 im Haushalt",
  "sgb2.standard-need.child-14-17": "Kinder 14 bis 17 Jahre",
  "sgb2.standard-need.child-6-13": "Kinder 6 bis 13 Jahre",
  "sgb2.standard-need.child-0-5": "Kinder 0 bis 5 Jahre",
  "sgb2.additional-need.pregnancy-rate": "Mehrbedarf Schwangerschaft",
  "sgb2.additional-need.single-parent-primary-rate": "Alleinerziehende Hauptfall",
  "sgb2.additional-need.single-parent-per-child-rate": "Alleinerziehende je Kind",
  "sgb2.additional-need.single-parent-cap-rate": "Alleinerziehende Höchstgrenze",
  "sgb2.additional-need.disability-participation-rate": "Mehrbedarf Teilhabeleistung",
  "sgb2.income.base-deduction": "Grundabsetzbetrag Erwerbseinkommen",
  "sgb2.income.allowance-segment-1-upper": "Freibetragsgrenze Stufe 1",
  "sgb2.income.allowance-segment-1-rate": "Freibetragssatz Stufe 1",
  "sgb2.income.allowance-segment-2-upper": "Freibetragsgrenze Stufe 2",
  "sgb2.income.allowance-segment-2-rate": "Freibetragssatz Stufe 2",
  "sgb2.income.allowance-segment-3-upper": "Freibetragsgrenze ohne Kind",
  "sgb2.income.allowance-segment-3-child-upper": "Freibetragsgrenze mit Kind",
  "sgb2.income.allowance-segment-3-rate": "Freibetragssatz Stufe 3",
  "sgb2.housing.grace-period-months": "Karenzzeit",
  "sgb2.housing.grace-cap-factor": "Karenzzeitdeckel",
  "sgb2.housing.cost-reduction-transition-months": "Kostensenkungszeitraum",
  "sgb2.housing.fallback.cost-index": "KdU-Modell-Fallback",
};

function humanizeHousingId(id: string) {
  const gross = id.match(/gross-cold-rent\.(hh\d|additional-person)$/);
  if (gross) return gross[1] === "additional-person" ? "Bruttokaltmiete je weitere Person" : `Bruttokaltmiete ${gross[1].replace("hh", "")} Person(en)`;
  const heating = id.match(/heating\.natural-gas\.501-1000\.(hh\d|additional-person)$/);
  if (heating) return heating[1] === "additional-person" ? "Heizgrenze Erdgas je weitere Person" : `Heizgrenze Erdgas ${heating[1].replace("hh", "")} Person(en)`;
  return id;
}

function descriptionFor(parameter: Sgb2Parameter) {
  if (parameter.notes) return parameter.notes;
  if (parameter.id.startsWith("sgb2.standard-need.")) return "Gesetzlicher monatlicher Regelbedarf in der gewählten Bedarfskategorie.";
  if (parameter.id.startsWith("sgb2.additional-need.")) return "Anteil am persönlichen Regelbedarf.";
  if (parameter.id.startsWith("sgb2.income.")) return "Parameter der Einkommensanrechnung und Erwerbstätigenfreibeträge.";
  if (parameter.id.startsWith("sgb2.housing.")) return "Regionaler oder bundesweiter Parameter für Unterkunft und Heizung.";
  return "Versionierter Parameter des SGB-II-Modells.";
}

export const sgb2UiFields: Sgb2UiField[] = sgb2UiGroups.flatMap((group) => group.parameterIds.map((id) => {
  const parameter = parameterMap.get(id)!;
  return {
    id,
    label: labels[id] ?? humanizeHousingId(id),
    description: descriptionFor(parameter),
    section: group.id,
  };
}));

export function getSgb2Parameter(id: string) {
  const parameter = parameterMap.get(id);
  if (!parameter) throw new Error(`SGB-II-Parameter ${id} ist nicht verfügbar.`);
  return parameter;
}

export function resolvedSgb2UiValue(reference: Sgb2ScenarioReference, parameterId: string) {
  const override = reference.parameterOverrides.find((item) => item.parameterId === parameterId);
  return override?.value ?? getSgb2Parameter(parameterId).value;
}

function constrainedValue(parameter: Sgb2Parameter, value: number) {
  if (!Number.isFinite(value)) throw new Error(`${parameter.id} benötigt einen endlichen Wert.`);
  const min = parameter.constraints?.min ?? Number.NEGATIVE_INFINITY;
  const max = parameter.constraints?.max ?? Number.POSITIVE_INFINITY;
  const constrained = Math.min(max, Math.max(min, value));
  return parameter.constraints?.integer ? Math.round(constrained) : Math.round(constrained * 1_000_000_000_000) / 1_000_000_000_000;
}

export function setSgb2UiParameter(reference: Sgb2ScenarioReference, parameterId: string, value: number): Sgb2ScenarioReference {
  const parameter = getSgb2Parameter(parameterId);
  if (typeof parameter.value !== "number") throw new Error(`${parameterId} ist kein numerischer UI-Parameter.`);
  const nextValue = constrainedValue(parameter, value);
  const without = reference.parameterOverrides.filter((item) => item.parameterId !== parameterId);
  const baseline = parameter.value;
  const parameterOverrides = Math.abs(nextValue - baseline) < 1e-9
    ? without
    : [...without, { parameterId, value: nextValue }];
  parameterOverrides.sort((a, b) => a.parameterId.localeCompare(b.parameterId));
  return { ...reference, parameterOverrides };
}

export function sgb2UiGroupPercent(reference: Sgb2ScenarioReference, groupId: Sgb2UiGroupId) {
  const group = sgb2UiGroups.find((item) => item.id === groupId);
  if (!group?.parameterIds.length) return { percent: 100, mixed: false };
  const ratios = group.parameterIds.map((id) => {
    const baseline = getSgb2Parameter(id).value;
    const current = resolvedSgb2UiValue(reference, id);
    return typeof baseline === "number" && baseline !== 0 && typeof current === "number" ? current / baseline * 100 : 100;
  });
  const rawPercent = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  const percent = Math.round(rawPercent * 1_000_000_000) / 1_000_000_000;
  return { percent, mixed: ratios.some((value) => Math.abs(value - percent) > 0.05) };
}

export function setSgb2UiGroupPercent(reference: Sgb2ScenarioReference, groupId: Sgb2UiGroupId, percent: number) {
  const group = sgb2UiGroups.find((item) => item.id === groupId);
  if (!group) throw new Error(`Unbekannte Parametergruppe ${groupId}.`);
  return group.parameterIds.reduce((next, parameterId) => {
    const parameter = getSgb2Parameter(parameterId);
    if (typeof parameter.value !== "number") return next;
    return setSgb2UiParameter(next, parameterId, parameter.value * percent / 100);
  }, reference);
}

export function resetSgb2Ui(reference: Sgb2ScenarioReference): Sgb2ScenarioReference {
  return {
    ...reference,
    parameterOverrides: [],
    housingDatasetOverrides: [],
    financingOverrides: [],
    migrationNotes: [],
  };
}

export function sgb2UiHasChanges(reference: Sgb2ScenarioReference) {
  return reference.parameterOverrides.length > 0 || reference.housingDatasetOverrides.length > 0 || reference.financingOverrides.length > 0;
}

export function sgb2UiInputStep(parameter: Sgb2Parameter) {
  if (parameter.unit === "cent-pro-monat") return 100;
  if (parameter.unit === "anteil") return 0.01;
  if (parameter.unit === "monate") return 1;
  if (parameter.unit === "quadratmeter") return 1;
  if (parameter.unit === "index") return 1;
  return 0.01;
}

export function sgb2UiDisplayValue(parameter: Sgb2Parameter, value: number) {
  if (parameter.unit === "cent-pro-monat") return `${(value / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (parameter.unit === "anteil") return `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
  if (parameter.unit === "monate") return `${value.toLocaleString("de-DE")} Monate`;
  if (parameter.unit === "quadratmeter") return `${value.toLocaleString("de-DE")} m²`;
  if (parameter.unit === "index") return `Index ${value.toLocaleString("de-DE")}`;
  return value.toLocaleString("de-DE");
}

export function sgb2UiInputValue(parameter: Sgb2Parameter, value: number) {
  return parameter.unit === "cent-pro-monat" ? value / 100 : parameter.unit === "anteil" ? value * 100 : value;
}

export function sgb2UiModelValue(parameter: Sgb2Parameter, inputValue: number) {
  return parameter.unit === "cent-pro-monat" ? Math.round(inputValue * 100) : parameter.unit === "anteil" ? inputValue / 100 : inputValue;
}
