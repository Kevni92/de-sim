import assert from "node:assert/strict";
import test from "node:test";
import {
  SGB2_AGGREGATION_MODEL_VERSION,
  aggregateSgb2AnnualResults,
  buildSgb2MonthlySettlements,
} from "../src/lib/sgb2-aggregation";
import { calculateSgb2BenefitUnitClaim } from "../src/lib/sgb2-claim";
import { calculateSgb2HousingCosts } from "../src/lib/sgb2-housing";
import { defaultSgb2ScenarioReference } from "../src/lib/sgb2-policy";
import type { HouseholdRole, Sgb2BenefitUnit, Sgb2PersonProfile } from "../src/lib/types";

function person(id: string, employmentGrossCents = 0, role: HouseholdRole = "alleinlebend"): Sgb2PersonProfile {
  return {
    id: `${id}-sgb2`,
    runId: "run-aggregation-test",
    personId: id,
    householdId: "household-1",
    benefitUnitId: "bg-1",
    status: "erwerbsfaehig",
    eligibilityStatus: "potenziell-leistungsberechtigt",
    relationshipRole: role,
    age: 35,
    income: {
      employmentGrossCents,
      otherIncomeCents: 0,
      pensionIncomeCents: 0,
      transferIncomeCents: 0,
      countableIncomeProxyCents: 0,
    },
    benefitMonths: 6,
    weight: 1,
    benefitWeight: 1,
    sourceId: "source-sgb2-statistics",
    assumptionIds: [],
  };
}

function unit(weight = 1): Sgb2BenefitUnit {
  return {
    id: "bg-1",
    runId: "run-aggregation-test",
    householdId: "household-1",
    memberIds: ["p1"],
    eligibleMemberIds: ["p1"],
    nonEligibleMemberIds: [],
    type: "alleinstehend",
    regionGroup: "stadtstaat",
    incomeBand: "kein-einkommen",
    receiptStatus: "bezug",
    benefitMonths: 6,
    entryMonth: 7,
    exitMonth: 12,
    monthlyCountableIncomeProxyCents: 0,
    monthlyNeedProxyCents: 0,
    housing: {
      regionId: "berlin:grossstadt",
      housingStatus: "miete",
      floorAreaSquareMeters: 50,
      baseRentCents: 40_000,
      coldOperatingCostsCents: 10_000,
      grossColdRentCents: 50_000,
      heatingCostsCents: 12_000,
      sourceId: "source-sgb2-kdu-model",
      uncertainty: "hoch",
    },
    baseWeight: weight,
    weight,
    derivationTrace: [],
    sourceIds: [],
    assumptionIds: [],
  };
}

function monthly(month: string, employmentGrossCents = 0, weight = 1) {
  const profiles = [person("p1", employmentGrossCents)];
  const benefitUnit = unit(weight);
  const claim = calculateSgb2BenefitUnitClaim(
    benefitUnit,
    profiles,
    defaultSgb2ScenarioReference,
    { referenceMonth: month, respectModeledReceiptWindow: true },
  );
  const housing = calculateSgb2HousingCosts(benefitUnit, defaultSgb2ScenarioReference, {
    referenceMonth: month,
    heatingEnergySource: "natural-gas",
    heatedBuildingAreaSquareMeters: 600,
  });
  return { benefitUnit, profiles, claim, housing };
}

function sixMonths(employmentGrossCents = 0, weight = 1) {
  const months = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
  const rows = months.map((month) => monthly(month, employmentGrossCents, weight));
  return {
    units: [rows[0].benefitUnit],
    claims: rows.map((row) => row.claim),
    housing: rows.map((row) => row.housing),
  };
}

test("monatliche Zusammenführung ergänzt KdU und bleibt vollständig zerlegbar", () => {
  const row = monthly("2026-07");
  const [settlement] = buildSgb2MonthlySettlements([row.benefitUnit], [row.claim], [row.housing]);
  assert.equal(settlement.grossNeedCents, 112_700);
  assert.equal(settlement.paymentCents, 112_700);
  assert.equal(settlement.components.find((item) => item.component === "standard-need")?.paymentCents, 56_300);
  assert.equal(settlement.components.find((item) => item.component === "accommodation")?.paymentCents, 44_900);
  assert.equal(settlement.components.find((item) => item.component === "heating")?.paymentCents, 11_500);
  assert.equal(settlement.components.reduce((total, item) => total + item.paymentCents, 0), settlement.paymentCents);
});

