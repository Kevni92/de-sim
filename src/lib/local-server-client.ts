import type {
  ActiveScenarioDraft,
  LocalRequest,
  LocalResponse,
  MetricRecord,
  ScenarioState,
  SourceRecord,
} from "./types";

type LocalRequestInput =
  | { type: "sources:list" }
  | { type: "metrics:list" }
  | { type: "scenarios:list" }
  | { type: "scenarios:save"; payload: ScenarioState }
  | { type: "scenarios:delete"; payload: { scenarioId: string } }
  | { type: "draft:get" }
  | { type: "draft:save"; payload: ActiveScenarioDraft };

class LocalServerClient {
  private worker: Worker;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();

  constructor() {
    this.worker = new Worker(new URL("../workers/local-server.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event: MessageEvent<LocalResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      event.data.ok ? request.resolve(event.data.data) : request.reject(new Error(event.data.error));
    });
    this.worker.addEventListener("error", (event) => {
      for (const request of this.pending.values()) request.reject(event.error ?? new Error("Worker-Fehler"));
      this.pending.clear();
    });
  }

  private call<T>(request: LocalRequestInput): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ ...request, id } satisfies LocalRequest);
    });
  }

  listSources() {
    return this.call<SourceRecord[]>({ type: "sources:list" });
  }

  listMetrics() {
    return this.call<MetricRecord[]>({ type: "metrics:list" });
  }

  listScenarios() {
    return this.call<ScenarioState[]>({ type: "scenarios:list" });
  }

  saveScenario(scenario: ScenarioState) {
    return this.call<ScenarioState>({ type: "scenarios:save", payload: scenario });
  }

  deleteScenario(scenarioId: string) {
    return this.call<null>({ type: "scenarios:delete", payload: { scenarioId } });
  }

  getActiveDraft() {
    return this.call<ActiveScenarioDraft | null>({ type: "draft:get" });
  }

  saveActiveDraft(draft: ActiveScenarioDraft) {
    return this.call<ActiveScenarioDraft>({ type: "draft:save", payload: draft });
  }
}

export const localServer = new LocalServerClient();
