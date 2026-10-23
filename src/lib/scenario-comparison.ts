import { collectScenarioChanges, type ScenarioChange, type ScenarioChangeCategory, type ScenarioChangeValue } from "./scenario-changes";
import type { ScenarioDraftWithPopulationBasis } from "./scenario-state";

export interface ScenarioFoundationDifference {
  id: string;
  label: string;
  current: string;
  alternative: string;
}

export interface ScenarioChangeComparisonRow {
  id: string;
  category: ScenarioChangeCategory;
  module: string;
  group: string;
  label: string;
  description?: string;
  baselineCurrent: ScenarioChangeValue;
  baselineAlternative: ScenarioChangeValue;
  current: ScenarioChangeValue;
  alternative: ScenarioChangeValue;
  unit: string;
  formatParameterId?: string;
}

function populationRunId(scenario: ScenarioDraftWithPopulationBasis) {
  return scenario.populationBasis?.runId ?? scenario.populationRunId;
}

function populationModelVersion(scenario: ScenarioDraftWithPopulationBasis) {
  return scenario.populationBasis?.modelVersion ?? scenario.populationModelVersion;
}

export function compareScenarioFoundations(current: ScenarioDraftWithPopulationBasis, alternative: ScenarioDraftWithPopulationBasis): ScenarioFoundationDifference[] {
  const differences: ScenarioFoundationDifference[] = [];
  const add = (id: string, label: string, left: string | number, right: string | number) => {
    if (left !== right) differences.push({ id, label, current: String(left), alternative: String(right) });
  };

  add("legalYear", "Rechtsstand", current.legalYear, alternative.legalYear);
  add("dataYear", "Datenbezug", current.dataYear, alternative.dataYear);
  add("modelLevel", "Modellstufe", current.modelLevel, alternative.modelLevel);
  add("horizonYears", "Zeithorizont", current.horizonYears, alternative.horizonYears);
  if (current.modelVersion !== alternative.modelVersion) add("modelVersion", "Szenariomodell", current.modelVersion, alternative.modelVersion);

  const currentRunId = populationRunId(current);
  const alternativeRunId = populationRunId(alternative);
  if (currentRunId !== alternativeRunId) {
    differences.push({
      id: "populationRunId",
      label: "Bevölkerungsgrundlage",
      current: currentRunId ? `Lauf ${currentRunId}` : "kein gespeicherter Lauf",
      alternative: alternativeRunId ? `Lauf ${alternativeRunId}` : "kein gespeicherter Lauf",
    });
  }
  const currentPopulationVersion = populationModelVersion(current);
  const alternativePopulationVersion = populationModelVersion(alternative);
  if (currentPopulationVersion !== alternativePopulationVersion) {
    differences.push({ id: "populationModelVersion", label: "Bevölkerungsmodell", current: currentPopulationVersion ?? "nicht hinterlegt", alternative: alternativePopulationVersion ?? "nicht hinterlegt" });
  }

  if (current.sgb2.policyVersionId !== alternative.sgb2.policyVersionId) {
    differences.push({ id: "sgb2Policy", label: "Bürgergeld-Regelstand", current: current.sgb2.policyVersionId, alternative: alternative.sgb2.policyVersionId });
  }
  if (current.sgb2.modelVersion !== alternative.sgb2.modelVersion) {
    differences.push({ id: "sgb2Model", label: "Bürgergeld-Rechenmodell", current: current.sgb2.modelVersion, alternative: alternative.sgb2.modelVersion });
  }
  if (current.sgb2.populationRunId !== alternative.sgb2.populationRunId) {
    differences.push({
      id: "sgb2PopulationRunId",
      label: "Bürgergeld-Bevölkerungsgrundlage",
      current: current.sgb2.populationRunId ? `Lauf ${current.sgb2.populationRunId}` : "kein eigener Lauf",
      alternative: alternative.sgb2.populationRunId ? `Lauf ${alternative.sgb2.populationRunId}` : "kein eigener Lauf",
    });
  }
  return differences;
}

export function sameScenarioChangeValue(left: ScenarioChangeValue, right: ScenarioChangeValue) {
  return typeof left === "number" && typeof right === "number" ? Math.abs(left - right) < 1e-9 : left === right;
}

function indexById(changes: ScenarioChange[]) {
  return new Map(changes.map((change) => [change.id, change]));
}

export function compareScenarioChanges(current: ScenarioDraftWithPopulationBasis, alternative: ScenarioDraftWithPopulationBasis): ScenarioChangeComparisonRow[] {
  const currentChanges = indexById(collectScenarioChanges(current));
  const alternativeChanges = indexById(collectScenarioChanges(alternative));
  const ids = new Set([...currentChanges.keys(), ...alternativeChanges.keys()]);

  return [...ids].flatMap((id) => {
    const currentChange = currentChanges.get(id);
    const alternativeChange = alternativeChanges.get(id);
    const sample = currentChange ?? alternativeChange;
    if (!sample) return [];
    const baselineCurrent = currentChange?.baseline ?? alternativeChange!.baseline;
    const baselineAlternative = alternativeChange?.baseline ?? currentChange!.baseline;
    return [{
      id,
      category: sample.category,
      module: sample.module,
      group: sample.group,
      label: sample.label,
      description: sample.description,
      baselineCurrent,
      baselineAlternative,
      current: currentChange?.current ?? baselineCurrent,
      alternative: alternativeChange?.current ?? baselineAlternative,
      unit: sample.unit,
      formatParameterId: sample.formatParameterId,
    }];
  });
}
