import { defaultSgb2PolicyBundle } from "./sgb2-baseline";
import type {
  HousingAllowanceDataset,
  HousingAllowanceRule,
  HousingHeatingLimitRule,
  Sgb2PolicyBundle,
  Sgb2ScenarioReference,
  Sgb2UncertaintyClass,
} from "./sgb2-contracts";
import { resolveSgb2ParameterValues } from "./sgb2-scenario";
import type { Sgb2BenefitUnit } from "./types";
import {
  SGB2_HOUSING_MODEL_VERSION,
  SGB2_HOUSING_RESULT_SCHEMA_VERSION,
  type Sgb2HousingBatchResult,
  type Sgb2HousingCostResult,
  type Sgb2HousingLookupLevel,
  type Sgb2HousingRecognitionStatus,
  type Sgb2HousingRuntimeFacts,
  type Sgb2HousingValidationIssue,
} from "./sgb2-housing-contracts";

export * from "./sgb2-housing-contracts";
export { BERLIN_2026_HOUSING_DATASET_ID } from "./sgb2-housing-data";

interface CalculationContext {
  bundle: Sgb2PolicyBundle;
  reference: Sgb2ScenarioReference;
  values: Map<string, number | string | boolean>;
}

interface DatasetSelection {
  dataset: HousingAllowanceDataset;
  lookupLevel: Sgb2HousingLookupLevel;
  trace: string[];
}

function cents(value: number, path: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${path} muss eine nichtnegative endliche Zahl sein.`);
  return Math.round(value);
}

function positiveInteger(value: number, path: string) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${path} muss eine positive ganze Zahl sein.`);
  return value;
}

function referenceMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Referenzmonat muss das Format YYYY-MM haben.");
  return value;
}

function monthIndex(value: string) {
  const normalized = referenceMonth(value);
  return Number(normalized.slice(0, 4)) * 12 + Number(normalized.slice(5, 7)) - 1;
}

function monthsSince(start: string | undefined, current: string) {
  if (!start) return null;
  return monthIndex(current) - monthIndex(start);
}

