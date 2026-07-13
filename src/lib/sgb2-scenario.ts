import type { Sgb2FinancingOverride, Sgb2HousingDatasetOverride, Sgb2HousingOverrideField, Sgb2ParameterOverride, Sgb2ScenarioReference, Sgb2ValidationIssue } from "./sgb2-contracts";
import { SGB2_FALLBACK_HOUSING_DATASET_ID, SGB2_MODEL_VERSION, SGB2_POLICY_2026_ID } from "./sgb2-contracts";
import { defaultSgb2PolicyBundle } from "./sgb2-baseline";
import { finiteNumber, isObject, validateParameterValue } from "./sgb2-validation";

function normalizeParameterOverrides(value: unknown): Sgb2ParameterOverride[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.parameterId !== "string") return [];
    const scalar = item.value;
    if (typeof scalar !== "number" && typeof scalar !== "string" && typeof scalar !== "boolean") return [];
    if (typeof scalar === "number" && !Number.isFinite(scalar)) return [];
    return [{ parameterId: item.parameterId, value: scalar }];
  });
}

function normalizeHousingOverrides(value: unknown): Sgb2HousingDatasetOverride[] {
  const allowedFields: Sgb2HousingOverrideField[] = ["adequateFloorArea", "grossColdRentLimit", "baseRentLimit", "coldOperatingCostLimit", "maxRentPerSquareMeter", "heatingLimit", "modelCostIndex"];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.datasetId !== "string" || typeof item.field !== "string" || !allowedFields.includes(item.field as Sgb2HousingOverrideField) || !finiteNumber(item.value)) return [];
    return [{ datasetId: item.datasetId, ruleId: typeof item.ruleId === "string" ? item.ruleId : undefined, field: item.field as Sgb2HousingOverrideField, value: item.value }];
  });
}

function normalizeFinancingOverrides(value: unknown): Sgb2FinancingOverride[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.component !== "string" || typeof item.payer !== "string" || !finiteNumber(item.share)) return [];
    return [{ component: item.component, payer: item.payer, share: item.share }];
  });
}

function mergeParameterOverrides(first: Sgb2ParameterOverride[], second: Sgb2ParameterOverride[]) {
  const map = new Map<string, Sgb2ParameterOverride>();
  first.forEach((item) => map.set(item.parameterId, item));
  second.forEach((item) => map.set(item.parameterId, item));
  return [...map.values()].sort((a, b) => a.parameterId.localeCompare(b.parameterId));
}

function mergeHousingOverrides(first: Sgb2HousingDatasetOverride[], second: Sgb2HousingDatasetOverride[]) {
  const map = new Map<string, Sgb2HousingDatasetOverride>();
  const key = (item: Sgb2HousingDatasetOverride) => `${item.datasetId}:${item.ruleId ?? "*"}:${item.field}`;
  first.forEach((item) => map.set(key(item), item));
  second.forEach((item) => map.set(key(item), item));
  return [...map.values()].sort((a, b) => key(a).localeCompare(key(b)));
}

export function migrateLegacySgb2ScenarioReference(expenseChanges: Record<string, number> | null | undefined): Pick<Sgb2ScenarioReference, "parameterOverrides" | "housingDatasetOverrides" | "migrationNotes"> {
  const changes = expenseChanges ?? {};
  const parameterOverrides: Sgb2ParameterOverride[] = [];
  const housingDatasetOverrides: Sgb2HousingDatasetOverride[] = [];
  const migrationNotes: string[] = [];
  const byId = new Map(defaultSgb2PolicyBundle.parameters.map((item) => [item.id, item]));

  const benefitIndex = changes["expense.param.social.benefitIndex"];
  if (finiteNumber(benefitIndex)) {
    defaultSgb2PolicyBundle.standardNeedRules.forEach((rule) => {
      const baseline = byId.get(rule.monthlyAmountParameterId)?.value;
      if (typeof baseline === "number") parameterOverrides.push({ parameterId: rule.monthlyAmountParameterId, value: Math.round(baseline * benefitIndex / 100) });
    });
    migrationNotes.push(`Alter Regelbedarfsindex ${benefitIndex} wurde in konkrete Cent-Beträge übersetzt.`);
  }

  const recipientIndex = changes["expense.param.social.recipientIndex"];
  if (finiteNumber(recipientIndex)) {
    parameterOverrides.push({ parameterId: "sgb2.legacy.recipient-index", value: recipientIndex });
    migrationNotes.push("Alter Bedarfsgemeinschaftsindex wurde als explizite, migrationsbedingte Populationsannahme erhalten.");
  }

  const housingIndex = changes["expense.param.social.housingIndex"];
  if (finiteNumber(housingIndex)) {
    housingDatasetOverrides.push({ datasetId: SGB2_FALLBACK_HOUSING_DATASET_ID, field: "modelCostIndex", value: housingIndex });
    migrationNotes.push("Alter Unterkunftsindex wurde als expliziter Override des KdU-Modell-Fallbacks erhalten.");
  }

  const caseManagementIndex = changes["expense.param.social.caseManagementIndex"];
  if (finiteNumber(caseManagementIndex)) {
    parameterOverrides.push({ parameterId: "sgb2.legacy.case-management-index", value: caseManagementIndex });
    migrationNotes.push("Alter Verwaltungs- und Eingliederungsindex wurde migrationssicher gespeichert, bleibt aber außerhalb des Anspruchsrechners.");
  }

  return { parameterOverrides, housingDatasetOverrides, migrationNotes };
}

