import {
  defaultSgb2PolicyBundle,
  resolveSgb2ParameterValues,
  type Sgb2PolicyBundle,
  type Sgb2ScenarioReference,
} from "./sgb2-policy";
import type { Sgb2BenefitUnit, Sgb2PersonProfile } from "./types";
import {
  SGB2_CLAIM_MODEL_VERSION,
  SGB2_CLAIM_SCHEMA_VERSION,
  type Sgb2AmountComponent,
  type Sgb2BenefitUnitClaimResult,
  type Sgb2CalculationStep,
  type Sgb2ClaimBatchResult,
  type Sgb2ClaimRuntimeOptions,
  type Sgb2ClaimStatus,
  type Sgb2ClaimValidationIssue,
  type Sgb2ComponentResult,
  type Sgb2IncomeResult,
  type Sgb2PaymentStatus,
  type Sgb2PersonClaimFacts,
  type Sgb2PersonClaimResult,
  type Sgb2ReductionTrigger,
  type Sgb2RuleEvaluation,
} from "./sgb2-claim-contracts";

export * from "./sgb2-claim-contracts";

interface CalculationContext {
  bundle: Sgb2PolicyBundle;
  reference: Sgb2ScenarioReference;
  values: Map<string, number | string | boolean>;
}

interface PersonWorkingResult {
  profile: Sgb2PersonProfile;
  eligible: boolean;
  standardNeedComponent: Sgb2AmountComponent | null;
  additionalNeedComponents: Sgb2AmountComponent[];
  additionalNeedEvaluations: Sgb2RuleEvaluation[];
  income: Sgb2IncomeResult;
  steps: Sgb2CalculationStep[];
}

const REDUCTION_PARAMETER_BY_TRIGGER: Record<Sgb2ReductionTrigger, string> = {
  "first-breach": "sgb2.reduction.first-breach-rate",
  "repeated-breach": "sgb2.reduction.repeated-breach-rate",
  "further-breach": "sgb2.reduction.further-breach-rate",
  "missed-appointment": "sgb2.reduction.missed-appointment-rate",
};

function cents(value: number, path: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${path} muss eine nichtnegative endliche Zahl sein.`);
  return Math.round(value);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function numericParameter(context: CalculationContext, id: string) {
  const value = context.values.get(id);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Parameter ${id} ist nicht numerisch verfügbar.`);
  return value;
}

function amountParameter(context: CalculationContext, id: string) {
  return cents(numericParameter(context, id), `Parameter ${id}`);
}

function rateParameter(context: CalculationContext, id: string) {
  const value = numericParameter(context, id);
  if (value < 0 || value > 1) throw new Error(`Parameter ${id} muss zwischen 0 und 1 liegen.`);
  return value;
}

function createContext(reference: Sgb2ScenarioReference, bundle: Sgb2PolicyBundle): CalculationContext {
  return { bundle, reference, values: resolveSgb2ParameterValues(reference, bundle) };
}

function claimStatus(netClaimCents: number, grossNeedCents: number): Sgb2ClaimStatus {
  if (netClaimCents <= 0) return "nullanspruch";
  return netClaimCents >= grossNeedCents ? "vollanspruch" : "teilanspruch";
}

function matchesStandardNeedRule(
  profile: Sgb2PersonProfile,
  unit: Sgb2BenefitUnit,
  eligibleProfiles: Sgb2PersonProfile[],
  rule: Sgb2PolicyBundle["standardNeedRules"][number],
) {
  const predicate = rule.eligibilityPredicate;
  const under25InHousehold = profile.age >= 18 && profile.age <= 24 && profile.relationshipRole === "weitere-person";
  const partnerUnit = unit.type === "paar-ohne-kinder" || unit.type === "paar-mit-kindern";
  const eligibleAdults = eligibleProfiles.filter((item) => item.age >= 18).length;
  if (predicate.kind === "child-age-band") return profile.age >= (predicate.ageMin ?? 0) && profile.age <= (predicate.ageMax ?? 17);
  if (predicate.kind === "adult-under-25") return under25InHousehold;
  if (predicate.kind === "adult-partner") return profile.age >= 18 && !under25InHousehold && partnerUnit && eligibleAdults >= 2;
  if (predicate.kind === "adult-single") return profile.age >= 18 && !under25InHousehold && !(partnerUnit && eligibleAdults >= 2);
  return false;
}