test("überschießendes Einkommen aus dem Anspruchsrechner deckt auch den Wohnbedarf", () => {
  const row = monthly("2026-07", 100_000);
  assert.equal(row.claim.netClaimCents, 0);
  assert.ok(row.claim.countableIncomeCents > row.claim.grossNeedCents);
  const [settlement] = buildSgb2MonthlySettlements([row.benefitUnit], [row.claim], [row.housing]);
  assert.equal(settlement.paymentCents, settlement.grossNeedCents - row.claim.countableIncomeCents);
  assert.equal(settlement.paymentCents, 45_500);
  assert.equal(settlement.incomeCoveredCents, row.claim.countableIncomeCents);
});

test("außerhalb des modellierten Bezugsfensters bleibt der potenzielle Anspruch sichtbar, die Zahlung aber null", () => {
  const row = monthly("2027-01");
  const [settlement] = buildSgb2MonthlySettlements([row.benefitUnit], [row.claim], [row.housing]);
  assert.equal(row.claim.paymentStatus, "ausserhalb-modelliertem-bezugsfenster");
  assert.equal(settlement.potentialPaymentCents, 112_700);
  assert.equal(settlement.paymentCents, 0);
  assert.equal(settlement.paymentActive, false);
});

test("Golden Result: sechs Monatsansprüche werden mit BG-Gewicht zu Halbjahreswerten hochgerechnet", () => {
  const input = sixMonths(0, 2);
  const result = aggregateSgb2AnnualResults(input.units, input.claims, input.housing, defaultSgb2ScenarioReference);
  assert.equal(result.modelVersion, SGB2_AGGREGATION_MODEL_VERSION);
  assert.equal(result.periodFrom, "2026-07");
  assert.equal(result.periodTo, "2026-12");
  assert.equal(result.calendarYear, 2026);
  assert.equal(result.completeCalendarYear, false);
  assert.equal(result.simulatedBenefitUnitMonths, 6);
  assert.equal(result.weightedBenefitUnitMonths, 12);
  assert.equal(result.weightedPaymentMonths, 12);
  assert.equal(result.grossNeed.exactCents, 112_700 * 12);
  assert.equal(result.payment.exactCents, 112_700 * 12);
  assert.equal(result.components.reduce((total, item) => total + item.payment.roundedCents, 0), result.payment.roundedCents);
  assert.ok(result.validationIssues.some((issue) => issue.code === "aggregation_period_incomplete_year"));
});

test("Zahlstellen- und Nettofinanzierung bleiben getrennte, vollständig summierende Sichten", () => {
  const row = monthly("2026-07");
  const result = aggregateSgb2AnnualResults([row.benefitUnit], [row.claim], [row.housing], defaultSgb2ScenarioReference);
  const cashBund = result.payers.find((item) => item.view === "cash-payer" && item.payer === "bund")!;
  const cashMunicipal = result.payers.find((item) => item.view === "cash-payer" && item.payer === "kommunaler-traeger")!;
  const netBund = result.payers.find((item) => item.view === "net-financing" && item.payer === "bund")!;
  const netMunicipal = result.payers.find((item) => item.view === "net-financing" && item.payer === "kommunaler-traeger")!;
  assert.equal(cashBund.payment.exactCents, 56_300);
  assert.equal(cashMunicipal.payment.exactCents, 56_400);
  assert.equal(netBund.payment.exactCents, 95_780);
  assert.equal(netMunicipal.payment.exactCents, 16_920);
  for (const view of ["cash-payer", "net-financing"] as const) {
    assert.equal(result.payers.filter((item) => item.view === view).reduce((total, item) => total + item.payment.roundedCents, 0), result.payment.roundedCents);
  }
});

test("Szenario-Overrides ändern nur die Nettofinanzierung der adressierten Komponenten", () => {
  const row = monthly("2026-07");
  const reference = {
    ...defaultSgb2ScenarioReference,
    financingOverrides: [
      { component: "accommodation", payer: "bund", share: 0.6 },
      { component: "accommodation", payer: "kommunaler-traeger", share: 0.4 },
      { component: "heating", payer: "bund", share: 0.6 },
      { component: "heating", payer: "kommunaler-traeger", share: 0.4 },
    ],
  };
  const result = aggregateSgb2AnnualResults([row.benefitUnit], [row.claim], [row.housing], reference);
  assert.equal(result.payers.find((item) => item.view === "cash-payer" && item.payer === "kommunaler-traeger")?.payment.exactCents, 56_400);
  assert.equal(result.payers.find((item) => item.view === "net-financing" && item.payer === "bund")?.payment.exactCents, 90_140);
  assert.equal(result.payers.find((item) => item.view === "net-financing" && item.payer === "kommunaler-traeger")?.payment.exactCents, 22_560);
  assert.ok(!result.validationIssues.some((issue) => issue.code === "financing_national_model_share"));
});

