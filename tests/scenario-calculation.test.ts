import assert from "node:assert/strict";
import test from "node:test";
import {
  MODEL_LEVEL_OPTIONS,
  modelLevelCaution,
  modelLevelDescription,
  modelLevelLabel,
  resolveCalculationFreshness,
  timeHorizonLabel,
} from "../src/lib/scenario-calculation";
import {
  createScenarioHistory,
  defaultScenarioDraft,
  normalizeScenarioDraft,
  scenarioHistoryReducer,
} from "../src/lib/scenario-state";

test("verwendet verbindliche Nutzerbegriffe für alle Modellstufen", () => {
  assert.deepEqual(MODEL_LEVEL_OPTIONS.map((option) => option.label), [
    "Nur direkte Wirkung",
    "Mit kurzfristigen Reaktionen",
    "Langfristiges Szenario",
  ]);
  assert.equal(modelLevelLabel("statisch"), "Nur direkte Wirkung");
  assert.equal(modelLevelDescription("verhalten"), "Dokumentierte kurzfristige Verhaltens- und begrenzte Folgewirkungen.");
  assert.match(modelLevelCaution("langfrist"), /keine sichere Prognose/i);
  assert.equal(timeHorizonLabel(1), "1 Jahr");
  assert.equal(timeHorizonLabel(20), "20 Jahre");
});

test("unterscheidet aktuelle, laufende und veraltete Wirkungsrechnungen", () => {
  assert.equal(resolveCalculationFreshness({
    loading: true,
    hasResult: true,
    runModelLevel: "verhalten",
    runHorizonYears: 5,
    modelLevel: "langfrist",
    horizonYears: 20,
  }), "updating");
  assert.equal(resolveCalculationFreshness({
    loading: false,
    hasResult: true,
    runModelLevel: "verhalten",
    runHorizonYears: 5,
    modelLevel: "langfrist",
    horizonYears: 20,
  }), "stale");
  assert.equal(resolveCalculationFreshness({
    loading: false,
    hasResult: true,
    runModelLevel: "langfrist",
    runHorizonYears: 20,
    modelLevel: "langfrist",
    horizonYears: 20,
  }), "current");
});

test("normalisiert bestehende Szenarien ohne Schemaänderung", () => {
  const migrated = normalizeScenarioDraft({
    ...defaultScenarioDraft,
    modelLevel: "statisch",
    horizonYears: 10,
  });
  assert.equal(migrated.modelLevel, "statisch");
  assert.equal(migrated.horizonYears, 10);

  const invalid = normalizeScenarioDraft({
    ...defaultScenarioDraft,
    modelLevel: "unbekannt" as never,
    horizonYears: 7 as never,
  });
  assert.equal(invalid.modelLevel, defaultScenarioDraft.modelLevel);
  assert.equal(invalid.horizonYears, defaultScenarioDraft.horizonYears);
});

test("führt Modellstufe und Zeithorizont als gemeinsame Undo- und Redo-Änderung", () => {
  const initial = createScenarioHistory(defaultScenarioDraft);
  const changed = scenarioHistoryReducer(initial, {
    type: "change",
    patch: { modelLevel: "langfrist", horizonYears: 20 },
  });
  assert.equal(changed.present.modelLevel, "langfrist");
  assert.equal(changed.present.horizonYears, 20);

  const undone = scenarioHistoryReducer(changed, { type: "undo" });
  assert.equal(undone.present.modelLevel, defaultScenarioDraft.modelLevel);
  assert.equal(undone.present.horizonYears, defaultScenarioDraft.horizonYears);

  const redone = scenarioHistoryReducer(undone, { type: "redo" });
  assert.equal(redone.present.modelLevel, "langfrist");
  assert.equal(redone.present.horizonYears, 20);
});