function standardNeed(profile: Sgb2PersonProfile, unit: Sgb2BenefitUnit, eligibleProfiles: Sgb2PersonProfile[], context: CalculationContext): Sgb2AmountComponent | null {
  if (profile.eligibilityStatus !== "potenziell-leistungsberechtigt") return null;
  const matches = [...context.bundle.standardNeedRules]
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .filter((rule) => matchesStandardNeedRule(profile, unit, eligibleProfiles, rule));
  if (matches.length !== 1) throw new Error(`Für Person ${profile.personId} muss genau eine Regelbedarfsregel zutreffen; gefunden wurden ${matches.length}.`);
  const rule = matches[0];
  return {
    id: rule.id,
    label: rule.eligibilityPredicate.description,
    amountCents: amountParameter(context, rule.monthlyAmountParameterId),
    parameterIds: [rule.monthlyAmountParameterId],
    note: `Regel ${rule.id} mit Priorität ${rule.priority}.`,
  };
}

function singleParentAdditionalNeed(profile: Sgb2PersonProfile, unit: Sgb2BenefitUnit, profiles: Sgb2PersonProfile[], standardNeedCents: number, context: CalculationContext) {
  if (unit.type !== "alleinerziehend" || profile.age < 18 || profile.eligibilityStatus !== "potenziell-leistungsberechtigt") return null;
  const children = profiles.filter((item) => item.age < 18 && item.eligibilityStatus === "potenziell-leistungsberechtigt");
  if (!children.length) return null;
  const primaryRateId = "sgb2.additional-need.single-parent-primary-rate";
  const perChildRateId = "sgb2.additional-need.single-parent-per-child-rate";
  const capRateId = "sgb2.additional-need.single-parent-cap-rate";
  const primaryApplies = (children.length === 1 && children[0].age < 7)
    || ([2, 3].includes(children.length) && children.every((child) => child.age < 16));
  const primaryRate = primaryApplies ? rateParameter(context, primaryRateId) : 0;
  const perChildRate = rateParameter(context, perChildRateId) * children.length;
  const capRate = rateParameter(context, capRateId);
  const selectedRate = Math.min(capRate, Math.max(primaryRate, perChildRate));
  const amountCents = cents(standardNeedCents * selectedRate, "Mehrbedarf Alleinerziehende");
  return {
    id: `additional-need:single-parent:${profile.personId}`,
    label: "Mehrbedarf Alleinerziehende",
    amountCents,
    parameterIds: [primaryRateId, perChildRateId, capRateId],
    note: primaryApplies
      ? `Günstigerer Wert aus gesetzlicher Hauptfallgruppe und ${children.length} Kinderanteilen, begrenzt auf ${Math.round(capRate * 100)} Prozent.`
      : `${children.length} Kinderanteile, begrenzt auf ${Math.round(capRate * 100)} Prozent.`,
  } satisfies Sgb2AmountComponent;
}

