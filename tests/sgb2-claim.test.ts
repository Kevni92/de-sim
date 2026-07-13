import assert from "node:assert/strict";
import test from "node:test";
import { defaultSgb2ScenarioReference } from "../src/lib/sgb2-policy";
import {
  SGB2_CLAIM_MODEL_VERSION,
  calculateSgb2BenefitUnitClaim,
  calculateSgb2Claims,
} from "../src/lib/sgb2-claim";
import type { HouseholdRole, Sgb2BenefitUnit, Sgb2EligibilityStatus, Sgb2PersonProfile } from "../src/lib/types";

function person(
  id: string,
  age: number,
  relationshipRole: HouseholdRole,
  income: Partial<Sgb2PersonProfile["income"]> = {},
  eligibilityStatus: Sgb2EligibilityStatus = "potenziell-leistungsberechtigt",
): Sgb2PersonProfile {
  return {
    id: `${id}-sgb2`,
    runId: "run-claim-test",
    personId: id,
    householdId: "household-1",
    benefitUnitId: "bg-1",
    status: age < 15 ? "nicht-erwerbsfaehig-kind" : "erwerbsfaehig",
    eligibilityStatus,
    relationshipRole,
    age,
    income: {
      employmentGrossCents: 0,
      otherIncomeCents: 0,
      pensionIncomeCents: 0,
      transferIncomeCents: 0,
      countableIncomeProxyCents: 0,
      ...income,
    },
    benefitMonths: 12,
    weight: 1,
    benefitWeight: 1,
    sourceId: "source-sgb2-statistics",
    assumptionIds: [],
  };
}

function unit(
  profiles: Sgb2PersonProfile[],
  type: Sgb2BenefitUnit["type"],
  window: { entryMonth: number; exitMonth: number } = { entryMonth: 1, exitMonth: 12 },
): Sgb2BenefitUnit {
  const eligibleMemberIds = profiles.filter((profile) => profile.eligibilityStatus === "potenziell-leistungsberechtigt").map((profile) => profile.personId);
  return {
    id: "bg-1",
    runId: "run-claim-test",
    householdId: "household-1",
    memberIds: profiles.map((profile) => profile.personId),
    eligibleMemberIds,
    nonEligibleMemberIds: profiles.filter((profile) => profile.eligibilityStatus !== "potenziell-leistungsberechtigt").map((profile) => profile.personId),
    type,
    regionGroup: "west",
    incomeBand: "kein-einkommen",
    receiptStatus: "bezug",
    benefitMonths: window.exitMonth - window.entryMonth + 1,
    entryMonth: window.entryMonth,
    exitMonth: window.exitMonth,
    monthlyCountableIncomeProxyCents: 0,
    monthlyNeedProxyCents: 0,
    housing: {
      regionId: "test:stadt",
      housingStatus: "miete",
      floorAreaSquareMeters: 50,
      baseRentCents: 40_000,
      coldOperatingCostsCents: 10_000,
      grossColdRentCents: 50_000,
      heatingCostsCents: 8_000,
      sourceId: "source-sgb2-kdu-model",
      uncertainty: "hoch",
    },
    baseWeight: 1,
    weight: 1,
    derivationTrace: [],
    sourceIds: [],
    assumptionIds: [],
  };
}

function claim(
  profiles: Sgb2PersonProfile[],
  type: Sgb2BenefitUnit["type"],
  options: Parameters<typeof calculateSgb2BenefitUnitClaim>[3] = {},
) {
  return calculateSgb2BenefitUnitClaim(unit(profiles, type), profiles, defaultSgb2ScenarioReference, options);
}

test("Golden Case: alleinstehende Person ohne Einkommen erhält vollen Regelbedarf", () => {
  const result = claim([person("p1", 35, "alleinlebend")], "alleinstehend");
  assert.equal(result.modelVersion, SGB2_CLAIM_MODEL_VERSION);
  assert.equal(result.month, "2026-07");
  assert.equal(result.standardNeedCents, 56_300);
  assert.equal(result.additionalNeedCents, 0);
  assert.equal(result.countableIncomeCents, 0);
  assert.equal(result.netClaimCents, 56_300);
  assert.equal(result.claimStatus, "vollanspruch");
  assert.equal(result.housingIncluded, false);
  assert.ok(result.validationIssues.some((issue) => issue.code === "housing_not_included"));
});

