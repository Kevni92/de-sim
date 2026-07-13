import type { HousingAllowanceRule, Sgb2Parameter, Sgb2PolicyBundle, Sgb2Scalar, Sgb2ValidationIssue } from "./sgb2-contracts";
import { SGB2_HOUSING_SCHEMA_VERSION, SGB2_MODEL_VERSION, SGB2_POLICY_SCHEMA_VERSION } from "./sgb2-contracts";

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseIsoDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function periodsOverlap(firstFrom: string, firstTo: string | null, secondFrom: string, secondTo: string | null) {
  const firstStart = parseIsoDate(firstFrom);
  const secondStart = parseIsoDate(secondFrom);
  if (firstStart === null || secondStart === null) return false;
  const firstEnd = firstTo ? parseIsoDate(firstTo) : Number.POSITIVE_INFINITY;
  const secondEnd = secondTo ? parseIsoDate(secondTo) : Number.POSITIVE_INFINITY;
  if (firstEnd === null || secondEnd === null) return false;
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

function numericParameterValue(parameterMap: Map<string, Sgb2Parameter>, id: string) {
  const value = parameterMap.get(id)?.value;
  return finiteNumber(value) ? value : null;
}

export function validateParameterValue(parameter: Sgb2Parameter, value: Sgb2Scalar, path: string): Sgb2ValidationIssue[] {
  const issues: Sgb2ValidationIssue[] = [];
  if (typeof value !== typeof parameter.value) {
    issues.push({ code: "parameter_type_mismatch", severity: "error", path, message: `Wert für ${parameter.id} hat nicht den erwarteten Typ.` });
    return issues;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) issues.push({ code: "parameter_not_finite", severity: "error", path, message: `Wert für ${parameter.id} ist nicht endlich.` });
    const constraints = parameter.constraints;
    if (constraints?.min !== undefined && value < constraints.min) issues.push({ code: "parameter_below_min", severity: "error", path, message: `Wert für ${parameter.id} liegt unter ${constraints.min}.` });
    if (constraints?.max !== undefined && value > constraints.max) issues.push({ code: "parameter_above_max", severity: "error", path, message: `Wert für ${parameter.id} liegt über ${constraints.max}.` });
    if (constraints?.integer && !Number.isInteger(value)) issues.push({ code: "parameter_not_integer", severity: "error", path, message: `Wert für ${parameter.id} muss ganzzahlig sein.` });
  }
  if (typeof value === "string" && parameter.constraints?.allowedValues && !parameter.constraints.allowedValues.includes(value)) {
    issues.push({ code: "parameter_value_not_allowed", severity: "error", path, message: `Wert für ${parameter.id} ist nicht zulässig.` });
  }
  return issues;
}

function ruleRangesOverlap(first: HousingAllowanceRule, second: HousingAllowanceRule) {
  const firstMax = first.householdSizeMax ?? Number.POSITIVE_INFINITY;
  const secondMax = second.householdSizeMax ?? Number.POSITIVE_INFINITY;
  return first.householdSizeMin <= secondMax && second.householdSizeMin <= firstMax;
}

