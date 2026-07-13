export type Confidence = "hoch" | "mittel" | "niedrig";
export type SourceStatus = "amtlich" | "modell" | "annahme";

export interface SourceRecord {
  id: string;
  title: string;
  institution: string;
  url: string;
  dataYear: number;
  legalYear: number;
  status: SourceStatus;
  confidence: Confidence;
  summary: string;
  method: string;
  limitations: string[];
  checkedAt: string;
}

export interface ScenarioState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  modelLevel: "statisch" | "verhalten" | "langfrist";
  revenueChanges: Record<string, number>;
  expenseChanges: Record<string, number>;
}

export type LocalRequest =
  | { id: string; type: "sources:list" }
  | { id: string; type: "scenarios:list" }
  | { id: string; type: "scenarios:save"; payload: ScenarioState }
  | { id: string; type: "scenarios:delete"; payload: { scenarioId: string } };

export type LocalResponse =
  | { id: string; ok: true; data: SourceRecord[] | ScenarioState[] | ScenarioState | null }
  | { id: string; ok: false; error: string };