function additionalNeeds(profile: Sgb2PersonProfile, unit: Sgb2BenefitUnit, profiles: Sgb2PersonProfile[], standardNeedCents: number, facts: Sgb2PersonClaimFacts | undefined, context: CalculationContext) {
  const components: Sgb2AmountComponent[] = [];
  const evaluations: Sgb2RuleEvaluation[] = [];
  const eligible = profile.eligibilityStatus === "potenziell-leistungsberechtigt" && standardNeedCents > 0;
  const rules = new Map(context.bundle.additionalNeedRules.map((rule) => [rule.id, rule]));

  const pregnancy = rules.get("additional-need-pregnancy");
  if (pregnancy?.rateParameterId) {
    const applies = eligible && Boolean(facts?.pregnant);
    const amountCents = applies ? cents(standardNeedCents * rateParameter(context, pregnancy.rateParameterId), "Mehrbedarf Schwangerschaft") : 0;
    evaluations.push({ ruleId: pregnancy.id, status: applies ? "applied" : "not-applicable", amountCents, parameterIds: [pregnancy.rateParameterId], reason: applies ? "Schwangerschaftsfakt ist für den Referenzmonat gesetzt." : "Kein Schwangerschaftsfakt für den Referenzmonat." });
    if (applies) components.push({ id: pregnancy.id, label: pregnancy.eligibilityPredicate.description, amountCents, parameterIds: [pregnancy.rateParameterId] });
  }

  const primary = rules.get("additional-need-single-parent-primary");
  const perChild = rules.get("additional-need-single-parent-per-child");
  const singleParent = singleParentAdditionalNeed(profile, unit, profiles, standardNeedCents, context);
  const selectedSingleParentRule = singleParent?.note?.startsWith("Günstigerer") ? primary?.id : perChild?.id;
  for (const rule of [primary, perChild]) {
    if (!rule) continue;
    const applicable = eligible && unit.type === "alleinerziehend" && profile.age >= 18 && profiles.some((item) => item.age < 18 && item.eligibilityStatus === "potenziell-leistungsberechtigt");
    const selected = applicable && singleParent != null && rule.id === selectedSingleParentRule;
    evaluations.push({
      ruleId: rule.id,
      status: selected ? "applied" : applicable ? "not-selected" : "not-applicable",
      amountCents: selected ? singleParent.amountCents : 0,
      parameterIds: [rule.rateParameterId, ...(rule.capParameterId ? [rule.capParameterId] : [])].filter((id): id is string => Boolean(id)),
      reason: selected ? "Diese Alleinerziehendenregel ergibt den höheren begrenzten Betrag." : applicable ? "Die alternative Alleinerziehendenregel ergibt keinen höheren Betrag." : "Person oder Bedarfsgemeinschaft erfüllt die Alleinerziehendenvoraussetzung nicht.",
    });
  }
  if (singleParent) components.push(singleParent);

  const disability = rules.get("additional-need-disability-participation");
  if (disability?.rateParameterId) {
    const applies = eligible && Boolean(facts?.disabilityParticipation);
    const amountCents = applies ? cents(standardNeedCents * rateParameter(context, disability.rateParameterId), "Mehrbedarf Teilhabeleistung") : 0;
    evaluations.push({ ruleId: disability.id, status: applies ? "applied" : "not-applicable", amountCents, parameterIds: [disability.rateParameterId], reason: applies ? "Tatsache einer berücksichtigten Teilhabeleistung ist gesetzt." : "Keine berücksichtigte Teilhabeleistung gesetzt." });
    if (applies) components.push({ id: disability.id, label: disability.eligibilityPredicate.description, amountCents, parameterIds: [disability.rateParameterId] });
  }
  return { components, evaluations };
}

function factAmount(value: number | undefined, path: string) {
  return value == null ? 0 : cents(value, path);
}

