import { defaultEffectParameters } from "./long-term-effects";
import { expenseModuleDefinitions, expenseParameterKey, type ExpenseModuleId } from "./expense-modules";
import { statutoryIncomeTax2026 } from "./income-tax";
import { defaultLongTermScenarioSettings } from "./long-term-scenario";
import { defaultScenarioDraft, type ScenarioDraftWithPopulationBasis } from "./scenario-state";
import { defaultSgb2PolicyBundle, type Sgb2HousingDatasetOverride, type Sgb2HousingOverrideField } from "./sgb2-policy";
import { getSgb2Parameter, sgb2UiFields, setSgb2UiParameter } from "./sgb2-ui";
import { revenueModuleDefinitions, revenueParameterKey, type RevenueModuleId } from "./revenue-modules";
import { effectRegistry } from "./effect-registry";
import type { IncomeTaxSettings, LongTermScenarioSettings, ModelLevel, TimeHorizon } from "./types";

export type ScenarioChangeCategory = "policy" | "assumption" | "framework";
export type ScenarioChangeValue = number | string | boolean;

export type ScenarioChangeTarget =
  | { kind: "income-tax"; key: keyof IncomeTaxSettings }
  | { kind: "revenue"; key: string; moduleId: RevenueModuleId }
  | { kind: "expense"; key: string; moduleId: ExpenseModuleId }
  | { kind: "sgb2-parameter"; parameterId: string }
  | { kind: "sgb2-housing"; datasetId: string; ruleId?: string; field: Sgb2HousingOverrideField }
  | { kind: "sgb2-financing"; component: string; payer: string }
  | { kind: "effect"; parameterId: string }
  | { kind: "long-term"; key: keyof LongTermScenarioSettings }
  | { kind: "model-level" }
  | { kind: "horizon" };

export interface ScenarioChange {
  id: string;
  category: ScenarioChangeCategory;
  group: string;
  module: string;
  label: string;
  description?: string;
  baseline: ScenarioChangeValue;
  current: ScenarioChangeValue;
  unit: string;
  formatParameterId?: string;
  route: "/einkommensteuer" | "/einnahmen" | "/ausgaben" | "/wirkungen" | "/langfrist" | "/dashboard";
  moduleId?: RevenueModuleId | ExpenseModuleId;
  target: ScenarioChangeTarget;
}

const revenueAssumptions = new Set([
  "ust.reducedShare", "ust.passThrough", "erb.averageRate", "erb.businessRelief", "verm.valuationDiscount",
  "kst.lossOffset", "kap.lossOffset", "energie.fuelIndex", "energie.electricityIndex", "energie.tobaccoIndex", "energie.alcoholIndex",
]);
const expenseAssumptions = new Set([
  "social.recipientIndex", "social.housingIndex", "social.caseManagementIndex", "pension.beneficiaryIndex",
  "education.learnerIndex", "education.executionRate", "family.uptakeIndex", "health.serviceVolumeIndex",
  "health.careRecipientIndex", "health.preventionSavings", "defense.executionRate", "infrastructure.executionRate",
  "subsidies.targetingSavings", "migration.accommodationIndex", "migration.procedureIndex", "migration.integrationIndex",
  "migration.educationOtherIndex",
]);
const incomeTaxLabels: Record<keyof IncomeTaxSettings, { label: string; unit: string }> = {
  allowance: { label: "Grundfreibetrag", unit: "€ / Jahr" },
  entryRate: { label: "Eingangssteuersatz", unit: "%" },
  topRate: { label: "Spitzensteuersatz", unit: "%" },
  topThreshold: { label: "Schwelle Spitzensteuersatz", unit: "€ / Jahr" },
  richRate: { label: "Reichensteuersatz", unit: "%" },
  childAllowance: { label: "Kinderfreibetrag", unit: "€ / Kind" },
  spouseSplitting: { label: "Ehegattensplitting", unit: "" },
};
const incomeTaxKeys = Object.keys(incomeTaxLabels) as Array<keyof IncomeTaxSettings>;
const sgb2FieldLabels = new Map(sgb2UiFields.map((field) => [field.id, { label: field.label, group: field.section }]));
const sgb2Groups: Record<string, string> = {
  "sgb2.standard-need.": "Regelbedarfe",
  "sgb2.additional-need.": "Mehrbedarfe",
  "sgb2.income.": "Einkommensanrechnung",
  "sgb2.reduction.": "Leistungsminderungen",
  "sgb2.housing.": "Unterkunft und Heizung",
  "sgb2.legacy.": "Übernommene Modellannahmen",
};
const sgb2SpecialLabels: Record<string, string> = {
  "sgb2.income.allowance-segment-1-lower": "Einkommensgrenze Stufe 1",
  "sgb2.income.allowance-segment-2-lower": "Einkommensgrenze Stufe 2",
  "sgb2.income.allowance-segment-3-lower": "Einkommensgrenze Stufe 3",
  "sgb2.reduction.first-breach-rate": "Minderung bei erster Pflichtverletzung",
  "sgb2.reduction.repeated-breach-rate": "Minderung bei wiederholter Pflichtverletzung",
  "sgb2.reduction.further-breach-rate": "Minderung bei weiterer Pflichtverletzung",
  "sgb2.reduction.missed-appointment-rate": "Minderung bei versäumtem Termin",
  "sgb2.reduction.default-duration-months": "Regeldauer einer Minderung",
};
const housingOverrideLabels: Record<Sgb2HousingOverrideField, string> = {
  adequateFloorArea: "Angemessene Wohnfläche",
  grossColdRentLimit: "Grenze für Bruttokaltmiete",
  baseRentLimit: "Grundmietgrenze",
  coldOperatingCostLimit: "Grenze für kalte Betriebskosten",
  maxRentPerSquareMeter: "Höchstmiete je Quadratmeter",
  heatingLimit: "Heizkostengrenze",
  modelCostIndex: "Kostenindex des Modell-Fallbacks",
};

