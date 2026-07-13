import type { Sgb2BenefitUnitClaimResult } from "./sgb2-claim-contracts";
import type { Sgb2HousingCostResult } from "./sgb2-housing-contracts";
import type { Sgb2ScenarioReference } from "./sgb2-policy";
import type { Sgb2BenefitUnit } from "./types";
import {
  SGB2_AGGREGATION_MODEL_VERSION,
  SGB2_AGGREGATION_SCHEMA_VERSION,
  type Sgb2AggregateComponent,
  type Sgb2AggregationValidationIssue,
  type Sgb2AnnualAggregationOptions,
  type Sgb2AnnualAggregationResult,
  type Sgb2AnnualComponentAggregate,
  type Sgb2DrilldownAggregate,
  type Sgb2DrilldownDimension,
  type Sgb2FinancingRule,
  type Sgb2FinancingView,
  type Sgb2MoneyAggregate,
  type Sgb2MonthlyComponentSettlement,
  type Sgb2MonthlySettlement,
  type Sgb2PayerAggregate,
  type Sgb2ReferenceComparison,
  type Sgb2ReferenceValue,
} from "./sgb2-aggregation-contracts";

export * from "./sgb2-aggregation-contracts";

const COMPONENTS: Sgb2AggregateComponent[] = ["standard-need", "additional-need", "accommodation", "heating"];
const COMPONENT_LABELS: Record<Sgb2AggregateComponent, string> = {
  "standard-need": "Regelbedarf",
  "additional-need": "Mehrbedarfe",
  accommodation: "Unterkunft",
  heating: "Heizung",
};

export const defaultSgb2FinancingRules: Sgb2FinancingRule[] = [
  { view: "cash-payer", component: "standard-need", payer: "bund", share: 1, sourceId: "source-sgb2-law", uncertaintyClass: "niedrig", note: "Bundesleistung in der Zahlstellenperspektive." },
  { view: "cash-payer", component: "additional-need", payer: "bund", share: 1, sourceId: "source-sgb2-law", uncertaintyClass: "niedrig", note: "Bundesleistung in der Zahlstellenperspektive." },
  { view: "cash-payer", component: "accommodation", payer: "kommunaler-traeger", share: 1, sourceId: "source-sgb2-law", uncertaintyClass: "niedrig", note: "Kommunale Zahlstellenperspektive vor Bundeserstattung." },
  { view: "cash-payer", component: "heating", payer: "kommunaler-traeger", share: 1, sourceId: "source-sgb2-law", uncertaintyClass: "niedrig", note: "Kommunale Zahlstellenperspektive vor Bundeserstattung." },
  { view: "net-financing", component: "standard-need", payer: "bund", share: 1, sourceId: "source-sgb2-law", uncertaintyClass: "niedrig", note: "Bundesfinanzierung der Geldleistung." },
  { view: "net-financing", component: "additional-need", payer: "bund", share: 1, sourceId: "source-sgb2-law", uncertaintyClass: "niedrig", note: "Bundesfinanzierung der Geldleistung." },
  { view: "net-financing", component: "accommodation", payer: "bund", share: 0.7, sourceId: "source-sgb2-law", uncertaintyClass: "mittel", note: "Bundesweite Modellquote; landesspezifische Beteiligungsquoten sind als Szenario-Overrides einzuspielen." },
  { view: "net-financing", component: "accommodation", payer: "kommunaler-traeger", share: 0.3, sourceId: "source-sgb2-law", uncertaintyClass: "mittel", note: "Residual der bundesweiten Modellquote; landesspezifische Beteiligungsquoten sind als Szenario-Overrides einzuspielen." },
  { view: "net-financing", component: "heating", payer: "bund", share: 0.7, sourceId: "source-sgb2-law", uncertaintyClass: "mittel", note: "Bundesweite Modellquote; landesspezifische Beteiligungsquoten sind als Szenario-Overrides einzuspielen." },
  { view: "net-financing", component: "heating", payer: "kommunaler-traeger", share: 0.3, sourceId: "source-sgb2-law", uncertaintyClass: "mittel", note: "Residual der bundesweiten Modellquote; landesspezifische Beteiligungsquoten sind als Szenario-Overrides einzuspielen." },
];

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function assertNonnegativeInteger(value: number, path: string) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) throw new Error(`${path} muss ein nichtnegativer ganzzahliger Cent-Betrag sein.`);
  return value;
}