export function normalizeSgb2ScenarioReference(value: unknown, expenseChanges?: Record<string, number>, populationRunId?: string | null): Sgb2ScenarioReference {
  const object = isObject(value) ? value : {};
  const migrated = migrateLegacySgb2ScenarioReference(expenseChanges);
  const explicitParameters = normalizeParameterOverrides(object.parameterOverrides);
  const explicitHousing = normalizeHousingOverrides(object.housingDatasetOverrides);
  const migrationNotes = [
    ...(Array.isArray(object.migrationNotes) ? object.migrationNotes.filter((item): item is string => typeof item === "string") : []),
    ...migrated.migrationNotes,
  ];
  const explicitPopulationRunId = typeof object.populationRunId === "string" && object.populationRunId.trim() ? object.populationRunId : null;
  return {
    policyVersionId: typeof object.policyVersionId === "string" && object.policyVersionId.trim() ? object.policyVersionId : SGB2_POLICY_2026_ID,
    parameterOverrides: mergeParameterOverrides(explicitParameters, migrated.parameterOverrides),
    housingDatasetOverrides: mergeHousingOverrides(explicitHousing, migrated.housingDatasetOverrides),
    financingOverrides: normalizeFinancingOverrides(object.financingOverrides),
    populationRunId: explicitPopulationRunId ?? (typeof populationRunId === "string" && populationRunId.trim() ? populationRunId : null),
    modelVersion: typeof object.modelVersion === "string" && object.modelVersion.trim() ? object.modelVersion : SGB2_MODEL_VERSION,
    migrationNotes: [...new Set(migrationNotes)],
  };
}

export function cloneSgb2ScenarioReference(reference: Sgb2ScenarioReference): Sgb2ScenarioReference {
  return {
    ...reference,
    parameterOverrides: reference.parameterOverrides.map((item) => ({ ...item })),
    housingDatasetOverrides: reference.housingDatasetOverrides.map((item) => ({ ...item })),
    financingOverrides: reference.financingOverrides.map((item) => ({ ...item })),
    migrationNotes: [...reference.migrationNotes],
  };
}

export function validateSgb2ScenarioReference(reference: Sgb2ScenarioReference, bundle = defaultSgb2PolicyBundle): Sgb2ValidationIssue[] {
  const issues: Sgb2ValidationIssue[] = [];
  if (reference.policyVersionId !== bundle.policy.id) issues.push({ code: "scenario_policy_unsupported", severity: "error", path: "sgb2.policyVersionId", message: `Policy-Version ${reference.policyVersionId} ist nicht verfügbar.` });
  if (reference.modelVersion !== SGB2_MODEL_VERSION) issues.push({ code: "scenario_model_unsupported", severity: "error", path: "sgb2.modelVersion", message: `Rechenmodell ${reference.modelVersion} wird nicht unterstützt.` });

  const parameterMap = new Map(bundle.parameters.map((item) => [item.id, item]));
  const seenParameters = new Set<string>();
  reference.parameterOverrides.forEach((override, index) => {
    const path = `sgb2.parameterOverrides[${index}]`;
    if (seenParameters.has(override.parameterId)) issues.push({ code: "scenario_parameter_duplicate", severity: "error", path, message: `Override für ${override.parameterId} ist doppelt vorhanden.` });
    seenParameters.add(override.parameterId);
    const parameter = parameterMap.get(override.parameterId);
    if (!parameter) issues.push({ code: "scenario_parameter_unknown", severity: "error", path, message: `Parameter ${override.parameterId} ist unbekannt.` });
    else issues.push(...validateParameterValue(parameter, override.value, `${path}.value`));
  });

  const datasetMap = new Map(bundle.housingDatasets.map((item) => [item.id, item]));
  const seenHousing = new Set<string>();
  reference.housingDatasetOverrides.forEach((override, index) => {
    const path = `sgb2.housingDatasetOverrides[${index}]`;
    const key = `${override.datasetId}:${override.ruleId ?? "*"}:${override.field}`;
    if (seenHousing.has(key)) issues.push({ code: "scenario_housing_override_duplicate", severity: "error", path, message: `KdU-Override ${key} ist doppelt vorhanden.` });
    seenHousing.add(key);
    const dataset = datasetMap.get(override.datasetId);
    if (!dataset) issues.push({ code: "scenario_housing_dataset_unknown", severity: "error", path, message: `KdU-Datensatz ${override.datasetId} ist unbekannt.` });
    else if (override.ruleId) {
      const knownRule = dataset.rules.some((rule) => rule.id === override.ruleId)
        || (dataset.heatingRules ?? []).some((rule) => rule.id === override.ruleId);
      if (!knownRule) issues.push({ code: "scenario_housing_rule_unknown", severity: "error", path, message: `KdU-Regel ${override.ruleId} ist unbekannt.` });
    }
    if (!Number.isFinite(override.value) || override.value < 0) issues.push({ code: "scenario_housing_value_invalid", severity: "error", path, message: "KdU-Override muss eine nichtnegative endliche Zahl sein." });
  });

  reference.financingOverrides.forEach((override, index) => {
    if (!Number.isFinite(override.share) || override.share < 0 || override.share > 1) issues.push({ code: "scenario_financing_share_invalid", severity: "error", path: `sgb2.financingOverrides[${index}].share`, message: "Finanzierungsanteil muss zwischen 0 und 1 liegen." });
  });

  return issues;
}

export function resolveSgb2ParameterValues(reference: Sgb2ScenarioReference, bundle = defaultSgb2PolicyBundle) {
  const errors = validateSgb2ScenarioReference(reference, bundle).filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(`${errors[0].code}: ${errors[0].message}`);
  const values = new Map(bundle.parameters.map((parameter) => [parameter.id, parameter.value]));
  reference.parameterOverrides.forEach((override) => values.set(override.parameterId, override.value));
  return values;
}