const changed = (left: number, right: number) => Math.abs(left - right) > 1e-9;
const displayName = (value: string) => value.replace(/[-_.]/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("de-DE"));

function sgb2Group(parameterId: string) {
  return Object.entries(sgb2Groups).find(([prefix]) => parameterId.startsWith(prefix))?.[1] ?? "Weitere SGB-II-Regeln";
}

function sgb2Label(parameterId: string) {
  return sgb2SpecialLabels[parameterId] ?? sgb2FieldLabels.get(parameterId)?.label ?? displayName(parameterId.replace(/^sgb2\./, ""));
}

function sgb2Unit(unit: string) {
  if (unit === "cent-pro-monat") return "€ / Monat";
  if (unit === "anteil") return "%";
  if (unit === "monate") return "Monate";
  if (unit === "quadratmeter") return "m²";
  return unit === "index" ? "Index" : unit;
}

function housingParameterId(override: Sgb2HousingDatasetOverride) {
  const dataset = defaultSgb2PolicyBundle.housingDatasets.find((item) => item.id === override.datasetId);
  if (!dataset) return undefined;
  if (override.field === "modelCostIndex") return dataset.modelCostIndexParameterId;
  const rule = dataset.rules.find((item) => item.id === override.ruleId) ?? dataset.rules[0];
  if (rule) {
    const fieldToId: Partial<Record<Sgb2HousingOverrideField, string | undefined>> = {
      adequateFloorArea: rule.adequateFloorAreaParameterId,
      grossColdRentLimit: rule.grossColdRentLimitParameterId,
      baseRentLimit: rule.baseRentLimitParameterId,
      coldOperatingCostLimit: rule.coldOperatingCostLimitParameterId,
      maxRentPerSquareMeter: rule.maxRentPerSquareMeterParameterId,
      heatingLimit: rule.heatingLimitParameterId,
    };
    if (fieldToId[override.field]) return fieldToId[override.field];
  }
  if (override.field === "heatingLimit") return dataset.heatingRules?.find((item) => item.id === override.ruleId)?.monthlyLimitParameterIds[0];
  return undefined;
}

function housingBaseline(override: Sgb2HousingDatasetOverride): ScenarioChangeValue {
  if (!override.ruleId && override.field !== "modelCostIndex") return "Baseline je Haushaltsgröße";
  const parameterId = housingParameterId(override);
  if (!parameterId) return "Baseline nicht hinterlegt";
  const value = getSgb2Parameter(parameterId).value;
  return typeof value === "number" ? value : "Baseline nicht hinterlegt";
}