export function validateSgb2PolicyBundle(bundle: Sgb2PolicyBundle): Sgb2ValidationIssue[] {
  const issues: Sgb2ValidationIssue[] = [];
  const parameterMap = new Map<string, Sgb2Parameter>();

  if (bundle.policy.schemaVersion !== SGB2_POLICY_SCHEMA_VERSION) issues.push({ code: "policy_schema_unsupported", severity: "error", path: "policy.schemaVersion", message: `SGB-II-Policy-Schema ${bundle.policy.schemaVersion} wird nicht unterstützt.` });
  if (bundle.policy.modelVersion !== SGB2_MODEL_VERSION) issues.push({ code: "policy_model_unsupported", severity: "error", path: "policy.modelVersion", message: `SGB-II-Modellversion ${bundle.policy.modelVersion} wird nicht unterstützt.` });
  if (!parseIsoDate(bundle.policy.legalStatusDate) || !parseIsoDate(bundle.policy.validFrom)) issues.push({ code: "policy_date_invalid", severity: "error", path: "policy", message: "Rechtsstand und Gültigkeitsbeginn müssen ISO-Daten sein." });
  if (bundle.policy.validTo && (!parseIsoDate(bundle.policy.validTo) || bundle.policy.validTo < bundle.policy.validFrom)) issues.push({ code: "policy_period_invalid", severity: "error", path: "policy.validTo", message: "Der Gültigkeitszeitraum der Policy ist ungültig." });

  bundle.parameters.forEach((parameter, index) => {
    const path = `parameters[${index}]`;
    if (parameterMap.has(parameter.id)) issues.push({ code: "parameter_duplicate", severity: "error", path: `${path}.id`, message: `Parameter-ID ${parameter.id} ist doppelt vorhanden.` });
    parameterMap.set(parameter.id, parameter);
    if (!parameter.sourceId) issues.push({ code: "parameter_source_missing", severity: "error", path: `${path}.sourceId`, message: `Quelle für ${parameter.id} fehlt.` });
    if (!bundle.policy.sourceIds.includes(parameter.sourceId)) issues.push({ code: "parameter_source_unknown", severity: "error", path: `${path}.sourceId`, message: `Quelle ${parameter.sourceId} ist in der Policy nicht registriert.` });
    if (!parseIsoDate(parameter.validFrom) || !parseIsoDate(parameter.legalStatusDate)) issues.push({ code: "parameter_date_invalid", severity: "error", path, message: `Gültigkeit oder Rechtsstand von ${parameter.id} ist ungültig.` });
    if (parameter.validTo && (!parseIsoDate(parameter.validTo) || parameter.validTo < parameter.validFrom)) issues.push({ code: "parameter_period_invalid", severity: "error", path: `${path}.validTo`, message: `Gültigkeitszeitraum von ${parameter.id} ist ungültig.` });
    issues.push(...validateParameterValue(parameter, parameter.value, `${path}.value`));
  });

  const listedIds = new Set(bundle.policy.parameterIds);
  parameterMap.forEach((_parameter, id) => {
    if (!listedIds.has(id)) issues.push({ code: "parameter_not_listed", severity: "error", path: "policy.parameterIds", message: `Parameter ${id} fehlt in policy.parameterIds.` });
  });
  bundle.policy.parameterIds.forEach((id) => {
    if (!parameterMap.has(id)) issues.push({ code: "parameter_reference_missing", severity: "error", path: "policy.parameterIds", message: `Referenzierter Parameter ${id} fehlt.` });
  });

  const requireParameter = (id: string | undefined, path: string) => {
    if (!id || !parameterMap.has(id)) issues.push({ code: "rule_parameter_missing", severity: "error", path, message: `Referenzierter Parameter ${id ?? "(leer)"} fehlt.` });
  };

  bundle.standardNeedRules.forEach((rule, index) => {
    requireParameter(rule.monthlyAmountParameterId, `standardNeedRules[${index}].monthlyAmountParameterId`);
    if (!bundle.policy.sourceIds.includes(rule.sourceId)) issues.push({ code: "rule_source_unknown", severity: "error", path: `standardNeedRules[${index}].sourceId`, message: `Quelle ${rule.sourceId} ist nicht registriert.` });
  });

  bundle.additionalNeedRules.forEach((rule, index) => {
    const path = `additionalNeedRules[${index}]`;
    if (rule.basis === "standard-need") {
      requireParameter(rule.rateParameterId, `${path}.rateParameterId`);
      if (rule.fixedAmountParameterId) issues.push({ code: "additional_need_ambiguous", severity: "error", path, message: `${rule.id} enthält gleichzeitig Rate und Festbetrag.` });
    } else {
      requireParameter(rule.fixedAmountParameterId, `${path}.fixedAmountParameterId`);
      if (rule.rateParameterId) issues.push({ code: "additional_need_ambiguous", severity: "error", path, message: `${rule.id} enthält gleichzeitig Festbetrag und Rate.` });
    }
    if (rule.capParameterId) requireParameter(rule.capParameterId, `${path}.capParameterId`);
  });

  const incomeTypeIds = new Set(bundle.incomeTypes.map((item) => item.id));
  bundle.incomeDeductionRules.forEach((rule, index) => {
    rule.appliesToIncomeTypes.forEach((id) => {
      if (!incomeTypeIds.has(id)) issues.push({ code: "income_type_missing", severity: "error", path: `incomeDeductionRules[${index}].appliesToIncomeTypes`, message: `Einkommensart ${id} fehlt.` });
    });
    if (rule.parameterId) requireParameter(rule.parameterId, `incomeDeductionRules[${index}].parameterId`);
    if (rule.lowerBoundParameterId) requireParameter(rule.lowerBoundParameterId, `incomeDeductionRules[${index}].lowerBoundParameterId`);
    if (rule.upperBoundParameterId) requireParameter(rule.upperBoundParameterId, `incomeDeductionRules[${index}].upperBoundParameterId`);
  });

  const segments = bundle.earnedIncomeAllowanceSegments.map((segment, index) => {
    requireParameter(segment.lowerExclusiveParameterId, `earnedIncomeAllowanceSegments[${index}].lowerExclusiveParameterId`);
    requireParameter(segment.upperInclusiveParameterId, `earnedIncomeAllowanceSegments[${index}].upperInclusiveParameterId`);
    requireParameter(segment.rateParameterId, `earnedIncomeAllowanceSegments[${index}].rateParameterId`);
    if (segment.childRelatedUpperInclusiveParameterId) requireParameter(segment.childRelatedUpperInclusiveParameterId, `earnedIncomeAllowanceSegments[${index}].childRelatedUpperInclusiveParameterId`);
    return {
      index,
      lower: numericParameterValue(parameterMap, segment.lowerExclusiveParameterId),
      upper: segment.upperInclusiveParameterId ? numericParameterValue(parameterMap, segment.upperInclusiveParameterId) : Number.POSITIVE_INFINITY,
      rate: numericParameterValue(parameterMap, segment.rateParameterId),
    };
  }).filter((segment) => segment.lower !== null && segment.upper !== null);
  segments.sort((a, b) => (a.lower ?? 0) - (b.lower ?? 0));
  segments.forEach((segment, index) => {
    if (segment.upper! <= segment.lower!) issues.push({ code: "income_segment_invalid", severity: "error", path: `earnedIncomeAllowanceSegments[${segment.index}]`, message: "Obergrenze muss über der Untergrenze liegen." });
    if (segment.rate === null || segment.rate < 0 || segment.rate > 1) issues.push({ code: "income_segment_rate_invalid", severity: "error", path: `earnedIncomeAllowanceSegments[${segment.index}].rateParameterId`, message: "Freibetragsrate muss zwischen 0 und 1 liegen." });
    const previous = segments[index - 1];
    if (previous && previous.upper! > segment.lower!) issues.push({ code: "income_segment_overlap", severity: "error", path: `earnedIncomeAllowanceSegments[${segment.index}]`, message: "Freibetragssegmente überschneiden sich." });
    if (previous && previous.upper! < segment.lower!) issues.push({ code: "income_segment_gap", severity: "warning", path: `earnedIncomeAllowanceSegments[${segment.index}]`, message: "Zwischen Freibetragssegmenten besteht eine Lücke." });
  });

  bundle.reductionRules.forEach((rule, index) => {
    requireParameter(rule.rateParameterId, `reductionRules[${index}].rateParameterId`);
    if (rule.durationMonthsParameterId) requireParameter(rule.durationMonthsParameterId, `reductionRules[${index}].durationMonthsParameterId`);
  });
  bundle.priorityBenefits.forEach((benefit, index) => {
    if (!incomeTypeIds.has(benefit.incomeTypeId)) issues.push({ code: "priority_benefit_income_type_missing", severity: "error", path: `priorityBenefits[${index}].incomeTypeId`, message: `Einkommensart ${benefit.incomeTypeId} fehlt.` });
  });

  const datasetIds = new Set<string>();
  bundle.housingDatasets.forEach((dataset, datasetIndex) => {
    const path = `housingDatasets[${datasetIndex}]`;
    if (datasetIds.has(dataset.id)) issues.push({ code: "housing_dataset_duplicate", severity: "error", path: `${path}.id`, message: `KdU-Datensatz ${dataset.id} ist doppelt vorhanden.` });
    datasetIds.add(dataset.id);
    if (dataset.schemaVersion !== SGB2_HOUSING_SCHEMA_VERSION) issues.push({ code: "housing_schema_unsupported", severity: "error", path: `${path}.schemaVersion`, message: `KdU-Schema ${dataset.schemaVersion} wird nicht unterstützt.` });
    if (!bundle.policy.sourceIds.includes(dataset.sourceId)) issues.push({ code: "housing_source_unknown", severity: "error", path: `${path}.sourceId`, message: `Quelle ${dataset.sourceId} ist nicht registriert.` });
    if (!parseIsoDate(dataset.validFrom) || (dataset.validTo && (!parseIsoDate(dataset.validTo) || dataset.validTo < dataset.validFrom))) issues.push({ code: "housing_period_invalid", severity: "error", path, message: `Gültigkeitszeitraum von ${dataset.id} ist ungültig.` });
    if (dataset.modelCostIndexParameterId) requireParameter(dataset.modelCostIndexParameterId, `${path}.modelCostIndexParameterId`);

    dataset.rules.forEach((rule, ruleIndex) => {
      const rulePath = `${path}.rules[${ruleIndex}]`;
      if (!Number.isInteger(rule.householdSizeMin) || rule.householdSizeMin < 1) issues.push({ code: "housing_household_size_invalid", severity: "error", path: `${rulePath}.householdSizeMin`, message: "Haushaltsgröße muss eine positive ganze Zahl sein." });
      if (rule.householdSizeMax !== undefined && (!Number.isInteger(rule.householdSizeMax) || rule.householdSizeMax < rule.householdSizeMin)) issues.push({ code: "housing_household_range_invalid", severity: "error", path: rulePath, message: "Haushaltsgrößenbereich ist ungültig." });
      [rule.adequateFloorAreaParameterId, rule.grossColdRentLimitParameterId, rule.baseRentLimitParameterId, rule.coldOperatingCostLimitParameterId, rule.maxRentPerSquareMeterParameterId, rule.heatingLimitParameterId].forEach((id) => {
        if (id) requireParameter(id, rulePath);
      });
      dataset.rules.slice(0, ruleIndex).forEach((previous) => {
        if (ruleRangesOverlap(previous, rule)) issues.push({ code: "housing_rule_overlap", severity: "error", path: rulePath, message: `KdU-Regeln ${previous.id} und ${rule.id} überschneiden sich.` });
      });
    });

    const hasMonetaryLimit = dataset.rules.some((rule) => rule.grossColdRentLimitParameterId || rule.baseRentLimitParameterId || rule.maxRentPerSquareMeterParameterId || rule.heatingLimitParameterId);
    if (!hasMonetaryLimit) issues.push({ code: "housing_limits_placeholder", severity: dataset.status === "active" ? "error" : "warning", path, message: `KdU-Datensatz ${dataset.id} enthält noch keine monetären Miet- oder Heizkostengrenzen.` });
  });

  bundle.housingDatasets.forEach((dataset, index) => {
    bundle.housingDatasets.slice(0, index).forEach((previous) => {
      if (previous.regionId === dataset.regionId && (previous.providerId ?? "") === (dataset.providerId ?? "") && periodsOverlap(previous.validFrom, previous.validTo, dataset.validFrom, dataset.validTo)) {
        issues.push({ code: "housing_dataset_period_overlap", severity: "error", path: `housingDatasets[${index}]`, message: `KdU-Datensätze ${previous.id} und ${dataset.id} überschneiden sich zeitlich.` });
      }
    });
  });

  return issues;
}
