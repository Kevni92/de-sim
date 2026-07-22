import assert from "node:assert/strict";
import test from "node:test";
import { personalEffectExamples } from "../src/lib/personal-effect-fixtures";
import { normalizePersonalEffectStatements, validatePersonalEffectStatement, type PersonalEffectStatement } from "../src/lib/personal-effect-contracts";

const base = (patch: Record<string, unknown> = {}): PersonalEffectStatement => ({
  id: "test-claim",
  claimKey: "test.module.rule",
  title: "Testaussage",
  perspective: "persoenlicher-haushalt",
  direction: "entlastung",
  accuracy: "persoenlich-berechnet",
  layer: "direkt",
  value: { kind: "punktwert", amount: 120, unit: "€ pro Jahr", period: { fromYear: 2026, toYear: 2026 } },
  explanation: "Eine nachvollziehbare Testbegründung.",
  affectedGroup: { description: "Testgruppe", condition: "Testvoraussetzung" },
  evidence: { dataYear: 2026, legalYear: 2026, evidenceStatus: "modellrechnung", causality: "modelliert", confidence: "mittel", uncertainty: "Bandbreite abhängig von den Eingaben.", sourceIds: ["source-test"] },
  profile: { used: ["Einkommensband"], missing: [] },
  contextEffectIds: [],
  ...patch,
} as PersonalEffectStatement);

test("Referenzbeispiele decken Spitzensteuersatz und Kinderfreibetrag ohne Punktwert-Missbrauch ab", () => {
  assert.equal(normalizePersonalEffectStatements(personalEffectExamples).errors.length, 0);
  assert.equal(personalEffectExamples[0].value.kind, "punktwert");
  assert.equal(personalEffectExamples[1].value.kind, "gerichtet");
  assert.deepEqual(personalEffectExamples[1].contextEffectIds, ["family-demography-unavailable"]);
});

test("alle Richtungen und Genauigkeitsstufen sind als getrennte Vertragstypen darstellbar", () => {
  const directions = ["entlastung", "belastung", "keine-direkte-wirkung", "gemischt", "unklar"] as const;
  for (const [index, direction] of directions.entries()) assert.equal(validatePersonalEffectStatement(base({ id: `direction-${index}`, direction })).length, 0);
  assert.equal(validatePersonalEffectStatement(base({ id: "cohort", accuracy: "aehnliche-haushalte-modelliert", value: { kind: "bandbreite", lower: 10, central: 20, upper: 30, unit: "€ pro Jahr", period: { fromYear: 2026, toYear: 2027 } } })).length, 0);
  assert.equal(validatePersonalEffectStatement(base({ id: "qualitative", accuracy: "qualitativ-eingeordnet", value: { kind: "gerichtet", summary: "Richtung ist bekannt, Betrag nicht." } })).length, 0);
  assert.equal(validatePersonalEffectStatement(base({ id: "unknown", accuracy: "nicht-bestimmbar", direction: "unklar", value: { kind: "nicht-bestimmbar", reason: "Notwendige Angabe fehlt." } })).length, 0);
});

test("unzulässige Werttypen und unvollständige Evidenz werden abgewiesen", () => {
  const mismatch = validatePersonalEffectStatement(base({ accuracy: "qualitativ-eingeordnet", value: { kind: "punktwert", amount: 5, unit: "€", period: { fromYear: 2026, toYear: 2026 } } }));
  assert.ok(mismatch.some((error) => error.code === "value-accuracy-mismatch"));
  const incomplete = validatePersonalEffectStatement(base({ evidence: { ...base().evidence, sourceIds: [] } }));
  assert.ok(incomplete.some((error) => error.code === "missing-evidence-source"));
  const overlap = validatePersonalEffectStatement(base({ profile: { used: ["Kinder"], missing: ["Kinder"] } }));
  assert.ok(overlap.some((error) => error.code === "profile-fields-overlap"));
  const normative = validatePersonalEffectStatement(base({ title: "Gute Reform für den Haushalt" }));
  assert.ok(normative.some((error) => error.code === "normative-language"));
});

test("Dubletten und widersprüchliche Claim-Richtungen werden nicht dargestellt", () => {
  const result = normalizePersonalEffectStatements([
    base({ id: "same" }),
    base({ id: "same" }),
    base({ id: "relief", claimKey: "same.rule", direction: "entlastung" }),
    base({ id: "burden", claimKey: "same.rule", direction: "belastung" }),
  ]);
  assert.equal(result.statements.length, 1);
  assert.equal(result.errors.filter((error) => error.code === "duplicate-statement").length, 1);
  assert.equal(result.errors.filter((error) => error.code === "conflicting-statements").length, 2);
});
