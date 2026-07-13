export type Confidence = "hoch" | "mittel" | "niedrig";
export type SourceStatus = "amtlich" | "modell" | "annahme";
export type ModelLevel = "statisch" | "verhalten" | "langfrist";

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

export interface IncomeTaxSettings {
  allowance: number;
  entryRate: number;
  topRate: number;
  topThreshold: number;
  richRate: number;
  childAllowance: number;
  spouseSplitting: boolean;
}

export interface ScenarioState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  modelLevel: ModelLevel;
  revenueChanges: Record<string, number>;
  expenseChanges: Record<string, number>;
  incomeTax?: IncomeTaxSettings;
}

export type LocalRequest =
  | { id: string; type: "sources:list" }
  | { id: string; type: "scenarios:list" }
  | { id: string; type: "scenarios:save"; payload: ScenarioState }
  | { id: string; type: "scenarios:delete"; payload: { scenarioId: string } };

export type LocalResponse =
  | { id: string; ok: true; data: SourceRecord[] | ScenarioState[] | ScenarioState | null }
  | { id: string; ok: false; error: string };