function longTermLabel(key: keyof LongTermScenarioSettings): { label: string; unit: string } {
  const labels: Record<keyof LongTermScenarioSettings, { label: string; unit: string }> = {
    targetYear: { label: "Zieljahr der Langfristprojektion", unit: "Jahr" },
    preset: { label: "Langfrist-Szenariopfad", unit: "" },
    workingAgeStart: { label: "Beginn des Erwerbsalters", unit: "Jahre" },
    retirementAge: { label: "Rentenalter", unit: "Jahre" },
    fertilityEffectStatus: { label: "Status der Geburtenannahme", unit: "" },
    fertilityEffectPct: { label: "Geburtenannahme", unit: "%" },
    migrationNetAnnual: { label: "Jährlicher Wanderungssaldo", unit: "Personen / Jahr" },
    protectionSharePct: { label: "Schutzanteil an Zuzügen", unit: "%" },
    accessDelayYears: { label: "Verzögerung des Arbeitsmarktzugangs", unit: "Jahre" },
    participationRatePct: { label: "Erwerbsbeteiligung", unit: "%" },
    employmentRatePct: { label: "Beschäftigungsquote", unit: "%" },
    workTimeFactorPct: { label: "Arbeitszeitfaktor", unit: "%" },
    contributionRatePct: { label: "Beitragssatz im Langfristpfad", unit: "%" },
    averageAnnualWage: { label: "Durchschnittlicher Jahreslohn", unit: "€ / Jahr" },
    pensionBenefitRatePct: { label: "Rentenniveau im Langfristpfad", unit: "%" },
    federalGrantBn: { label: "Bundeszuschuss im Langfristpfad", unit: "Mrd. €" },
  };
  return labels[key];
}

