import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSgb2ReleaseValidation,
  createSgb2ReproducibilityKey,
  inclusiveMonthCount,
  type Sgb2ReleaseValidationInput,
} from "../src/lib/sgb2-release-validation";

const baseline: Sgb2ReleaseValidationInput = {
  runId: "population-seed-20260714",
  policyVersionId: "sgb2-policy-2026-07",
  modelVersion: "sgb2-0.1.0",
  periodFrom: "2026-07",
  periodTo: "2026-12",
  paymentCents: 2_000_000_000_000,
  components: [
    { id: "standard-need", paymentCents: 1_100_000_000_000 },
    { id: "additional-need", paymentCents: 100_000_000_000 },
    { id: "accommodation", paymentCents: 600_000_000_000 },
    { id: "heating", paymentCents: 200_000_000_000 },
  ],
  uncertaintyClass: "mittel",
  durationMs: 4_250,
  samplePersons: 2_000,
  sampleBenefitUnits: 1_150,
  simulatedBenefitUnitMonths: 6_900,
};

test("Reproduzierbarkeitsschlüssel ist unabhängig von der Komponentenreihenfolge", () => {
  const first = createSgb2ReproducibilityKey(baseline);
  const second = createSgb2ReproducibilityKey({ ...baseline, components: [...baseline.components].reverse() });
  assert.equal(first, second);
  assert.match(first, /^sgb2-[0-9a-f]{8}$/);
});

test("geänderter Referenzlauf erzeugt einen anderen Schlüssel", () => {
  const first = createSgb2ReproducibilityKey(baseline);
  const second = createSgb2ReproducibilityKey({ ...baseline, paymentCents: baseline.paymentCents + 1 });
  assert.notEqual(first, second);
});

test("sechsmonatiger Referenzlauf wird für den Haushaltsabgleich annualisiert", () => {
  const result = buildSgb2ReleaseValidation(baseline);
  const cash = result.comparisons.find((item) => item.id === "federal-cash-benefit-2024")!;
  const kdu = result.comparisons.find((item) => item.id === "federal-kdu-participation-2024")!;
  assert.equal(cash.modelValueCents, 2_400_000_000_000);
  assert.equal(kdu.modelValueCents, 1_120_000_000_000);
  assert.equal(cash.absoluteDeviationCents, cash.modelValueCents - cash.referenceValueCents);
  assert.equal(kdu.absoluteDeviationCents, kdu.modelValueCents - kdu.referenceValueCents);
});

test("Unsicherheitsband und Performancegrenze sind sichtbar und reproduzierbar", () => {
  const result = buildSgb2ReleaseValidation(baseline);
  assert.deepEqual(result.uncertaintyBand, {
    lowerCents: 1_800_000_000_000,
    upperCents: 2_200_000_000_000,
    relativeWidth: 0.1,
    interpretation: "Dokumentierte Sensitivitätskennzeichnung; kein statistisches Konfidenzintervall.",
  });
  assert.equal(result.performance.warningThresholdMs, 15_000);
  assert.equal(result.performance.status, "innerhalb");
  assert.equal(result.qualityStatus, "prüfbar");
});

test("hohe Unsicherheit verbreitert das Band und kennzeichnet die Qualität", () => {
  const result = buildSgb2ReleaseValidation({ ...baseline, uncertaintyClass: "hoch", durationMs: 61_000, samplePersons: 10_000 });
  assert.equal(result.uncertaintyBand.relativeWidth, 0.2);
  assert.equal(result.qualityStatus, "eingeschränkt");
  assert.equal(result.performance.warningThresholdMs, 60_000);
  assert.equal(result.performance.status, "überschritten");
});

test("Monatszählung ist inklusiv und lehnt invertierte Zeiträume ab", () => {
  assert.equal(inclusiveMonthCount("2026-07", "2026-12"), 6);
  assert.equal(inclusiveMonthCount("2026-12", "2027-01"), 2);
  assert.throws(() => inclusiveMonthCount("2026-12", "2026-07"), /ungültig/);
});