test("Golden Case: Paar und Alleinerziehende werden personengenau berechnet", () => {
  const couple = [person("p1", 35, "partner"), person("p2", 34, "partner")];
  const coupleResult = claim(couple, "paar-ohne-kinder");
  assert.equal(coupleResult.standardNeedCents, 101_200);
  assert.deepEqual(coupleResult.persons.map((item) => item.standardNeedCents), [50_600, 50_600]);

  const singleParent = [person("p1", 30, "elternteil"), person("p2", 4, "kind")];
  const singleParentResult = claim(singleParent, "alleinerziehend");
  assert.equal(singleParentResult.standardNeedCents, 92_000);
  assert.equal(singleParentResult.additionalNeedCents, 20_268);
  assert.equal(singleParentResult.netClaimCents, 112_268);
  assert.equal(singleParentResult.persons[0].additionalNeedEvaluations.find((item) => item.ruleId === "additional-need-single-parent-primary")?.status, "applied");
});

test("Erwerbseinkommen nutzt Grundabsetzbetrag und alle betroffenen Tarifsegmente", () => {
  const result = claim([person("p1", 35, "alleinlebend", { employmentGrossCents: 70_000 })], "alleinstehend");
  assert.equal(result.grossIncomeCents, 70_000);
  assert.equal(result.deductionsAndAllowancesCents, 23_800);
  assert.equal(result.countableIncomeCents, 46_200);
  assert.equal(result.countableIncomeAppliedCents, 46_200);
  assert.equal(result.netClaimCents, 10_100);
  assert.equal(result.claimStatus, "teilanspruch");
});

test("Vorrangige Leistungen und privilegierte Einnahmen bleiben getrennt nachvollziehbar", () => {
  const profiles = [person("p1", 35, "alleinlebend", { transferIncomeCents: 20_000 })];
  const baseline = claim(profiles, "alleinstehend");
  const privileged = claim(profiles, "alleinstehend", { personFacts: { p1: { privilegedIncomeCents: 5_000 } } });
  assert.equal(baseline.priorityBenefitCents, 20_000);
  assert.equal(baseline.countableIncomeCents, 20_000);
  assert.equal(baseline.netClaimCents, 36_300);
  assert.equal(privileged.countableIncomeCents, 15_000);
  assert.equal(privileged.netClaimCents, 41_300);
});

test("Explizite Schwangerschafts- und Teilhabefakten aktivieren nur die zugehörigen Mehrbedarfe", () => {
  const profiles = [person("p1", 35, "alleinlebend")];
  const baseline = claim(profiles, "alleinstehend");
  const withFacts = claim(profiles, "alleinstehend", { personFacts: { p1: { pregnant: true, disabilityParticipation: true } } });
  assert.equal(baseline.additionalNeedCents, 0);
  assert.equal(withFacts.additionalNeedCents, 29_276);
  assert.equal(withFacts.netClaimCents, 85_576);
  assert.deepEqual(withFacts.persons[0].additionalNeedEvaluations.filter((item) => item.status === "applied").map((item) => item.ruleId).sort(), ["additional-need-disability-participation", "additional-need-pregnancy"]);
});

test("Nullanspruch und überschießendes Einkommen werden ohne negative Beträge verteilt", () => {
  const profiles = [
    person("p1", 35, "partner", { employmentGrossCents: 200_000 }),
    person("p2", 34, "partner"),
  ];
  const result = claim(profiles, "paar-ohne-kinder");
  assert.equal(result.netClaimCents, 0);
  assert.equal(result.claimStatus, "nullanspruch");
  assert.ok(result.countableIncomeCents > result.grossNeedCents);
  assert.equal(result.countableIncomeAppliedCents, result.grossNeedCents);
  assert.deepEqual(result.persons.map((item) => item.netClaimCents), [0, 0]);
});

test("Leistungsminderungen sind explizit und deaktivierbar", () => {
  const profiles = [person("p1", 35, "alleinlebend")];
  const disabled = claim(profiles, "alleinstehend", { reductionsEnabled: false, reductionTriggers: { p1: "first-breach" } });
  const enabled = claim(profiles, "alleinstehend", { reductionsEnabled: true, reductionTriggers: { p1: "first-breach" } });
  assert.equal(disabled.reductionCents, 0);
  assert.equal(disabled.netClaimCents, 56_300);
  assert.equal(enabled.reductionCents, 5_630);
  assert.equal(enabled.netClaimCents, 50_670);
});

