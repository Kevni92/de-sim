export type Sgb2ReductionTrigger = "first-breach" | "repeated-breach" | "further-breach" | "missed-appointment";

export interface Sgb2PersonClaimFacts {
  pregnant?: boolean;
  disabilityParticipation?: boolean;
  taxesCents?: number;
  socialContributionsCents?: number;
  necessaryInsuranceCents?: number;
  workExpensesCents?: number;
  privilegedIncomeCents?: number;
  incomeOverride?: Partial<{
    employmentGrossCents: number;
    otherIncomeCents: number;
    pensionIncomeCents: number;
    priorityBenefitCents: number;
  }>;
}

export interface Sgb2ClaimRuntimeOptions {
  referenceMonth?: string;
  reductionsEnabled?: boolean;
  respectModeledReceiptWindow?: boolean;
  personFacts?: Record<string, Sgb2PersonClaimFacts>;
  reductionTriggers?: Record<string, Sgb2ReductionTrigger>;
}

export const SGB2_CLAIM_SCHEMA_VERSION = 1;
export const SGB2_CLAIM_MODEL_VERSION = "sgb2-claim-0.1.0";

export type Sgb2ClaimStatus = "vollanspruch" | "teilanspruch" | "nullanspruch";
export type Sgb2PaymentStatus = "zahlbar" | "ausserhalb-modelliertem-bezugsfenster";
export type Sgb2EntitlementEligibilityStatus = "eligible" | "ineligible";

export interface Sgb2RuleEvaluation {
  ruleId: string;
  status: "applied" | "not-applicable" | "not-selected";
  amountCents: number;
  parameterIds: string[];
  reason: string;
}

export interface Sgb2ClaimValidationIssue {
  code: string;
  severity: "warning" | "info";
  path: string;
  message: string;
}

export interface Sgb2ComponentResult {
  id: string;
  personId?: string;
  category: "standard-need" | "additional-need" | "countable-income" | "deduction" | "reduction" | "payment";
  amountCents: number;
  appliedAmountCents: number;
  parameterIds: string[];
  note?: string;
}

export interface Sgb2AmountComponent {
  id: string;
  label: string;
  amountCents: number;
  parameterIds: string[];
  note?: string;
}

export interface Sgb2CalculationStep {
  id: string;
  label: string;
  formula: string;
  inputCents: number[];
  outputCents: number;
  parameterIds: string[];
  note?: string;
}

export interface Sgb2IncomeResult {
  employmentGrossCents: number;
  otherIncomeCents: number;
  pensionIncomeCents: number;
  priorityBenefitCents: number;
  grossIncomeCents: number;
  actualDeductionCents: number;
  baseOrActualDeductionCents: number;
  earnedIncomeAllowanceCents: number;
  privilegedIncomeCents: number;
  totalDeductionsCents: number;
  countableIncomeCents: number;
  allowanceComponents: Sgb2AmountComponent[];
}

export interface Sgb2PersonClaimResult {
  personId: string;
  benefitUnitId: string;
  eligible: boolean;
  standardNeedCents: number;
  additionalNeedCents: number;
  grossNeedCents: number;
  standardNeedComponent: Sgb2AmountComponent | null;
  additionalNeedComponents: Sgb2AmountComponent[];
  additionalNeedEvaluations: Sgb2RuleEvaluation[];
  income: Sgb2IncomeResult;
  ownIncomeAppliedCents: number;
  sharedIncomeAppliedCents: number;
  totalCountableIncomeAppliedCents: number;
  claimBeforeReductionCents: number;
  reductionCents: number;
  potentialNetClaimCents: number;
  netClaimCents: number;
  claimStatus: Sgb2ClaimStatus;
  paymentStatus: Sgb2PaymentStatus;
  steps: Sgb2CalculationStep[];
}

export interface Sgb2BenefitUnitClaimResult {
  schemaVersion: number;
  modelVersion: string;
  policyVersionId: string;
  policyModelVersion: string;
  runId: string;
  benefitUnitId: string;
  month: string;
  eligibilityStatus: Sgb2EntitlementEligibilityStatus;
  modeledReceiptWindowActive: boolean;
  respectModeledReceiptWindow: boolean;
  reductionsEnabled: boolean;
  housingIncluded: false;
  housingNeedCents: 0;
  standardNeedCents: number;
  additionalNeedCents: number;
  grossNeedCents: number;
  grossIncomeCents: number;
  priorityBenefitCents: number;
  deductionsAndAllowancesCents: number;
  countableIncomeCents: number;
  countableIncomeAppliedCents: number;
  claimBeforeReductionCents: number;
  reductionCents: number;
  potentialNetClaimCents: number;
  netClaimCents: number;
  claimStatus: Sgb2ClaimStatus;
  paymentStatus: Sgb2PaymentStatus;
  persons: Sgb2PersonClaimResult[];
  componentResults: Sgb2ComponentResult[];
  steps: Sgb2CalculationStep[];
  validationIssues: Sgb2ClaimValidationIssue[];
  sourceIds: string[];
  uncertaintyClass: "mittel";
  limitations: string[];
}

export interface Sgb2ClaimBatchResult {
  schemaVersion: number;
  modelVersion: string;
  runId: string;
  policyVersionId: string;
  month: string;
  results: Sgb2BenefitUnitClaimResult[];
}