export function collectScenarioChanges(scenario: ScenarioDraftWithPopulationBasis): ScenarioChange[] {
  const changes: ScenarioChange[] = [];
  const add = (change: ScenarioChange) => changes.push(change);

  for (const key of incomeTaxKeys) {
    const baseline = statutoryIncomeTax2026[key];
    const current = scenario.incomeTax[key];
    if (baseline === current) continue;
    const meta = incomeTaxLabels[key];
    add({ id: `incomeTax.${key}`, category: "policy", group: "Einkommensteuer", module: "Einkommensteuer", label: meta.label, baseline, current, unit: meta.unit, route: "/einkommensteuer", target: { kind: "income-tax", key } });
  }

  for (const definition of revenueModuleDefinitions) {
    for (const parameter of definition.parameters) {
      const key = revenueParameterKey(definition.id, parameter.key);
      const current = scenario.revenueChanges[key] ?? parameter.baseline;
      if (changed(current, parameter.baseline)) {
        const isAssumption = revenueAssumptions.has(`${definition.id}.${parameter.key}`);
        add({ id: key, category: isAssumption ? "assumption" : "policy", group: isAssumption ? "Modell- und Wirkungsannahmen" : definition.label, module: definition.label, label: parameter.label, description: parameter.description, baseline: parameter.baseline, current, unit: parameter.unit, route: "/einnahmen", moduleId: definition.id, target: { kind: "revenue", key, moduleId: definition.id } });
      }
    }
  }

  for (const definition of expenseModuleDefinitions) {
    if (definition.id === "social") continue;
    for (const parameter of definition.parameters) {
      const key = expenseParameterKey(definition.id, parameter.key);
      const current = scenario.expenseChanges[key] ?? parameter.baseline;
      if (changed(current, parameter.baseline)) {
        const isAssumption = expenseAssumptions.has(`${definition.id}.${parameter.key}`);
        add({ id: key, category: isAssumption ? "assumption" : "policy", group: isAssumption ? "Modell- und Wirkungsannahmen" : definition.label, module: definition.label, label: parameter.label, description: parameter.description, baseline: parameter.baseline, current, unit: parameter.unit, route: "/ausgaben", moduleId: definition.id, target: { kind: "expense", key, moduleId: definition.id } });
      }
    }
  }

  for (const parameter of defaultSgb2PolicyBundle.parameters) {
    if (typeof parameter.value !== "number") continue;
    const override = scenario.sgb2.parameterOverrides.find((item) => item.parameterId === parameter.id);
    if (!override || typeof override.value !== "number" || !changed(override.value, parameter.value)) continue;
    const category: ScenarioChangeCategory = parameter.evidenceClass === "gesetz" ? "policy" : "assumption";
    const group = category === "assumption" ? "SGB-II-Modellannahmen" : sgb2Group(parameter.id);
    add({ id: parameter.id, category, group, module: "Bürgergeld und Unterkunft", label: sgb2Label(parameter.id), description: parameter.notes, baseline: parameter.value, current: override.value, unit: sgb2Unit(parameter.unit), route: "/ausgaben", moduleId: "social", target: { kind: "sgb2-parameter", parameterId: parameter.id } });
  }

  for (const override of scenario.sgb2.housingDatasetOverrides) {
    const baseline = housingBaseline(override);
    if (typeof baseline === "number" && !changed(override.value, baseline)) continue;
    const dataset = defaultSgb2PolicyBundle.housingDatasets.find((item) => item.id === override.datasetId);
    const isAssumption = override.field === "modelCostIndex" || dataset?.evidenceClass !== "gesetz";
    const region = dataset?.regionId === "DE" ? "Bundesweiter Fallback" : dataset?.regionId ?? "Regionale Grundlage";
    add({
      id: `sgb2.housingOverride.${override.datasetId}.${override.ruleId ?? "all"}.${override.field}`,
      category: isAssumption ? "assumption" : "policy",
      group: isAssumption ? "SGB-II-Modellannahmen" : "Unterkunft und Heizung",
      module: "Bürgergeld und Unterkunft",
      label: `${housingOverrideLabels[override.field]} · ${region}${override.ruleId ? ` · ${displayName(override.ruleId)}` : ""}`,
      baseline, current: override.value, unit: override.field === "adequateFloorArea" ? "m²" : override.field === "modelCostIndex" ? "Index" : "€ / Monat",
      formatParameterId: housingParameterId(override),
      route: "/ausgaben", moduleId: "social", target: { kind: "sgb2-housing", datasetId: override.datasetId, ruleId: override.ruleId, field: override.field },
    });
  }

  for (const override of scenario.sgb2.financingOverrides) {
    add({
      id: `sgb2.financing.${override.component}.${override.payer}`, category: "assumption", group: "Kostenträgerzuordnung", module: "Bürgergeld und Unterkunft",
      label: `${displayName(override.component)} · ${displayName(override.payer)}`, baseline: "Nicht separat festgelegt", current: override.share * 100, unit: "%",
      route: "/ausgaben", moduleId: "social", target: { kind: "sgb2-financing", component: override.component, payer: override.payer },
    });
  }

  const effectParameters = new Map(effectRegistry.flatMap((module) => module.parameters.map((parameter) => [parameter.id, { ...parameter, group: module.title }] as const)));
  for (const [parameterId, meta] of effectParameters) {
    const current = scenario.effectParameters[parameterId] ?? defaultEffectParameters[parameterId];
    const baseline = meta.defaultValue;
    if (typeof current !== "number" || !changed(current, baseline)) continue;
    add({ id: `effect.${parameterId}`, category: "assumption", group: meta.group, module: "Wirkungsannahmen", label: meta.label, description: meta.description, baseline, current, unit: meta.unit, route: "/wirkungen", target: { kind: "effect", parameterId } });
  }

  if (scenario.modelLevel !== defaultScenarioDraft.modelLevel) add({ id: "framework.modelLevel", category: "framework", group: "Berechnungsrahmen", module: "Berechnungsrahmen", label: "Modellstufe", baseline: defaultScenarioDraft.modelLevel, current: scenario.modelLevel, unit: "", route: "/dashboard", target: { kind: "model-level" } });
  if (scenario.horizonYears !== defaultScenarioDraft.horizonYears) add({ id: "framework.horizonYears", category: "framework", group: "Berechnungsrahmen", module: "Berechnungsrahmen", label: "Zeithorizont", baseline: defaultScenarioDraft.horizonYears, current: scenario.horizonYears, unit: "Jahre", route: "/dashboard", target: { kind: "horizon" } });

  for (const key of Object.keys(defaultLongTermScenarioSettings) as Array<keyof LongTermScenarioSettings>) {
    const baseline = defaultLongTermScenarioSettings[key];
    const current = scenario.longTerm[key];
    if (baseline === current) continue;
    const meta = longTermLabel(key);
    add({ id: `longTerm.${key}`, category: "assumption", group: "Langfristannahmen", module: "Langfristprojektion", label: meta.label, baseline, current, unit: meta.unit, route: "/langfrist", target: { kind: "long-term", key } });
  }

  const categoryOrder: Record<ScenarioChangeCategory, number> = { policy: 0, assumption: 1, framework: 2 };
  return changes.sort((left, right) => categoryOrder[left.category] - categoryOrder[right.category] || left.module.localeCompare(right.module, "de") || left.group.localeCompare(right.group, "de") || left.label.localeCompare(right.label, "de"));
}