function incomeResult(profile: Sgb2PersonProfile, facts: Sgb2PersonClaimFacts | undefined, hasMinorChild: boolean, context: CalculationContext): Sgb2IncomeResult {
  const override = facts?.incomeOverride;
  const employmentGrossCents = cents(override?.employmentGrossCents ?? profile.income.employmentGrossCents, `${profile.personId}.employmentGrossCents`);
  const otherIncomeCents = cents(override?.otherIncomeCents ?? profile.income.otherIncomeCents, `${profile.personId}.otherIncomeCents`);
  const pensionIncomeCents = cents(override?.pensionIncomeCents ?? profile.income.pensionIncomeCents, `${profile.personId}.pensionIncomeCents`);
  const priorityBenefitCents = cents(override?.priorityBenefitCents ?? profile.income.transferIncomeCents, `${profile.personId}.priorityBenefitCents`);
  const grossIncomeCents = employmentGrossCents + otherIncomeCents + pensionIncomeCents + priorityBenefitCents;
  const actualDeductionCents = sum([
    factAmount(facts?.taxesCents, `${profile.personId}.taxesCents`),
    factAmount(facts?.socialContributionsCents, `${profile.personId}.socialContributionsCents`),
    factAmount(facts?.necessaryInsuranceCents, `${profile.personId}.necessaryInsuranceCents`),
    factAmount(facts?.workExpensesCents, `${profile.personId}.workExpensesCents`),
  ]);
  const baseParameterId = "sgb2.income.base-deduction";
  const baseDeductionCents = employmentGrossCents > 0 ? Math.min(employmentGrossCents, amountParameter(context, baseParameterId)) : 0;
  const baseOrActualDeductionCents = Math.min(employmentGrossCents + otherIncomeCents, Math.max(baseDeductionCents, actualDeductionCents));

  let remainingEmploymentForAllowance = Math.max(0, employmentGrossCents - Math.min(employmentGrossCents, baseOrActualDeductionCents));
  const segmentDefinitions = context.bundle.earnedIncomeAllowanceSegments.map((segment) => {
    const lower = amountParameter(context, segment.lowerExclusiveParameterId);
    const upperParameterId = hasMinorChild && segment.childRelatedUpperInclusiveParameterId
      ? segment.childRelatedUpperInclusiveParameterId
      : segment.upperInclusiveParameterId;
    const upper = upperParameterId ? amountParameter(context, upperParameterId) : employmentGrossCents;
    const rate = rateParameter(context, segment.rateParameterId);
    const segmentBaseCents = Math.max(0, Math.min(employmentGrossCents, upper) - lower);
    const calculatedCents = cents(segmentBaseCents * rate, segment.id);
    const amountCents = Math.min(remainingEmploymentForAllowance, calculatedCents);
    remainingEmploymentForAllowance -= amountCents;
    return {
      id: segment.id,
      label: `Erwerbstätigenfreibetrag ${Math.round(rate * 100)} Prozent`,
      amountCents,
      parameterIds: [segment.lowerExclusiveParameterId, ...(upperParameterId ? [upperParameterId] : []), segment.rateParameterId],
      note: `${segmentBaseCents} Cent liegen im zugehörigen Einkommenssegment.`,
    } satisfies Sgb2AmountComponent;
  });
  const earnedIncomeAllowanceCents = sum(segmentDefinitions.map((item) => item.amountCents));
  const privilegedIncomeCents = Math.min(grossIncomeCents, factAmount(facts?.privilegedIncomeCents, `${profile.personId}.privilegedIncomeCents`));
  const totalDeductionsCents = Math.min(grossIncomeCents, baseOrActualDeductionCents + earnedIncomeAllowanceCents + privilegedIncomeCents);
  return {
    employmentGrossCents,
    otherIncomeCents,
    pensionIncomeCents,
    priorityBenefitCents,
    grossIncomeCents,
    actualDeductionCents,
    baseOrActualDeductionCents,
    earnedIncomeAllowanceCents,
    privilegedIncomeCents,
    totalDeductionsCents,
    countableIncomeCents: Math.max(0, grossIncomeCents - totalDeductionsCents),
    allowanceComponents: [
      {
        id: `income:base-or-actual:${profile.personId}`,
        label: actualDeductionCents > baseDeductionCents ? "Tatsächliche Absetzbeträge" : "Grundabsetzbetrag Erwerbseinkommen",
        amountCents: baseOrActualDeductionCents,
        parameterIds: actualDeductionCents > baseDeductionCents ? [] : [baseParameterId],
      },
      ...segmentDefinitions,
      ...(privilegedIncomeCents > 0 ? [{ id: `income:privileged:${profile.personId}`, label: "Privilegiertes Einkommen", amountCents: privilegedIncomeCents, parameterIds: [], note: "Vom anrechenbaren Einkommen ausgenommener Eingabebetrag." }] : []),
    ],
  };
}

function allocateProportionally(totalCents: number, items: Array<{ id: string; weightCents: number }>) {
  const positive = items.filter((item) => item.weightCents > 0).sort((a, b) => a.id.localeCompare(b.id));
  const limit = Math.min(cents(totalCents, "Verteilungsbetrag"), sum(positive.map((item) => item.weightCents)));
  const result = new Map(items.map((item) => [item.id, 0]));
  const totalWeight = sum(positive.map((item) => item.weightCents));
  if (!limit || !totalWeight) return result;
  const allocations = positive.map((item) => {
    const raw = limit * item.weightCents / totalWeight;
    const floor = Math.floor(raw);
    return { ...item, amount: floor, remainder: raw - floor };
  });
  let remaining = limit - sum(allocations.map((item) => item.amount));
  allocations.sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (let index = 0; index < allocations.length && remaining > 0; index += 1, remaining -= 1) allocations[index].amount += 1;
  allocations.forEach((item) => result.set(item.id, item.amount));
  return result;
}

function referenceMonth(options: Sgb2ClaimRuntimeOptions, context: CalculationContext) {
  const value = options.referenceMonth ?? context.bundle.policy.validFrom.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Referenzmonat muss das Format YYYY-MM haben.");
  const validFrom = context.bundle.policy.validFrom.slice(0, 7);
  const validTo = context.bundle.policy.validTo?.slice(0, 7) ?? null;
  if (value < validFrom || (validTo && value > validTo)) throw new Error(`Policy ${context.bundle.policy.id} ist im Referenzmonat ${value} nicht gültig.`);
  return value;
}

