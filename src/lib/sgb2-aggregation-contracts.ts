import type { Sgb2BenefitUnitType, Sgb2IncomeBand } from "./types";

export const SGB2_AGGREGATION_SCHEMA_VERSION = 1;
export const SGB2_AGGREGATION_MODEL_VERSION = "sgb2-aggregation-0.1.0";

export type Sgb2AggregateComponent = "standard-need" | "additional-need" | "accommodation" | "heating";
export type Sgb2FinancingView = "cash-payer" | "net-financing";
export type Sgb2DrilldownDimension = "benefit-unit-type" | "region" | "income-band" | "component";
export type Sgb2ComparisonScope =
  | { kind: "total-payment" }
  | { kind: "component"; component: Sgb2AggregateComponent }
  | { kind: "payer"; view: Sgb2FinancingView; payer: string };

export interface Sgb2MoneyAggregate {
  exactCents: number;
  roundedCents: number;
}

export interface Sgb2MonthlyComponentSettlement {
  component: Sgb2AggregateComponent;
  grossNeedCents: number;
  incomeCoveredCents: number;
  reductionCents: number;
  potentialPaymentCents: number;
  paymentCents: number;
}

export interface Sgb2MonthlySettlement {
  runId: string;
  benefitUnitId: string;
  month: string;
  benefitUnitType: Sgb2BenefitUnitType;
  incomeBand: Sgb2IncomeBand;
  regionId: string;
  weight: number;
  grossNeedCents: number;
  countableIncomeCents: number;
  incomeCoveredCents: number;
  reductionCents: number;
  potentialPaymentCents: number;
  paymentCents: number;
  paymentActive: boolean;
  components: Sgb2MonthlyComponentSettlement[];
  sourceIds: string[];
  limitations: string[];
}

export interface Sgb2AnnualComponentAggregate {
  component: Sgb2AggregateComponent;
  grossNeed: Sgb2MoneyAggregate;
  incomeCovered: Sgb2MoneyAggregate;
  reduction: Sgb2MoneyAggregate;
  potentialPayment: Sgb2MoneyAggregate;
  payment: Sgb2MoneyAggregate;
}

export interface Sgb2FinancingRule {
  view: Sgb2FinancingView;
  component: Sgb2AggregateComponent;
  payer: string;
  share: number;
  sourceId: string;
  uncertaintyClass: "niedrig" | "mittel" | "hoch";
  note: string;
}

export interface Sgb2PayerAggregate {
  view: Sgb2FinancingView;
  payer: string;
  payment: Sgb2MoneyAggregate;
  componentPayments: Array<{
    component: Sgb2AggregateComponent;
    share: number;
    payment: Sgb2MoneyAggregate;
  }>;
  sourceIds: string[];
  uncertaintyClass: "niedrig" | "mittel" | "hoch";
  notes: string[];
}

export interface Sgb2DrilldownAggregate {
  dimension: Sgb2DrilldownDimension;
  key: string;
  label: string;
  weightedBenefitUnitMonths: number;
  grossNeed: Sgb2MoneyAggregate;
  payment: Sgb2MoneyAggregate;
}

export interface Sgb2ReferenceValue {
  id: string;
  label: string;
  period: string;
  scope: Sgb2ComparisonScope;
  valueCents: number;
  sourceId: string;
  comparability: "hoch" | "mittel" | "niedrig";
  boundaryDifferences: string[];
}

export interface Sgb2ReferenceComparison {
  referenceId: string;
  label: string;
  period: string;
  scope: Sgb2ComparisonScope;
  referenceValueCents: number;
  modelValueCents: number;
  absoluteDeviationCents: number;
  relativeDeviation: number | null;
  comparability: "hoch" | "mittel" | "niedrig";
  boundaryDifferences: string[];
  sourceId: string;
}

export interface Sgb2AggregationValidationIssue {
  code: string;
  severity: "warning" | "info";
  path: string;
  message: string;
}

export interface Sgb2AnnualAggregationOptions {
  referenceValues?: Sgb2ReferenceValue[];
  financingRules?: Sgb2FinancingRule[];
}

export interface Sgb2AnnualAggregationResult {
  schemaVersion: number;
  modelVersion: string;
  runId: string;
  policyVersionId: string;
  periodFrom: string;
  periodTo: string;
  calendarYear: number | null;
  completeCalendarYear: boolean;
  simulatedBenefitUnitMonths: number;
  weightedBenefitUnitMonths: number;
  weightedPaymentMonths: number;
  grossNeed: Sgb2MoneyAggregate;
  countableIncome: Sgb2MoneyAggregate;
  incomeCovered: Sgb2MoneyAggregate;
  reduction: Sgb2MoneyAggregate;
  potentialPayment: Sgb2MoneyAggregate;
  payment: Sgb2MoneyAggregate;
  components: Sgb2AnnualComponentAggregate[];
  payers: Sgb2PayerAggregate[];
  drilldowns: Sgb2DrilldownAggregate[];
  comparisons: Sgb2ReferenceComparison[];
  calibrationAdjustment: Sgb2MoneyAggregate;
  sourceIds: string[];
  uncertaintyClass: "mittel" | "hoch";
  validationIssues: Sgb2AggregationValidationIssue[];
  limitations: string[];
}