export function resetScenarioChange(scenario: ScenarioDraftWithPopulationBasis, target: ScenarioChangeTarget): Partial<ScenarioDraftWithPopulationBasis> {
  if (target.kind === "income-tax") return { incomeTax: { ...scenario.incomeTax, [target.key]: statutoryIncomeTax2026[target.key] } };
  if (target.kind === "revenue") {
    const revenueChanges = { ...scenario.revenueChanges };
    delete revenueChanges[target.key];
    return { revenueChanges };
  }
  if (target.kind === "expense") {
    const expenseChanges = { ...scenario.expenseChanges };
    delete expenseChanges[target.key];
    return { expenseChanges };
  }
  if (target.kind === "sgb2-parameter") {
    return { sgb2: setSgb2UiParameter(scenario.sgb2, target.parameterId, getSgb2Parameter(target.parameterId).value as number) };
  }
  if (target.kind === "sgb2-housing") {
    return { sgb2: { ...scenario.sgb2, housingDatasetOverrides: scenario.sgb2.housingDatasetOverrides.filter((item) => !(item.datasetId === target.datasetId && item.ruleId === target.ruleId && item.field === target.field)) } };
  }
  if (target.kind === "sgb2-financing") {
    return { sgb2: { ...scenario.sgb2, financingOverrides: scenario.sgb2.financingOverrides.filter((item) => !(item.component === target.component && item.payer === target.payer)) } };
  }
  if (target.kind === "effect") {
    return { effectParameters: { ...scenario.effectParameters, [target.parameterId]: defaultEffectParameters[target.parameterId] } };
  }
  if (target.kind === "long-term") return { longTerm: { ...scenario.longTerm, [target.key]: defaultLongTermScenarioSettings[target.key] } };
  if (target.kind === "model-level") return { modelLevel: defaultScenarioDraft.modelLevel as ModelLevel };
  return { horizonYears: defaultScenarioDraft.horizonYears as TimeHorizon };
}

export function formatScenarioChangeValue(value: ScenarioChangeValue, unit: string, id?: string) {
  if (typeof value === "boolean") return value ? "Aktiviert" : "Deaktiviert";
  if (typeof value === "string") {
    if (value === "statisch") return "Statisch";
    if (value === "verhalten") return "Mit Verhaltensreaktionen";
    if (value === "langfrist") return "Langfristig";
    if (value === "nicht-berechnet") return "Nicht berechnet";
    if (value === "gerichteter-zusammenhang") return "Gerichteter Zusammenhang";
    if (value === "szenarioband-berechenbar") return "Szenarioband berechenbar";
    const presets: Record<string, string> = {
      "amtliche-referenz": "Amtliche Referenz", "niedrigere-nettozuwanderung": "Niedrigere Nettozuwanderung",
      "hoehere-nettozuwanderung": "Höhere Nettozuwanderung", "frueherer-arbeitsmarktzugang": "Früherer Arbeitsmarktzugang",
      "spaeteres-rentenalter": "Späteres Rentenalter", "familienpolitischer-wirkungspfad": "Familienpolitischer Wirkungspfad",
    };
    return presets[value] ?? value;
  }
  const parameter = id ? defaultSgb2PolicyBundle.parameters.find((item) => item.id === id) : undefined;
  const actual = parameter?.unit === "anteil" && unit === "%" ? value * 100 : value;
  const converted = parameter?.unit === "cent-pro-monat" && unit === "€ / Monat" ? value / 100 : actual;
  const maximumFractionDigits = Number.isInteger(converted) ? 0 : 2;
  return converted.toLocaleString("de-DE", { maximumFractionDigits }) + (unit ? ` ${unit}` : "");
}