function modeledReceiptWindowActive(unit: Sgb2BenefitUnit, month: number) {
  if (unit.receiptStatus !== "bezug" || unit.entryMonth == null || unit.exitMonth == null) return false;
  return month >= unit.entryMonth && month <= unit.exitMonth;
}

function reductionAmount(profile: Sgb2PersonProfile, standardNeedCents: number, claimBeforeReductionCents: number, options: Sgb2ClaimRuntimeOptions, context: CalculationContext) {
  if (!options.reductionsEnabled) return { amountCents: 0, parameterId: null as string | null };
  const trigger = options.reductionTriggers?.[profile.personId];
  if (!trigger) return { amountCents: 0, parameterId: null as string | null };
  const parameterId = REDUCTION_PARAMETER_BY_TRIGGER[trigger];
  const amountCents = Math.min(claimBeforeReductionCents, cents(standardNeedCents * rateParameter(context, parameterId), `Leistungsminderung ${profile.personId}`));
  return { amountCents, parameterId };
}

export function calculateSgb2BenefitUnitClaim(
  unit: Sgb2BenefitUnit,
  profiles: Sgb2PersonProfile[],
  reference: Sgb2ScenarioReference,
  options: Sgb2ClaimRuntimeOptions = {},
  bundle: Sgb2PolicyBundle = defaultSgb2PolicyBundle,
): Sgb2BenefitUnitClaimResult {
  const context = createContext(reference, bundle);
  const month = referenceMonth(options, context);
  const calendarMonth = Number(month.slice(5, 7));
  if (reference.populationRunId && reference.populationRunId !== unit.runId) throw new Error(`Szenario referenziert Lauf ${reference.populationRunId}, Bedarfsgemeinschaft gehört zu ${unit.runId}.`);
  const sortedProfiles = [...profiles].sort((a, b) => a.personId.localeCompare(b.personId));
  const profileIds = new Set(sortedProfiles.map((profile) => profile.personId));
  if (profileIds.size !== sortedProfiles.length) throw new Error(`Bedarfsgemeinschaft ${unit.id} enthält doppelte Personenprofile.`);
  const missing = unit.memberIds.filter((personId) => !profileIds.has(personId));
  const extra = sortedProfiles.filter((profile) => profile.benefitUnitId !== unit.id || !unit.memberIds.includes(profile.personId));
  if (missing.length || extra.length) throw new Error(`Personenprofile der Bedarfsgemeinschaft ${unit.id} sind unvollständig oder inkonsistent.`);

  const eligibleProfiles = sortedProfiles.filter((profile) => profile.eligibilityStatus === "potenziell-leistungsberechtigt");
  const hasMinorChild = eligibleProfiles.some((profile) => profile.age < 18);
  const working: PersonWorkingResult[] = sortedProfiles.map((profile) => {
    const facts = options.personFacts?.[profile.personId];
    const standardNeedComponent = standardNeed(profile, unit, eligibleProfiles, context);
    const standardNeedCents = standardNeedComponent?.amountCents ?? 0;
    const additionalNeed = additionalNeeds(profile, unit, sortedProfiles, standardNeedCents, facts, context);
    const additionalNeedComponents = additionalNeed.components;
    const income = incomeResult(profile, facts, hasMinorChild, context);
    return {
      profile,
      eligible: profile.eligibilityStatus === "potenziell-leistungsberechtigt",
      standardNeedComponent,
      additionalNeedComponents,
      additionalNeedEvaluations: additionalNeed.evaluations,
      income,
      steps: [
        {
          id: `step:need:${profile.personId}`,
          label: "Persönlichen Bedarf bestimmen",
          formula: "Regelbedarf + ausgewählte Mehrbedarfe",
          inputCents: [standardNeedCents, ...additionalNeedComponents.map((item) => item.amountCents)],
          outputCents: standardNeedCents + sum(additionalNeedComponents.map((item) => item.amountCents)),
          parameterIds: [
            ...(standardNeedComponent?.parameterIds ?? []),
            ...additionalNeedComponents.flatMap((item) => item.parameterIds),
          ],
        },
        {
          id: `step:income:${profile.personId}`,
          label: "Anrechenbares Einkommen bestimmen",
          formula: "Bruttoeinkommen − Absetzbeträge − Erwerbstätigenfreibeträge − privilegiertes Einkommen",
          inputCents: [income.grossIncomeCents, income.totalDeductionsCents],
          outputCents: income.countableIncomeCents,
          parameterIds: income.allowanceComponents.flatMap((item) => item.parameterIds),
        },
      ],
    };
  });

  const gaps = working.map((item) => {
    const standardNeedCents = item.standardNeedComponent?.amountCents ?? 0;
    const additionalNeedCents = sum(item.additionalNeedComponents.map((component) => component.amountCents));
    const grossNeedCents = item.eligible ? standardNeedCents + additionalNeedCents : 0;
    const ownIncomeAppliedCents = Math.min(grossNeedCents, item.eligible ? item.income.countableIncomeCents : 0);
    return {
      id: item.profile.personId,
      grossNeedCents,
      ownIncomeAppliedCents,
      uncoveredCents: grossNeedCents - ownIncomeAppliedCents,
      surplusCents: item.eligible ? Math.max(0, item.income.countableIncomeCents - ownIncomeAppliedCents) : 0,
    };
  });
  const sharedIncomeCents = sum(gaps.map((item) => item.surplusCents));
  const sharedAllocation = allocateProportionally(sharedIncomeCents, gaps.map((item) => ({ id: item.id, weightCents: item.uncoveredCents })));
  const active = modeledReceiptWindowActive(unit, calendarMonth);
  const respectWindow = options.respectModeledReceiptWindow ?? false;

  const persons = working.map<Sgb2PersonClaimResult>((item) => {
    const gap = gaps.find((candidate) => candidate.id === item.profile.personId)!;
    const sharedIncomeAppliedCents = sharedAllocation.get(item.profile.personId) ?? 0;
    const totalCountableIncomeAppliedCents = gap.ownIncomeAppliedCents + sharedIncomeAppliedCents;
    const claimBeforeReductionCents = Math.max(0, gap.grossNeedCents - totalCountableIncomeAppliedCents);
    const reduction = reductionAmount(item.profile, item.standardNeedComponent?.amountCents ?? 0, claimBeforeReductionCents, options, context);
    const potentialNetClaimCents = Math.max(0, claimBeforeReductionCents - reduction.amountCents);
    const netClaimCents = respectWindow && !active ? 0 : potentialNetClaimCents;
    const paymentStatus: Sgb2PaymentStatus = respectWindow && !active ? "ausserhalb-modelliertem-bezugsfenster" : "zahlbar";
    const additionalNeedCents = sum(item.additionalNeedComponents.map((component) => component.amountCents));
    return {
      personId: item.profile.personId,
      benefitUnitId: unit.id,
      eligible: item.eligible,
      standardNeedCents: item.standardNeedComponent?.amountCents ?? 0,
      additionalNeedCents,
      grossNeedCents: gap.grossNeedCents,
      standardNeedComponent: item.standardNeedComponent,
      additionalNeedComponents: item.additionalNeedComponents,
      additionalNeedEvaluations: item.additionalNeedEvaluations,
      income: item.income,
      ownIncomeAppliedCents: gap.ownIncomeAppliedCents,
      sharedIncomeAppliedCents,
      totalCountableIncomeAppliedCents,
      claimBeforeReductionCents,
      reductionCents: reduction.amountCents,
      potentialNetClaimCents,
      netClaimCents,
      claimStatus: claimStatus(potentialNetClaimCents, gap.grossNeedCents),
      paymentStatus,
      steps: [
        ...item.steps,
        {
          id: `step:allocation:${item.profile.personId}`,
          label: "Einkommen auf persönlichen Bedarf anrechnen",
          formula: "Eigene Einkommensanrechnung + anteiliges überschießendes BG-Einkommen",
          inputCents: [gap.ownIncomeAppliedCents, sharedIncomeAppliedCents],
          outputCents: totalCountableIncomeAppliedCents,
          parameterIds: [],
        },
        {
          id: `step:claim:${item.profile.personId}`,
          label: "Nettoanspruch bestimmen",
          formula: "Bruttobedarf − anrechenbares Einkommen − Leistungsminderung",
          inputCents: [gap.grossNeedCents, totalCountableIncomeAppliedCents, reduction.amountCents],
          outputCents: potentialNetClaimCents,
          parameterIds: reduction.parameterId ? [reduction.parameterId] : [],
          note: paymentStatus === "zahlbar" ? undefined : "Der potenzielle Anspruch liegt außerhalb des modellierten Bezugsfensters und wird für diesen Monat nicht ausgezahlt.",
        },
      ],
    };
  });

  const standardNeedCents = sum(persons.map((person) => person.standardNeedCents));
  const additionalNeedCents = sum(persons.map((person) => person.additionalNeedCents));
  const grossNeedCents = sum(persons.map((person) => person.grossNeedCents));
  const grossIncomeCents = sum(persons.filter((person) => person.eligible).map((person) => person.income.grossIncomeCents));
  const priorityBenefitCents = sum(persons.filter((person) => person.eligible).map((person) => person.income.priorityBenefitCents));
  const deductionsAndAllowancesCents = sum(persons.filter((person) => person.eligible).map((person) => person.income.totalDeductionsCents));
  const countableIncomeCents = sum(persons.filter((person) => person.eligible).map((person) => person.income.countableIncomeCents));
  const countableIncomeAppliedCents = sum(persons.map((person) => person.totalCountableIncomeAppliedCents));
  const claimBeforeReductionCents = sum(persons.map((person) => person.claimBeforeReductionCents));
  const reductionCents = sum(persons.map((person) => person.reductionCents));
  const potentialNetClaimCents = sum(persons.map((person) => person.potentialNetClaimCents));
  const netClaimCents = sum(persons.map((person) => person.netClaimCents));
  const paymentStatus: Sgb2PaymentStatus = respectWindow && !active ? "ausserhalb-modelliertem-bezugsfenster" : "zahlbar";
  const componentResults: Sgb2ComponentResult[] = persons.flatMap((person) => [
    ...(person.standardNeedComponent ? [{ id: `${person.personId}:${person.standardNeedComponent.id}`, personId: person.personId, category: "standard-need" as const, amountCents: person.standardNeedCents, appliedAmountCents: person.standardNeedCents, parameterIds: person.standardNeedComponent.parameterIds, note: person.standardNeedComponent.note }] : []),
    ...person.additionalNeedComponents.map((component) => ({ id: `${person.personId}:${component.id}`, personId: person.personId, category: "additional-need" as const, amountCents: component.amountCents, appliedAmountCents: component.amountCents, parameterIds: component.parameterIds, note: component.note })),
    { id: `${person.personId}:countable-income`, personId: person.personId, category: "countable-income" as const, amountCents: person.income.countableIncomeCents, appliedAmountCents: person.totalCountableIncomeAppliedCents, parameterIds: person.income.allowanceComponents.flatMap((component) => component.parameterIds) },
    ...person.income.allowanceComponents.filter((component) => component.amountCents > 0).map((component) => ({ id: `${person.personId}:${component.id}`, personId: person.personId, category: "deduction" as const, amountCents: component.amountCents, appliedAmountCents: component.amountCents, parameterIds: component.parameterIds, note: component.note })),
    ...(person.reductionCents > 0 ? [{ id: `${person.personId}:reduction`, personId: person.personId, category: "reduction" as const, amountCents: person.reductionCents, appliedAmountCents: person.reductionCents, parameterIds: person.steps.flatMap((step) => step.parameterIds).filter((id) => id.startsWith("sgb2.reduction.")) }] : []),
    { id: `${person.personId}:payment`, personId: person.personId, category: "payment" as const, amountCents: person.potentialNetClaimCents, appliedAmountCents: person.netClaimCents, parameterIds: [], note: person.paymentStatus === "zahlbar" ? undefined : "Außerhalb des modellierten Bezugsfensters." },
  ]);
  const validationIssues: Sgb2ClaimValidationIssue[] = [
    { code: "housing_not_included", severity: "info", path: "housing", message: "Unterkunft und Heizung werden erst durch das getrennte KdU-Modul aus #19 ergänzt." },
    { code: "assets_not_evaluated", severity: "warning", path: "assets", message: "Vermögen ist in diesem Arbeitspaket nicht als individueller Ausschlusstatbestand ausgewertet." },
  ];

  return {
    schemaVersion: SGB2_CLAIM_SCHEMA_VERSION,
    modelVersion: SGB2_CLAIM_MODEL_VERSION,
    policyVersionId: reference.policyVersionId,
    policyModelVersion: reference.modelVersion,
    runId: unit.runId,
    benefitUnitId: unit.id,
    month,
    eligibilityStatus: eligibleProfiles.length ? "eligible" : "ineligible",
    modeledReceiptWindowActive: active,
    respectModeledReceiptWindow: respectWindow,
    reductionsEnabled: options.reductionsEnabled ?? false,
    housingIncluded: false,
    housingNeedCents: 0,
    standardNeedCents,
    additionalNeedCents,
    grossNeedCents,
    grossIncomeCents,
    priorityBenefitCents,
    deductionsAndAllowancesCents,
    countableIncomeCents,
    countableIncomeAppliedCents,
    claimBeforeReductionCents,
    reductionCents,
    potentialNetClaimCents,
    netClaimCents,
    claimStatus: claimStatus(potentialNetClaimCents, grossNeedCents),
    paymentStatus,
    persons,
    componentResults,
    steps: [
      {
        id: `step:bg-need:${unit.id}`,
        label: "Bruttobedarf der Bedarfsgemeinschaft",
        formula: "Summe der persönlichen Regel- und Mehrbedarfe; Unterkunft und Heizung folgen separat in #19",
        inputCents: [standardNeedCents, additionalNeedCents],
        outputCents: grossNeedCents,
        parameterIds: persons.flatMap((person) => [
          ...(person.standardNeedComponent?.parameterIds ?? []),
          ...person.additionalNeedComponents.flatMap((component) => component.parameterIds),
        ]),
      },
      {
        id: `step:bg-income:${unit.id}`,
        label: "Anrechenbares Einkommen der Bedarfsgemeinschaft",
        formula: "Summe der tatsächlich auf Bedarfe verteilten persönlichen Einkommen",
        inputCents: persons.map((person) => person.totalCountableIncomeAppliedCents),
        outputCents: countableIncomeAppliedCents,
        parameterIds: persons.flatMap((person) => person.income.allowanceComponents.flatMap((component) => component.parameterIds)),
      },
      {
        id: `step:bg-claim:${unit.id}`,
        label: "Monatlicher Nettoanspruch",
        formula: "Bruttobedarf − anrechenbares Einkommen − Leistungsminderungen",
        inputCents: [grossNeedCents, countableIncomeAppliedCents, reductionCents],
        outputCents: potentialNetClaimCents,
        parameterIds: persons.flatMap((person) => person.steps.flatMap((step) => step.parameterIds)),
        note: "Unterkunft und Heizung sind absichtlich mit 0 Cent ausgewiesen, bis das regionale KdU-Modul aus #19 zugeliefert wird.",
      },
    ],
    validationIssues,
    sourceIds: Array.from(new Set(bundle.policy.sourceIds)),
    uncertaintyClass: "mittel",
    limitations: [
      "Unterkunft und Heizung sind nicht enthalten und werden im separaten KdU-Modul ergänzt.",
      "Schwangerschaft, Teilhabeleistungen, tatsächliche Absetzbeträge, privilegiertes Einkommen und Minderungen werden nur bei expliziten Laufzeitfakten angewendet.",
      "Einkommensüberschüsse werden deterministisch proportional auf verbleibende persönliche Bedarfe verteilt.",
    ],
  };
}