function assertWeight(value: number, path: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${path} muss ein positiver endlicher Wert sein.`);
  return value;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function money(exactCents: number, roundedCents = Math.round(exactCents)): Sgb2MoneyAggregate {
  return { exactCents, roundedCents };
}

function allocateCents(totalCents: number, weights: Array<{ id: string; amountCents: number }>) {
  const target = Math.min(assertNonnegativeInteger(totalCents, "Verteilungsbetrag"), sum(weights.map((item) => assertNonnegativeInteger(item.amountCents, `${item.id}.amountCents`))));
  const result = new Map(weights.map((item) => [item.id, 0]));
  const positive = weights.filter((item) => item.amountCents > 0).sort((a, b) => a.id.localeCompare(b.id));
  const totalWeight = sum(positive.map((item) => item.amountCents));
  if (!target || !totalWeight) return result;
  const raw = positive.map((item) => {
    const share = target * item.amountCents / totalWeight;
    const floor = Math.floor(share);
    return { ...item, allocated: floor, remainder: share - floor };
  });
  let remainder = target - sum(raw.map((item) => item.allocated));
  raw.sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) raw[index % raw.length].allocated += 1;
  raw.forEach((item) => result.set(item.id, item.allocated));
  return result;
}

function roundExactEntries(entries: Array<{ key: string; exactCents: number }>) {
  const result = new Map(entries.map((entry) => [entry.key, Math.floor(entry.exactCents)]));
  const target = Math.round(sum(entries.map((entry) => entry.exactCents)));
  let remainder = target - sum([...result.values()]);
  const ordered = entries
    .map((entry) => ({ ...entry, fraction: entry.exactCents - Math.floor(entry.exactCents) }))
    .sort((a, b) => b.fraction - a.fraction || a.key.localeCompare(b.key));
  for (let index = 0; remainder > 0 && ordered.length; index += 1, remainder -= 1) {
    const key = ordered[index % ordered.length].key;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function monthlyKey(runId: string, benefitUnitId: string, month: string) {
  return `${runId}:${benefitUnitId}:${month}`;
}

function buildMonthlySettlement(
  unit: Sgb2BenefitUnit,
  claim: Sgb2BenefitUnitClaimResult,
  housing: Sgb2HousingCostResult,
): Sgb2MonthlySettlement {
  if (claim.runId !== unit.runId || housing.runId !== unit.runId) throw new Error(`Lauf-ID für Bedarfsgemeinschaft ${unit.id} ist inkonsistent.`);
  if (claim.benefitUnitId !== unit.id || housing.benefitUnitId !== unit.id) throw new Error(`Bedarfsgemeinschafts-ID ${unit.id} ist zwischen Anspruch und KdU inkonsistent.`);
  if (claim.month !== housing.month) throw new Error(`Anspruchsmonat ${claim.month} und KdU-Monat ${housing.month} stimmen nicht überein.`);

  const grossComponents = [
    { id: "standard-need", amountCents: assertNonnegativeInteger(claim.standardNeedCents, "claim.standardNeedCents") },
    { id: "additional-need", amountCents: assertNonnegativeInteger(claim.additionalNeedCents, "claim.additionalNeedCents") },
    { id: "accommodation", amountCents: assertNonnegativeInteger(housing.recognizedGrossColdRentCents, "housing.recognizedGrossColdRentCents") },
    { id: "heating", amountCents: assertNonnegativeInteger(housing.recognizedHeatingCostsCents, "housing.recognizedHeatingCostsCents") },
  ] satisfies Array<{ id: Sgb2AggregateComponent; amountCents: number }>;
  const grossNeedCents = sum(grossComponents.map((item) => item.amountCents));
  const countableIncomeCents = assertNonnegativeInteger(claim.countableIncomeCents, "claim.countableIncomeCents");
  const incomeCoveredCents = Math.min(grossNeedCents, countableIncomeCents);
  const incomeAllocation = allocateCents(incomeCoveredCents, grossComponents);
  const afterIncome = grossComponents.map((item) => ({ id: item.id, amountCents: item.amountCents - (incomeAllocation.get(item.id) ?? 0) }));
  const reductionCents = Math.min(assertNonnegativeInteger(claim.reductionCents, "claim.reductionCents"), sum(afterIncome.map((item) => item.amountCents)));
  const reductionAllocation = allocateCents(reductionCents, afterIncome);
  const paymentActive = claim.paymentStatus === "zahlbar";
  const components: Sgb2MonthlyComponentSettlement[] = grossComponents.map((item) => {
    const incomeCovered = incomeAllocation.get(item.id) ?? 0;
    const reduction = reductionAllocation.get(item.id) ?? 0;
    const potentialPaymentCents = item.amountCents - incomeCovered - reduction;
    return {
      component: item.id,
      grossNeedCents: item.amountCents,
      incomeCoveredCents: incomeCovered,
      reductionCents: reduction,
      potentialPaymentCents,
      paymentCents: paymentActive ? potentialPaymentCents : 0,
    };
  });
  const potentialPaymentCents = sum(components.map((item) => item.potentialPaymentCents));
  const paymentCents = sum(components.map((item) => item.paymentCents));
  if (potentialPaymentCents !== Math.max(0, grossNeedCents - incomeCoveredCents - reductionCents)) throw new Error(`Monatliche Komponentenzerlegung für ${unit.id}/${claim.month} ist inkonsistent.`);

  return {
    runId: unit.runId,
    benefitUnitId: unit.id,
    month: claim.month,
    benefitUnitType: unit.type,
    incomeBand: unit.incomeBand,
    regionId: housing.regionId,
    weight: assertWeight(unit.weight, `${unit.id}.weight`),
    grossNeedCents,
    countableIncomeCents,
    incomeCoveredCents,
    reductionCents,
    potentialPaymentCents,
    paymentCents,
    paymentActive,
    components,
    sourceIds: unique([...claim.sourceIds, ...housing.sourceIds]),
    limitations: unique([
      ...claim.limitations,
      ...(housing.lookupLevel === "model-fallback" ? ["Regionale KdU-Werte fehlen; der ausgewiesene Wohnkostenbetrag nutzt einen Modell-Fallback."] : []),
    ]),
  };
}

export function buildSgb2MonthlySettlements(
  units: Sgb2BenefitUnit[],
  claims: Sgb2BenefitUnitClaimResult[],
  housingResults: Sgb2HousingCostResult[],
) {
  const unitMap = new Map<string, Sgb2BenefitUnit>();
  units.forEach((unit) => {
    const key = `${unit.runId}:${unit.id}`;
    if (unitMap.has(key)) throw new Error(`Bedarfsgemeinschaft ${key} ist doppelt vorhanden.`);
    unitMap.set(key, unit);
  });
  const housingMap = new Map<string, Sgb2HousingCostResult>();
  housingResults.forEach((housing) => {
    const key = monthlyKey(housing.runId, housing.benefitUnitId, housing.month);
    if (housingMap.has(key)) throw new Error(`KdU-Ergebnis ${key} ist doppelt vorhanden.`);
    housingMap.set(key, housing);
  });
  const seenClaims = new Set<string>();
  const settlements = claims.map((claim) => {
    const key = monthlyKey(claim.runId, claim.benefitUnitId, claim.month);
    if (seenClaims.has(key)) throw new Error(`Anspruchsergebnis ${key} ist doppelt vorhanden.`);
    seenClaims.add(key);
    const unit = unitMap.get(`${claim.runId}:${claim.benefitUnitId}`);
    if (!unit) throw new Error(`Bedarfsgemeinschaft für Anspruchsergebnis ${key} fehlt.`);
    const housing = housingMap.get(key);
    if (!housing) throw new Error(`KdU-Ergebnis für Anspruchsergebnis ${key} fehlt.`);
    housingMap.delete(key);
    return buildMonthlySettlement(unit, claim, housing);
  });
  if (housingMap.size) throw new Error(`Es liegen ${housingMap.size} KdU-Ergebnisse ohne zugehöriges Anspruchsergebnis vor.`);
  if (!settlements.length) throw new Error("Mindestens ein monatliches Anspruchs- und KdU-Ergebnis ist erforderlich.");
  return settlements.sort((a, b) => a.month.localeCompare(b.month) || a.benefitUnitId.localeCompare(b.benefitUnitId));
}

function applyScenarioFinancingOverrides(baseRules: Sgb2FinancingRule[], reference: Sgb2ScenarioReference) {
  const rules = baseRules.map((rule) => ({ ...rule }));
  const overridesByComponent = new Map<Sgb2AggregateComponent, typeof reference.financingOverrides>();
  reference.financingOverrides.forEach((override) => {
    if (!COMPONENTS.includes(override.component as Sgb2AggregateComponent)) throw new Error(`Finanzierungs-Override verwendet unbekannte Komponente ${override.component}.`);
    if (!override.payer.trim()) throw new Error("Finanzierungs-Override benötigt einen Kostenträger.");
    if (!Number.isFinite(override.share) || override.share < 0 || override.share > 1) throw new Error(`Finanzierungsanteil für ${override.component}/${override.payer} ist ungültig.`);
    const component = override.component as Sgb2AggregateComponent;
    const group = overridesByComponent.get(component) ?? [];
    group.push(override);
    overridesByComponent.set(component, group);
  });
  overridesByComponent.forEach((overrides, component) => {
    for (let index = rules.length - 1; index >= 0; index -= 1) {
      if (rules[index].view === "net-financing" && rules[index].component === component) rules.splice(index, 1);
    }
    overrides.forEach((override) => rules.push({
      view: "net-financing",
      component,
      payer: override.payer,
      share: override.share,
      sourceId: "source-sgb2-law",
      uncertaintyClass: "mittel",
      note: "Expliziter Szenario-Override der Nettofinanzierung.",
    }));
  });
  return rules;
}

function validateFinancingRules(rules: Sgb2FinancingRule[]) {
  const keys = new Set<string>();
  rules.forEach((rule) => {
    const key = `${rule.view}:${rule.component}:${rule.payer}`;
    if (keys.has(key)) throw new Error(`Finanzierungsregel ${key} ist doppelt vorhanden.`);
    keys.add(key);
    if (!Number.isFinite(rule.share) || rule.share < 0 || rule.share > 1) throw new Error(`Finanzierungsregel ${key} hat einen ungültigen Anteil.`);
  });
  (["cash-payer", "net-financing"] as Sgb2FinancingView[]).forEach((view) => {
    COMPONENTS.forEach((component) => {
      const relevant = rules.filter((rule) => rule.view === view && rule.component === component);
      const total = sum(relevant.map((rule) => rule.share));
      if (!relevant.length || Math.abs(total - 1) > 1e-9) throw new Error(`Finanzierungsanteile für ${view}/${component} müssen exakt 1 ergeben; gefunden ${total}.`);
    });
  });
}

function aggregateComponents(settlements: Sgb2MonthlySettlement[]) {
  const exact = COMPONENTS.map((component) => {
    const rows = settlements.flatMap((settlement) => settlement.components.filter((item) => item.component === component).map((item) => ({ item, weight: settlement.weight })));
    return {
      component,
      grossNeed: sum(rows.map(({ item, weight }) => item.grossNeedCents * weight)),
      incomeCovered: sum(rows.map(({ item, weight }) => item.incomeCoveredCents * weight)),
      reduction: sum(rows.map(({ item, weight }) => item.reductionCents * weight)),
      potentialPayment: sum(rows.map(({ item, weight }) => item.potentialPaymentCents * weight)),
      payment: sum(rows.map(({ item, weight }) => item.paymentCents * weight)),
    };
  });
  const roundedByField = new Map<string, Map<string, number>>();
  (["grossNeed", "incomeCovered", "reduction", "potentialPayment", "payment"] as const).forEach((field) => {
    roundedByField.set(field, roundExactEntries(exact.map((entry) => ({ key: entry.component, exactCents: entry[field] }))));
  });
  return exact.map<Sgb2AnnualComponentAggregate>((entry) => ({
    component: entry.component,
    grossNeed: money(entry.grossNeed, roundedByField.get("grossNeed")!.get(entry.component) ?? 0),
    incomeCovered: money(entry.incomeCovered, roundedByField.get("incomeCovered")!.get(entry.component) ?? 0),
    reduction: money(entry.reduction, roundedByField.get("reduction")!.get(entry.component) ?? 0),
    potentialPayment: money(entry.potentialPayment, roundedByField.get("potentialPayment")!.get(entry.component) ?? 0),
    payment: money(entry.payment, roundedByField.get("payment")!.get(entry.component) ?? 0),
  }));
}

function aggregatePayers(components: Sgb2AnnualComponentAggregate[], rules: Sgb2FinancingRule[]) {
  type Atomic = { key: string; view: Sgb2FinancingView; payer: string; component: Sgb2AggregateComponent; share: number; exactCents: number; rule: Sgb2FinancingRule };
  const atoms: Atomic[] = [];
  rules.forEach((rule) => {
    const component = components.find((item) => item.component === rule.component)!;
    atoms.push({
      key: `${rule.view}:${rule.payer}:${rule.component}`,
      view: rule.view,
      payer: rule.payer,
      component: rule.component,
      share: rule.share,
      exactCents: component.payment.exactCents * rule.share,
      rule,
    });
  });
  const roundedByView = new Map<Sgb2FinancingView, Map<string, number>>();
  (["cash-payer", "net-financing"] as Sgb2FinancingView[]).forEach((view) => {
    roundedByView.set(view, roundExactEntries(atoms.filter((atom) => atom.view === view).map((atom) => ({ key: atom.key, exactCents: atom.exactCents }))));
  });
  const groups = new Map<string, Atomic[]>();
  atoms.forEach((atom) => {
    const key = `${atom.view}:${atom.payer}`;
    const group = groups.get(key) ?? [];
    group.push(atom);
    groups.set(key, group);
  });
  return [...groups.entries()].map<Sgb2PayerAggregate>(([key, group]) => {
    const [view, payer] = key.split(":") as [Sgb2FinancingView, string];
    const componentPayments = group.sort((a, b) => COMPONENTS.indexOf(a.component) - COMPONENTS.indexOf(b.component)).map((atom) => ({
      component: atom.component,
      share: atom.share,
      payment: money(atom.exactCents, roundedByView.get(view)!.get(atom.key) ?? 0),
    }));
    return {
      view,
      payer,
      payment: money(sum(componentPayments.map((item) => item.payment.exactCents)), sum(componentPayments.map((item) => item.payment.roundedCents))),
      componentPayments,
      sourceIds: unique(group.map((atom) => atom.rule.sourceId)),
      uncertaintyClass: group.some((atom) => atom.rule.uncertaintyClass === "hoch") ? "hoch" : group.some((atom) => atom.rule.uncertaintyClass === "mittel") ? "mittel" : "niedrig",
      notes: unique(group.map((atom) => atom.rule.note)),
    };
  }).sort((a, b) => a.view.localeCompare(b.view) || a.payer.localeCompare(b.payer));
}

function drilldownLabel(dimension: Sgb2DrilldownDimension, key: string) {
  if (dimension === "component") return COMPONENT_LABELS[key as Sgb2AggregateComponent] ?? key;
  return key;
}

function aggregateDrilldowns(settlements: Sgb2MonthlySettlement[]) {
  type Draft = { dimension: Sgb2DrilldownDimension; key: string; weightedBenefitUnitMonths: number; grossNeed: number; payment: number };
  const groups = new Map<string, Draft>();
  const add = (dimension: Sgb2DrilldownDimension, key: string, weight: number, grossNeed: number, payment: number) => {
    const mapKey = `${dimension}:${key}`;
    const current = groups.get(mapKey) ?? { dimension, key, weightedBenefitUnitMonths: 0, grossNeed: 0, payment: 0 };
    current.weightedBenefitUnitMonths += weight;
    current.grossNeed += grossNeed * weight;
    current.payment += payment * weight;
    groups.set(mapKey, current);
  };
  settlements.forEach((settlement) => {
    add("benefit-unit-type", settlement.benefitUnitType, settlement.weight, settlement.grossNeedCents, settlement.paymentCents);
    add("region", settlement.regionId, settlement.weight, settlement.grossNeedCents, settlement.paymentCents);
    add("income-band", settlement.incomeBand, settlement.weight, settlement.grossNeedCents, settlement.paymentCents);
    settlement.components.forEach((component) => add("component", component.component, settlement.weight, component.grossNeedCents, component.paymentCents));
  });
  const drafts = [...groups.values()];
  const roundedGross = new Map<Sgb2DrilldownDimension, Map<string, number>>();
  const roundedPayment = new Map<Sgb2DrilldownDimension, Map<string, number>>();
  (["benefit-unit-type", "region", "income-band", "component"] as Sgb2DrilldownDimension[]).forEach((dimension) => {
    const dimensionRows = drafts.filter((item) => item.dimension === dimension);
    roundedGross.set(dimension, roundExactEntries(dimensionRows.map((item) => ({ key: item.key, exactCents: item.grossNeed }))));
    roundedPayment.set(dimension, roundExactEntries(dimensionRows.map((item) => ({ key: item.key, exactCents: item.payment }))));
  });
  return drafts.map<Sgb2DrilldownAggregate>((item) => ({
    dimension: item.dimension,
    key: item.key,
    label: drilldownLabel(item.dimension, item.key),
    weightedBenefitUnitMonths: item.weightedBenefitUnitMonths,
    grossNeed: money(item.grossNeed, roundedGross.get(item.dimension)!.get(item.key) ?? 0),
    payment: money(item.payment, roundedPayment.get(item.dimension)!.get(item.key) ?? 0),
  })).sort((a, b) => a.dimension.localeCompare(b.dimension) || a.key.localeCompare(b.key));
}

function modelValueForReference(reference: Sgb2ReferenceValue, payment: Sgb2MoneyAggregate, components: Sgb2AnnualComponentAggregate[], payers: Sgb2PayerAggregate[]) {
  if (reference.scope.kind === "total-payment") return payment.roundedCents;
  if (reference.scope.kind === "component") return components.find((item) => item.component === reference.scope.component)?.payment.roundedCents ?? 0;
  return payers.find((item) => item.view === reference.scope.view && item.payer === reference.scope.payer)?.payment.roundedCents ?? 0;
}

function compareReferences(referenceValues: Sgb2ReferenceValue[], payment: Sgb2MoneyAggregate, components: Sgb2AnnualComponentAggregate[], payers: Sgb2PayerAggregate[]) {
  return [...referenceValues].sort((a, b) => a.id.localeCompare(b.id)).map<Sgb2ReferenceComparison>((reference) => {
    if (!Number.isFinite(reference.valueCents) || reference.valueCents < 0) throw new Error(`Referenzwert ${reference.id} muss nichtnegativ und endlich sein.`);
    const modelValueCents = modelValueForReference(reference, payment, components, payers);
    const absoluteDeviationCents = modelValueCents - reference.valueCents;
    return {
      referenceId: reference.id,
      label: reference.label,
      period: reference.period,
      scope: reference.scope,
      referenceValueCents: reference.valueCents,
      modelValueCents,
      absoluteDeviationCents,
      relativeDeviation: reference.valueCents === 0 ? null : absoluteDeviationCents / reference.valueCents,
      comparability: reference.comparability,
      boundaryDifferences: [...reference.boundaryDifferences],
      sourceId: reference.sourceId,
    };
  });
}

export function aggregateSgb2AnnualResults(
  units: Sgb2BenefitUnit[],
  claims: Sgb2BenefitUnitClaimResult[],
  housingResults: Sgb2HousingCostResult[],
  reference: Sgb2ScenarioReference,
  options: Sgb2AnnualAggregationOptions = {},
): Sgb2AnnualAggregationResult {
  const settlements = buildSgb2MonthlySettlements(units, claims, housingResults);
  const runIds = unique(settlements.map((item) => item.runId));
  if (runIds.length !== 1) throw new Error(`Aggregation benötigt genau einen Bevölkerungslauf; gefunden ${runIds.join(", ")}.`);
  const policyIds = unique(claims.map((claim) => claim.policyVersionId));
  if (policyIds.length !== 1 || policyIds[0] !== reference.policyVersionId) throw new Error("Policy-Versionen der Anspruchsergebnisse und des Szenarios stimmen nicht überein.");

  const components = aggregateComponents(settlements);
  const exactGrossNeed = sum(settlements.map((item) => item.grossNeedCents * item.weight));
  const exactCountableIncome = sum(settlements.map((item) => item.countableIncomeCents * item.weight));
  const exactIncomeCovered = sum(settlements.map((item) => item.incomeCoveredCents * item.weight));
  const exactReduction = sum(settlements.map((item) => item.reductionCents * item.weight));
  const exactPotentialPayment = sum(settlements.map((item) => item.potentialPaymentCents * item.weight));
  const exactPayment = sum(settlements.map((item) => item.paymentCents * item.weight));
  const grossNeed = money(exactGrossNeed, sum(components.map((item) => item.grossNeed.roundedCents)));
  const incomeCovered = money(exactIncomeCovered, sum(components.map((item) => item.incomeCovered.roundedCents)));
  const reduction = money(exactReduction, sum(components.map((item) => item.reduction.roundedCents)));
  const potentialPayment = money(exactPotentialPayment, sum(components.map((item) => item.potentialPayment.roundedCents)));
  const payment = money(exactPayment, sum(components.map((item) => item.payment.roundedCents)));
  const countableIncome = money(exactCountableIncome);

  const baseRules = (options.financingRules ?? defaultSgb2FinancingRules).map((rule) => ({ ...rule }));
  const financingRules = applyScenarioFinancingOverrides(baseRules, reference);
  validateFinancingRules(financingRules);
  const payers = aggregatePayers(components, financingRules);
  const drilldowns = aggregateDrilldowns(settlements);
  const comparisons = compareReferences(options.referenceValues ?? [], payment, components, payers);

  const months = unique(settlements.map((item) => item.month));
  const years = unique(months.map((month) => month.slice(0, 4)));
  const calendarYear = years.length === 1 ? Number(years[0]) : null;
  const completeCalendarYear = calendarYear !== null && months.length === 12 && months.every((month, index) => month === `${calendarYear}-${String(index + 1).padStart(2, "0")}`);
  const validationIssues: Sgb2AggregationValidationIssue[] = [];
  if (!completeCalendarYear) validationIssues.push({ code: "aggregation_period_incomplete_year", severity: "info", path: "period", message: "Der Ergebniszeitraum umfasst kein vollständiges Kalenderjahr; es werden ausschließlich vorhandene Monatsresultate hochgerechnet." });
  if (financingRules.some((rule) => rule.view === "net-financing" && ["accommodation", "heating"].includes(rule.component) && rule.note.includes("Bundesweite Modellquote"))) {
    validationIssues.push({ code: "financing_national_model_share", severity: "warning", path: "payers.net-financing", message: "Die Nettofinanzierung der KdU nutzt eine sichtbare bundesweite Modellquote, solange keine landesspezifischen Szenario-Overrides vorliegen." });
  }
  if (housingResults.some((result) => result.lookupLevel === "model-fallback")) validationIssues.push({ code: "housing_model_fallback_used", severity: "warning", path: "housing", message: "Mindestens ein KdU-Ergebnis verwendet den regionalen Modell-Fallback." });
  if (!(options.referenceValues?.length)) validationIssues.push({ code: "reference_values_not_provided", severity: "info", path: "comparisons", message: "Es wurden keine externen Statistik- oder Haushaltsreferenzen für den Abgleich übergeben." });

  const sourceIds = unique([
    ...settlements.flatMap((item) => item.sourceIds),
    ...financingRules.map((rule) => rule.sourceId),
    ...(options.referenceValues ?? []).map((item) => item.sourceId),
  ]);
  const uncertaintyClass = housingResults.some((result) => result.uncertaintyClass === "hoch") || financingRules.some((rule) => rule.uncertaintyClass === "hoch") ? "hoch" : "mittel";
  const limitations = unique([
    ...settlements.flatMap((item) => item.limitations),
    "Einkommensdeckung und Leistungsminderungen werden für die Komponentenberichterstattung proportional mit stabiler Restcent-Regel verteilt; der Gesamtanspruch selbst wird davon nicht verändert.",
    "Die Nettofinanzierung der Unterkunft und Heizung nutzt ohne landesspezifischen Override eine offen ausgewiesene bundesweite Modellquote von 70 Prozent Bund und 30 Prozent kommunaler Träger.",
    "Referenzabweichungen werden ausgewiesen, aber niemals durch eine freie Kalibrier- oder Restgröße in das Modellergebnis zurückgeschrieben.",
  ]);

  if (Math.abs(grossNeed.exactCents - sum(components.map((item) => item.grossNeed.exactCents))) > 1e-6) throw new Error("Aggregierter Bruttobedarf ist nicht vollständig in Komponenten zerlegbar.");
  if (Math.abs(payment.exactCents - sum(components.map((item) => item.payment.exactCents))) > 1e-6) throw new Error("Aggregierter Zahlungsanspruch ist nicht vollständig in Komponenten zerlegbar.");
  (["cash-payer", "net-financing"] as Sgb2FinancingView[]).forEach((view) => {
    const total = sum(payers.filter((item) => item.view === view).map((item) => item.payment.exactCents));
    if (Math.abs(total - payment.exactCents) > 1e-6) throw new Error(`Kostenträgersicht ${view} ist nicht vollständig finanziert.`);
  });

  return {
    schemaVersion: SGB2_AGGREGATION_SCHEMA_VERSION,
    modelVersion: SGB2_AGGREGATION_MODEL_VERSION,
    runId: runIds[0],
    policyVersionId: reference.policyVersionId,
    periodFrom: months[0],
    periodTo: months[months.length - 1],
    calendarYear,
    completeCalendarYear,
    simulatedBenefitUnitMonths: settlements.length,
    weightedBenefitUnitMonths: sum(settlements.map((item) => item.weight)),
    weightedPaymentMonths: sum(settlements.filter((item) => item.paymentActive).map((item) => item.weight)),
    grossNeed,
    countableIncome,
    incomeCovered,
    reduction,
    potentialPayment,
    payment,
    components,
    payers,
    drilldowns,
    comparisons,
    calibrationAdjustment: money(0, 0),
    sourceIds,
    uncertaintyClass,
    validationIssues,
    limitations,
  };
}