function numericParameter(context: CalculationContext, id: string) {
  const value = context.values.get(id);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Parameter ${id} ist nicht numerisch verfügbar.`);
  return value;
}

function activeInMonth(dataset: HousingAllowanceDataset, month: string) {
  const date = `${month}-01`;
  return dataset.validFrom <= date && (!dataset.validTo || dataset.validTo >= date);
}

function normalizeRegion(value: string) {
  return value.trim().toLowerCase();
}

function isRegionParent(datasetRegion: string, requestedRegion: string) {
  const parent = normalizeRegion(datasetRegion);
  const requested = normalizeRegion(requestedRegion);
  return requested.startsWith(`${parent}:`) || requested.startsWith(`${parent}-`);
}

function selectDataset(context: CalculationContext, month: string, regionId: string, providerId: string | undefined, forceDatasetId: string | undefined): DatasetSelection {
  const trace: string[] = [];
  const active = context.bundle.housingDatasets.filter((dataset) => activeInMonth(dataset, month));
  const staleRelated = context.bundle.housingDatasets.filter((dataset) => {
    const related = normalizeRegion(dataset.regionId) === normalizeRegion(regionId) || isRegionParent(dataset.regionId, regionId);
    return related && !activeInMonth(dataset, month);
  });
  staleRelated.forEach((dataset) => trace.push(`Datensatz ${dataset.id} ist im Referenzmonat ${month} nicht gültig und wurde nicht verwendet.`));

  if (forceDatasetId) {
    const forced = active.find((dataset) => dataset.id === forceDatasetId);
    if (!forced) throw new Error(`Erzwungener KdU-Datensatz ${forceDatasetId} ist im Referenzmonat ${month} nicht verfügbar.`);
    trace.push(`Datensatz ${forced.id} wurde ausdrücklich ausgewählt.`);
    return { dataset: forced, lookupLevel: forced.status === "active" ? "region" : "model-fallback", trace };
  }

  const exactProvider = providerId
    ? active.find((dataset) => dataset.providerId === providerId && normalizeRegion(dataset.regionId) === normalizeRegion(regionId))
    : undefined;
  if (exactProvider) {
    trace.push(`Exakter kommunaler Träger ${providerId} und Region ${regionId} wurden gefunden.`);
    return { dataset: exactProvider, lookupLevel: "provider", trace };
  }

  const exactRegion = active.find((dataset) => normalizeRegion(dataset.regionId) === normalizeRegion(regionId) && (!dataset.providerId || !providerId || dataset.providerId === providerId));
  if (exactRegion) {
    trace.push(`Exakter Regionaldatensatz für ${regionId} wurde gefunden.`);
    return { dataset: exactRegion, lookupLevel: "region", trace };
  }

  const parentRegion = active
    .filter((dataset) => dataset.status === "active" && isRegionParent(dataset.regionId, regionId))
    .sort((a, b) => b.regionId.length - a.regionId.length || a.id.localeCompare(b.id))[0];
  if (parentRegion) {
    trace.push(`Für ${regionId} wurde der übergeordnete Regionaldatensatz ${parentRegion.regionId} verwendet.`);
    return { dataset: parentRegion, lookupLevel: "parent-region", trace };
  }

  const fallback = active.find((dataset) => dataset.status !== "active" && normalizeRegion(dataset.regionId) === "de");
  if (fallback) {
    trace.push(`Für ${regionId} fehlen passende regionale Grenzwerte; der dokumentierte Modell-Fallback ${fallback.id} wird verwendet.`);
    return { dataset: fallback, lookupLevel: "model-fallback", trace };
  }

  throw new Error(`Für Region ${regionId} ist im Referenzmonat ${month} weder ein regionaler KdU-Datensatz noch ein Modell-Fallback verfügbar.`);
}

function ruleForSize(dataset: HousingAllowanceDataset, householdSize: number) {
  const matches = dataset.rules.filter((rule) => householdSize >= rule.householdSizeMin && (rule.householdSizeMax === undefined || householdSize <= rule.householdSizeMax));
  if (matches.length !== 1) throw new Error(`KdU-Datensatz ${dataset.id} muss für Haushaltsgröße ${householdSize} genau eine Regel liefern; gefunden wurden ${matches.length}.`);
  return matches[0];
}

function overrideValue(context: CalculationContext, datasetId: string, ruleId: string | undefined, field: "adequateFloorArea" | "grossColdRentLimit" | "heatingLimit" | "modelCostIndex") {
  const exact = context.reference.housingDatasetOverrides.find((override) => override.datasetId === datasetId && override.ruleId === ruleId && override.field === field);
  const datasetWide = context.reference.housingDatasetOverrides.find((override) => override.datasetId === datasetId && override.ruleId === undefined && override.field === field);
  return exact?.value ?? datasetWide?.value;
}

function ruleAmount(context: CalculationContext, dataset: HousingAllowanceDataset, rule: HousingAllowanceRule, householdSize: number, kind: "floor" | "gross-cold") {
  const baseParameterId = kind === "floor" ? rule.adequateFloorAreaParameterId : rule.grossColdRentLimitParameterId;
  const field = kind === "floor" ? "adequateFloorArea" : "grossColdRentLimit";
  const override = overrideValue(context, dataset.id, rule.id, field);
  let value = override ?? (baseParameterId ? numericParameter(context, baseParameterId) : null);
  const parameterIds = baseParameterId ? [baseParameterId] : [];
  const threshold = rule.additionalPersonFromHouseholdSize;
  if (value !== null && threshold !== undefined && householdSize > threshold) {
    const additionalParameterId = kind === "floor" ? rule.additionalPersonAdequateFloorAreaParameterId : rule.additionalPersonGrossColdRentLimitParameterId;
    const additional = additionalParameterId ? numericParameter(context, additionalParameterId) : 0;
    value += additional * (householdSize - threshold);
    if (additionalParameterId) parameterIds.push(additionalParameterId);
  }
  return { value: value === null ? null : cents(value, `${dataset.id}.${rule.id}.${kind}`), parameterIds };
}

function heatingRuleForFacts(dataset: HousingAllowanceDataset, energySource: Sgb2HousingRuntimeFacts["heatingEnergySource"], buildingArea: number | undefined) {
  if (!dataset.heatingRules?.length || !energySource || energySource === "unknown" || buildingArea === undefined) return null;
  return dataset.heatingRules.find((rule) => rule.energySource === energySource && buildingArea >= rule.buildingAreaMin && (rule.buildingAreaMax === undefined || buildingArea <= rule.buildingAreaMax)) ?? null;
}

function heatingLimit(context: CalculationContext, dataset: HousingAllowanceDataset, rule: HousingHeatingLimitRule, householdSize: number) {
  const override = overrideValue(context, dataset.id, rule.id, "heatingLimit");
  if (override !== undefined) return { value: cents(override, `${dataset.id}.${rule.id}.heatingLimit`), parameterIds: [] };
  const baseSize = Math.min(householdSize, 5);
  const parameterId = rule.monthlyLimitParameterIds[baseSize - 1];
  let value = numericParameter(context, parameterId);
  const parameterIds = [parameterId];
  if (householdSize > 5) {
    value += numericParameter(context, rule.additionalPersonLimitParameterId) * (householdSize - 5);
    parameterIds.push(rule.additionalPersonLimitParameterId);
  }
  return { value: cents(value, `${dataset.id}.${rule.id}.heatingLimit`), parameterIds };
}

function modelCostIndex(context: CalculationContext, dataset: HousingAllowanceDataset) {
  const override = overrideValue(context, dataset.id, undefined, "modelCostIndex");
  if (override !== undefined) return override;
  if (!dataset.modelCostIndexParameterId) return 100;
  return numericParameter(context, dataset.modelCostIndexParameterId);
}

function splitGrossCold(recognizedGrossColdRentCents: number, actualBaseRentCents: number, actualColdOperatingCostsCents: number) {
  const total = actualBaseRentCents + actualColdOperatingCostsCents;
  if (total <= 0 || recognizedGrossColdRentCents <= 0) return { recognizedBaseRentCents: 0, recognizedColdOperatingCostsCents: 0 };
  const recognizedBaseRentCents = Math.min(actualBaseRentCents, Math.round(recognizedGrossColdRentCents * actualBaseRentCents / total));
  return {
    recognizedBaseRentCents,
    recognizedColdOperatingCostsCents: recognizedGrossColdRentCents - recognizedBaseRentCents,
  };
}

function maxUncertainty(first: Sgb2UncertaintyClass, second: Sgb2UncertaintyClass): Sgb2UncertaintyClass {
  const order: Record<Sgb2UncertaintyClass, number> = { niedrig: 0, mittel: 1, hoch: 2 };
  return order[first] >= order[second] ? first : second;
}

export function calculateSgb2HousingCosts(
  unit: Sgb2BenefitUnit,
  reference: Sgb2ScenarioReference,
  facts: Sgb2HousingRuntimeFacts = {},
  bundle: Sgb2PolicyBundle = defaultSgb2PolicyBundle,
): Sgb2HousingCostResult {
  const context: CalculationContext = { bundle, reference, values: resolveSgb2ParameterValues(reference, bundle) };
  const month = referenceMonth(facts.referenceMonth ?? bundle.policy.validFrom.slice(0, 7));
  const regionId = facts.regionId ?? unit.housing.regionId;
  const providerId = facts.providerId ?? unit.housing.municipalityProviderId;
  const householdSize = positiveInteger(facts.householdSize ?? unit.memberIds.length, "Haushaltsgröße");
  const actualBaseRentCents = cents(facts.actualBaseRentCents ?? unit.housing.baseRentCents, "Tatsächliche Grundmiete");
  const actualColdOperatingCostsCents = cents(facts.actualColdOperatingCostsCents ?? unit.housing.coldOperatingCostsCents, "Tatsächliche kalte Betriebskosten");
  const actualGrossColdRentCents = actualBaseRentCents + actualColdOperatingCostsCents;
  const actualHeatingCostsCents = cents(facts.actualHeatingCostsCents ?? unit.housing.heatingCostsCents, "Tatsächliche Heizkosten");
  const floorAreaSquareMeters = facts.floorAreaSquareMeters ?? unit.housing.floorAreaSquareMeters;
  if (!Number.isFinite(floorAreaSquareMeters) || floorAreaSquareMeters < 0) throw new Error("Wohnfläche muss eine nichtnegative endliche Zahl sein.");

  const selection = selectDataset(context, month, regionId, providerId, facts.forceDatasetId);
  const dataset = selection.dataset;
  const rule = ruleForSize(dataset, householdSize);
  const floor = ruleAmount(context, dataset, rule, householdSize, "floor");
  const grossCold = ruleAmount(context, dataset, rule, householdSize, "gross-cold");
  const heatingRule = heatingRuleForFacts(dataset, facts.heatingEnergySource, facts.heatedBuildingAreaSquareMeters);
  const heat = heatingRule ? heatingLimit(context, dataset, heatingRule, householdSize) : { value: null as number | null, parameterIds: [] as string[] };
  const validationIssues: Sgb2HousingValidationIssue[] = [];
  const fallbackTrace = [...selection.trace];
  let uncertaintyClass = dataset.uncertaintyClass;

  const graceMonths = cents(numericParameter(context, "sgb2.housing.grace-period-months"), "Karenzzeit");
  const graceCapFactor = numericParameter(context, "sgb2.housing.grace-cap-factor");
  if (graceCapFactor < 1) throw new Error("Karenzzeitdeckel muss mindestens dem einfachen örtlichen Richtwert entsprechen.");
  const transitionMonths = cents(numericParameter(context, "sgb2.housing.cost-reduction-transition-months"), "Kostensenkungszeitraum");
  const graceElapsed = monthsSince(facts.benefitStartMonth, month);
  const transitionElapsed = monthsSince(facts.costReductionStartMonth, month);
  const graceActive = graceElapsed !== null && graceElapsed >= 0 && graceElapsed < graceMonths;
  const transitionActive = transitionElapsed !== null && transitionElapsed >= 0 && transitionElapsed < transitionMonths;
  const hardshipActive = facts.hardshipActive ?? false;

  let recognizedGrossColdRentCents: number;
  let recognizedHeatingCostsCents: number;
  let recognitionStatus: Sgb2HousingRecognitionStatus;

  if (selection.lookupLevel === "model-fallback") {
    const factor = Math.max(0, modelCostIndex(context, dataset)) / 100;
    recognizedGrossColdRentCents = Math.min(actualGrossColdRentCents, cents(actualGrossColdRentCents * factor, "KdU-Modell-Fallback Bruttokaltmiete"));
    recognizedHeatingCostsCents = Math.min(actualHeatingCostsCents, cents(actualHeatingCostsCents * factor, "KdU-Modell-Fallback Heizkosten"));
    recognitionStatus = "model-fallback";
    uncertaintyClass = "hoch";
    fallbackTrace.push(`Modellindex ${Math.round(factor * 100)} wurde auf tatsächliche Unterkunfts- und Heizkosten angewendet.`);
  } else {
    if (grossCold.value === null) throw new Error(`Regionaldatensatz ${dataset.id} enthält für Haushaltsgröße ${householdSize} keinen Bruttokaltmietrichtwert.`);
    if (hardshipActive || transitionActive) {
      recognizedGrossColdRentCents = actualGrossColdRentCents;
    } else if (graceActive) {
      const graceCapCents = cents(grossCold.value * graceCapFactor, "Karenzzeitdeckel Unterkunft");
      recognizedGrossColdRentCents = Math.min(actualGrossColdRentCents, graceCapCents);
      fallbackTrace.push(`Während der Karenzzeit gilt ab Juli 2026 ein Deckel von ${graceCapFactor} × örtlichem Bruttokaltmietrichtwert (${graceCapCents} Cent).`);
    } else {
      recognizedGrossColdRentCents = Math.min(actualGrossColdRentCents, grossCold.value);
    }

    if (hardshipActive || transitionActive) {
      recognizedHeatingCostsCents = actualHeatingCostsCents;
    } else if (heat.value !== null) {
      recognizedHeatingCostsCents = Math.min(actualHeatingCostsCents, heat.value);
    } else {
      recognizedHeatingCostsCents = actualHeatingCostsCents;
      uncertaintyClass = maxUncertainty(uncertaintyClass, "hoch");
      validationIssues.push({
        code: "heating_facts_missing",
        severity: "warning",
        path: "housing.heating",
        message: "Energieträger oder beheizte Gebäudefläche fehlen; Heizkosten werden als expliziter Modell-Fallback in tatsächlicher Höhe anerkannt.",
      });
      fallbackTrace.push("Heizkostengrenze konnte mangels Energieträger oder Gebäudefläche nicht tabellengenau bestimmt werden; tatsächliche Heizkosten werden mit hoher Unsicherheit anerkannt.");
    }

    if (hardshipActive) recognitionStatus = "hardship";
    else if (graceActive) recognitionStatus = "grace-period";
    else if (transitionActive) recognitionStatus = "transition-period";
    else if (recognizedGrossColdRentCents < actualGrossColdRentCents || recognizedHeatingCostsCents < actualHeatingCostsCents) recognitionStatus = "capped";
    else recognitionStatus = "within-limits";
  }

  if (floor.value !== null && floorAreaSquareMeters > floor.value) {
    validationIssues.push({
      code: "floor_area_above_reference",
      severity: "info",
      path: "housing.floorAreaSquareMeters",
      message: `Wohnfläche ${floorAreaSquareMeters} m² liegt über der Referenzfläche ${floor.value} m²; die monetären Grenzen bleiben maßgeblich.`,
    });
  }

  const split = splitGrossCold(recognizedGrossColdRentCents, actualBaseRentCents, actualColdOperatingCostsCents);
  const parameterIds = Array.from(new Set([
    ...floor.parameterIds,
    ...grossCold.parameterIds,
    ...heat.parameterIds,
    "sgb2.housing.grace-period-months",
    "sgb2.housing.grace-cap-factor",
    "sgb2.housing.cost-reduction-transition-months",
    ...(dataset.modelCostIndexParameterId ? [dataset.modelCostIndexParameterId] : []),
  ]));
  const appliedRuleIds = [rule.id, ...(heatingRule ? [heatingRule.id] : [])];

  return {
    schemaVersion: SGB2_HOUSING_RESULT_SCHEMA_VERSION,
    modelVersion: SGB2_HOUSING_MODEL_VERSION,
    runId: unit.runId,
    benefitUnitId: unit.id,
    month,
    regionId,
    providerId,
    householdSize,
    actualBaseRentCents,
    actualColdOperatingCostsCents,
    actualGrossColdRentCents,
    actualHeatingCostsCents,
    adequateFloorAreaSquareMeters: floor.value,
    grossColdRentLimitCents: grossCold.value,
    heatingLimitCents: heat.value,
    recognizedBaseRentCents: split.recognizedBaseRentCents,
    recognizedColdOperatingCostsCents: split.recognizedColdOperatingCostsCents,
    recognizedGrossColdRentCents,
    recognizedHeatingCostsCents,
    recognizedHousingAndHeatingCents: recognizedGrossColdRentCents + recognizedHeatingCostsCents,
    unrecognizedHousingCents: Math.max(0, actualGrossColdRentCents - recognizedGrossColdRentCents),
    unrecognizedHeatingCents: Math.max(0, actualHeatingCostsCents - recognizedHeatingCostsCents),
    recognitionStatus,
    lookupLevel: selection.lookupLevel,
    appliedDatasetId: dataset.id,
    appliedRuleIds,
    parameterIds,
    sourceIds: Array.from(new Set([dataset.sourceId, unit.housing.sourceId])),
    fallbackTrace,
    uncertaintyClass,
    validationIssues,
  };
}

export function calculateSgb2HousingCostsBatch(
  units: Sgb2BenefitUnit[],
  reference: Sgb2ScenarioReference,
  factsByUnit: Record<string, Sgb2HousingRuntimeFacts> = {},
  bundle: Sgb2PolicyBundle = defaultSgb2PolicyBundle,
): Sgb2HousingBatchResult {
  const sorted = [...units].sort((a, b) => a.id.localeCompare(b.id));
  const results = sorted.map((unit) => calculateSgb2HousingCosts(unit, reference, factsByUnit[unit.id] ?? {}, bundle));
  return {
    schemaVersion: SGB2_HOUSING_RESULT_SCHEMA_VERSION,
    modelVersion: SGB2_HOUSING_MODEL_VERSION,
    runId: sorted[0]?.runId ?? reference.populationRunId ?? "unbekannt",
    month: results[0]?.month ?? bundle.policy.validFrom.slice(0, 7),
    results,
  };
}