export function calculateSgb2Claims(
  units: Sgb2BenefitUnit[],
  profiles: Sgb2PersonProfile[],
  reference: Sgb2ScenarioReference,
  options: Sgb2ClaimRuntimeOptions = {},
  bundle: Sgb2PolicyBundle = defaultSgb2PolicyBundle,
): Sgb2ClaimBatchResult {
  const profilesByUnit = new Map<string, Sgb2PersonProfile[]>();
  profiles.forEach((profile) => {
    const group = profilesByUnit.get(profile.benefitUnitId) ?? [];
    group.push(profile);
    profilesByUnit.set(profile.benefitUnitId, group);
  });
  const sortedUnits = [...units].sort((a, b) => a.id.localeCompare(b.id));
  const results = sortedUnits.map((unit) => calculateSgb2BenefitUnitClaim(unit, profilesByUnit.get(unit.id) ?? [], reference, options, bundle));
  return {
    schemaVersion: SGB2_CLAIM_SCHEMA_VERSION,
    modelVersion: SGB2_CLAIM_MODEL_VERSION,
    runId: sortedUnits[0]?.runId ?? reference.populationRunId ?? "unbekannt",
    policyVersionId: reference.policyVersionId,
    month: options.referenceMonth ?? bundle.policy.validFrom.slice(0, 7),
    results,
  };
}