test("Modelliertes Bezugsfenster kann getrennt vom potenziellen Anspruch berücksichtigt werden", () => {
  const profiles = [person("p1", 35, "alleinlebend")];
  const result = calculateSgb2BenefitUnitClaim(
    unit(profiles, "alleinstehend", { entryMonth: 8, exitMonth: 9 }),
    profiles,
    defaultSgb2ScenarioReference,
    { referenceMonth: "2026-07", respectModeledReceiptWindow: true },
  );
  assert.equal(result.potentialNetClaimCents, 56_300);
  assert.equal(result.netClaimCents, 0);
  assert.equal(result.paymentStatus, "ausserhalb-modelliertem-bezugsfenster");
});

test("Parameteränderungen wirken nur auf fachlich betroffene Regelbedarfsfälle", () => {
  const reference = {
    ...defaultSgb2ScenarioReference,
    parameterOverrides: [{ parameterId: "sgb2.standard-need.single", value: 60_000 }],
  };
  const adult = [person("p1", 35, "alleinlebend")];
  const child = [person("p1", 4, "kind")];
  assert.equal(calculateSgb2BenefitUnitClaim(unit(adult, "alleinstehend"), adult, reference).standardNeedCents, 60_000);
  assert.equal(calculateSgb2BenefitUnitClaim(unit(child, "gemischt"), child, reference).standardNeedCents, 35_700);
});

test("Randfälle lehnen negative Beträge und ungültige Gültigkeitsmonate ab", () => {
  const negative = [person("p1", 35, "alleinlebend", { employmentGrossCents: -1 })];
  assert.throws(() => claim(negative, "alleinstehend"), /nichtnegative endliche Zahl/);
  const profiles = [person("p1", 35, "alleinlebend")];
  assert.throws(() => claim(profiles, "alleinstehend", { referenceMonth: "2026-06" }), /nicht gültig/);
  assert.throws(() => claim(profiles, "alleinstehend", { referenceMonth: "06-2026" }), /YYYY-MM/);
});

test("Property: Personen-, Komponenten- und BG-Summen bleiben für Grenzwerte konsistent", () => {
  for (let gross = 0; gross <= 250_000; gross += 2_503) {
    const profiles = [person("p1", 35, "alleinlebend", { employmentGrossCents: gross })];
    const result = claim(profiles, "alleinstehend");
    assert.ok(Number.isInteger(result.netClaimCents));
    assert.ok(result.netClaimCents >= 0 && result.netClaimCents <= result.grossNeedCents);
    assert.equal(result.standardNeedCents, result.persons.reduce((sum, item) => sum + item.standardNeedCents, 0));
    assert.equal(result.additionalNeedCents, result.persons.reduce((sum, item) => sum + item.additionalNeedCents, 0));
    assert.equal(result.netClaimCents, result.persons.reduce((sum, item) => sum + item.netClaimCents, 0));
    assert.equal(result.claimBeforeReductionCents - result.reductionCents, result.potentialNetClaimCents);
    assert.equal(result.componentResults.filter((item) => item.category === "payment").reduce((sum, item) => sum + item.appliedAmountCents, 0), result.netClaimCents);
  }
});

test("Batchberechnung ist deterministisch und stabil nach Bedarfsgemeinschafts-ID sortiert", () => {
  const firstProfiles = [person("p1", 35, "alleinlebend")];
  const secondProfiles = [{ ...person("p2", 40, "alleinlebend"), benefitUnitId: "bg-2", id: "p2-sgb2" }];
  const firstUnit = unit(firstProfiles, "alleinstehend");
  const secondUnit = { ...unit(secondProfiles, "alleinstehend"), id: "bg-2", memberIds: ["p2"], eligibleMemberIds: ["p2"] };
  const first = calculateSgb2Claims([secondUnit, firstUnit], [...secondProfiles, ...firstProfiles], defaultSgb2ScenarioReference);
  const second = calculateSgb2Claims([firstUnit, secondUnit], [...firstProfiles, ...secondProfiles], defaultSgb2ScenarioReference);
  assert.deepEqual(first, second);
  assert.deepEqual(first.results.map((item) => item.benefitUnitId), ["bg-1", "bg-2"]);
});