test("amtlicher Abgleich zeigt Referenz, Modell, absolute und relative Abweichung ohne Kalibrierrest", () => {
  const row = monthly("2026-07");
  const result = aggregateSgb2AnnualResults([row.benefitUnit], [row.claim], [row.housing], defaultSgb2ScenarioReference, {
    referenceValues: [{
      id: "reference-total",
      label: "Testreferenz Zahlungsanspruch",
      period: "2026-07",
      scope: { kind: "total-payment" },
      valueCents: 120_000,
      sourceId: "source-sgb2-statistics",
      comparability: "mittel",
      boundaryDifferences: ["Testwert enthält eine abweichende Abgrenzung."],
    }],
  });
  assert.deepEqual(result.comparisons[0], {
    referenceId: "reference-total",
    label: "Testreferenz Zahlungsanspruch",
    period: "2026-07",
    scope: { kind: "total-payment" },
    referenceValueCents: 120_000,
    modelValueCents: 112_700,
    absoluteDeviationCents: -7_300,
    relativeDeviation: -7_300 / 120_000,
    comparability: "mittel",
    boundaryDifferences: ["Testwert enthält eine abweichende Abgrenzung."],
    sourceId: "source-sgb2-statistics",
  });
  assert.deepEqual(result.calibrationAdjustment, { exactCents: 0, roundedCents: 0 });
  assert.ok(!result.validationIssues.some((issue) => issue.code === "reference_values_not_provided"));
});

test("Drill-downs nach BG-Typ, Region, Einkommen und Komponente bleiben konsistent", () => {
  const row = monthly("2026-07");
  const result = aggregateSgb2AnnualResults([row.benefitUnit], [row.claim], [row.housing], defaultSgb2ScenarioReference);
  assert.equal(result.drilldowns.find((item) => item.dimension === "benefit-unit-type" && item.key === "alleinstehend")?.payment.roundedCents, result.payment.roundedCents);
  assert.equal(result.drilldowns.find((item) => item.dimension === "region" && item.key === "berlin:grossstadt")?.payment.roundedCents, result.payment.roundedCents);
  assert.equal(result.drilldowns.find((item) => item.dimension === "income-band" && item.key === "kein-einkommen")?.payment.roundedCents, result.payment.roundedCents);
  assert.equal(result.drilldowns.filter((item) => item.dimension === "component").reduce((total, item) => total + item.payment.roundedCents, 0), result.payment.roundedCents);
});

test("Restcent-Verteilung bleibt auch bei gebrochenen Gewichten vollständig", () => {
  const row = monthly("2026-07", 0, 1.5);
  const result = aggregateSgb2AnnualResults([row.benefitUnit], [row.claim], [row.housing], defaultSgb2ScenarioReference);
  assert.equal(result.components.reduce((total, item) => total + item.grossNeed.roundedCents, 0), result.grossNeed.roundedCents);
  assert.equal(result.components.reduce((total, item) => total + item.payment.roundedCents, 0), result.payment.roundedCents);
  for (const view of ["cash-payer", "net-financing"] as const) {
    assert.equal(result.payers.filter((item) => item.view === view).reduce((total, item) => total + item.payment.roundedCents, 0), result.payment.roundedCents);
  }
});

test("Eingabereihenfolge ändert das Ergebnis nicht", () => {
  const input = sixMonths(0, 1);
  const first = aggregateSgb2AnnualResults(input.units, input.claims, input.housing, defaultSgb2ScenarioReference);
  const second = aggregateSgb2AnnualResults(input.units, [...input.claims].reverse(), [...input.housing].reverse(), defaultSgb2ScenarioReference);
  assert.deepEqual(first, second);
});

test("fehlende, zusätzliche oder inkonsistente Monatsergebnisse werden nicht still akzeptiert", () => {
  const row = monthly("2026-07");
  assert.throws(() => buildSgb2MonthlySettlements([row.benefitUnit], [row.claim], []), /KdU-Ergebnis/);
  assert.throws(() => buildSgb2MonthlySettlements([row.benefitUnit], [], [row.housing]), /KdU-Ergebnisse ohne/);
  const mismatchedHousing = { ...row.housing, month: "2026-08" };
  assert.throws(() => buildSgb2MonthlySettlements([row.benefitUnit], [row.claim], [mismatchedHousing]), /KdU-Ergebnis/);
});
