import type { Sgb2ScenarioReference } from "./sgb2-policy";
import {
  getSgb2Parameter,
  resolvedSgb2UiValue,
  setSgb2UiGroupPercent,
  setSgb2UiParameter,
  sgb2UiGroupPercent,
  sgb2UiGroups,
  sgb2UiInputValue,
  type Sgb2UiPreviewResult,
} from "./sgb2-ui";

export type Sgb2SimpleControlId = "standard-needs" | "income-free-amount" | "housing-recognition" | "additional-needs";
export type Sgb2SimpleControlState = { value: number; mixed: boolean };

const housingRecognitionIds = sgb2UiGroups
  .find((group) => group.id === "housing")!
  .parameterIds
  .filter((id) => id.includes("gross-cold-rent.") || id.includes("heating.natural-gas.501-1000.") || id === "sgb2.housing.fallback.cost-index");

function percentState(reference: Sgb2ScenarioReference, ids: string[]) {
  const ratios = ids.map((id) => {
    const baseline = getSgb2Parameter(id).value as number;
    return baseline === 0 ? 100 : (resolvedSgb2UiValue(reference, id) as number) / baseline * 100;
  });
  const percent = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 100;
  return {
    percent,
    mixed: ratios.some((value) => Math.abs(value - percent) > 0.05),
  };
}

function setPercent(reference: Sgb2ScenarioReference, ids: string[], percent: number) {
  return ids.reduce((next, id) => {
    const baseline = getSgb2Parameter(id).value as number;
    return setSgb2UiParameter(next, id, baseline * percent / 100);
  }, reference);
}

export function simpleControlState(reference: Sgb2ScenarioReference, id: Sgb2SimpleControlId): Sgb2SimpleControlState {
  if (id === "standard-needs" || id === "additional-needs") {
    const state = sgb2UiGroupPercent(reference, id);
    return { value: state.percent - 100, mixed: state.mixed };
  }
  if (id === "housing-recognition") {
    const state = percentState(reference, housingRecognitionIds);
    const otherHousingChanged = sgb2UiGroups.find((group) => group.id === "housing")!.parameterIds
      .filter((parameterId) => !housingRecognitionIds.includes(parameterId))
      .some((parameterId) => Math.abs((resolvedSgb2UiValue(reference, parameterId) as number) - (getSgb2Parameter(parameterId).value as number)) > 1e-9);
    return { value: state.percent - 100, mixed: state.mixed || otherHousingChanged };
  }
  const parameterId = "sgb2.income.base-deduction";
  const parameter = getSgb2Parameter(parameterId);
  const otherIncomeChanged = sgb2UiGroups.find((group) => group.id === "income-allowances")!.parameterIds
    .filter((candidate) => candidate !== parameterId)
    .some((candidate) => Math.abs((resolvedSgb2UiValue(reference, candidate) as number) - (getSgb2Parameter(candidate).value as number)) > 1e-9);
  return {
    value: sgb2UiInputValue(parameter, resolvedSgb2UiValue(reference, parameterId) as number),
    mixed: otherIncomeChanged,
  };
}

export function setSimpleControl(reference: Sgb2ScenarioReference, id: Sgb2SimpleControlId, value: number) {
  if (id === "standard-needs" || id === "additional-needs") return setSgb2UiGroupPercent(reference, id, 100 + value);
  if (id === "housing-recognition") return setPercent(reference, housingRecognitionIds, 100 + value);
  return setSgb2UiParameter(reference, "sgb2.income.base-deduction", Math.round(value * 100));
}

export function typicalMonthlyDeltaCents(preview: Sgb2UiPreviewResult) {
  return preview.weightedPaymentMonths > 0 ? Math.round(preview.deltaPaymentCents / preview.weightedPaymentMonths) : 0;
}

export function simpleExampleValue(reference: Sgb2ScenarioReference, parameterId: string) {
  return resolvedSgb2UiValue(reference, parameterId) as number;
}
