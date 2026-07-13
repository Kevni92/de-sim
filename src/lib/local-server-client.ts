import type { IncomeTaxResult } from "./income-tax";
import type {
  EffectCalculationInput,
  EffectLocalRequest,
  EffectLocalResponse,
  EffectModuleDefinition,
  EffectRun,
} from "./long-term-effects";
import type {
  ActiveScenarioDraft,
  CalibrationEntry,
  IncomeTaxSettings,
  LocalRequest,
  LocalResponse,
  MetricRecord,
  ModelLevel,
  PopulationGenerationOptions,
  PopulationQuery,
  PopulationQueryResult,
  PopulationRun,
  PopulationSummary,
  ScenarioState,
  SourceRecord,
} from "./types";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type LocalRequestInput = WithoutId<LocalRequest>;
type EffectRequestInput = WithoutId<EffectLocalRequest>;

class WorkerRpcClient {
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  private tail: Promise<void> = Promise.resolve();

  constructor(private worker: Worker) {
    worker.addEventListener("message", (event: MessageEvent<LocalResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      event.data.ok ? request.resolve(event.data.data) : request.reject(new Error(event.data.error));
    });
    worker.addEventListener("error", (event) => {
      for (const request of this.pending.values()) request.reject(event.error ?? new Error("Worker-Fehler"));
      this.pending.clear();
    });
  }

  call<T>(request: LocalRequestInput): Promise<T> {
    const execute = () => {
      const id = crypto.randomUUID();
      return new Promise<T>((resolve, reject) => {
        this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
        this.worker.postMessage({ ...request, id } as LocalRequest);
      });
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

class EffectWorkerRpcClient {
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  private tail: Promise<void> = Promise.resolve();

  constructor(private worker: Worker) {
    worker.addEventListener("message", (event: MessageEvent<EffectLocalResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      event.data.ok ? request.resolve(event.data.data) : request.reject(new Error(event.data.error));
    });
    worker.addEventListener("error", (event) => {
      for (const request of this.pending.values()) request.reject(event.error ?? new Error("Wirkungs-Worker-Fehler"));
      this.pending.clear();
    });
  }

  call<T>(request: EffectRequestInput): Promise<T> {
    const execute = () => {
      const id = crypto.randomUUID();
      return new Promise<T>((resolve, reject) => {
        this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
        this.worker.postMessage({ ...request, id } as EffectLocalRequest);
      });
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

class LocalServerClient {
  private core = new WorkerRpcClient(new Worker(new URL("../workers/local-server-v8.worker.ts", import.meta.url), { type: "module" }));
  private population = new WorkerRpcClient(new Worker(new URL("../workers/population.worker.ts", import.meta.url), { type: "module" }));
  private effects = new EffectWorkerRpcClient(new Worker(new URL("../workers/effects.worker.ts", import.meta.url), { type: "module" }));

  listSources() { return this.core.call<SourceRecord[]>({ type: "sources:list" }); }
  listMetrics() { return this.core.call<MetricRecord[]>({ type: "metrics:list" }); }
  listScenarios() { return this.core.call<ScenarioState[]>({ type: "scenarios:list" }); }
  saveScenario(scenario: ScenarioState) { return this.core.call<ScenarioState>({ type: "scenarios:save", payload: scenario }); }
  deleteScenario(scenarioId: string) { return this.core.call<null>({ type: "scenarios:delete", payload: { scenarioId } }); }
  getActiveDraft() { return this.core.call<ActiveScenarioDraft | null>({ type: "draft:get" }); }
  saveActiveDraft(draft: ActiveScenarioDraft) { return this.core.call<ActiveScenarioDraft>({ type: "draft:save", payload: draft }); }

  generatePopulation(options: PopulationGenerationOptions) { return this.population.call<PopulationRun>({ type: "population:generate", payload: options }); }
  getActivePopulation() { return this.population.call<PopulationRun>({ type: "population:get-active" }); }
  listPopulationRuns() { return this.population.call<PopulationRun[]>({ type: "population:list-runs" }); }
  activatePopulation(runId: string) { return this.population.call<PopulationRun>({ type: "population:activate", payload: { runId } }); }
  getPopulationSummary(runId?: string | null) { return this.population.call<PopulationSummary>({ type: "population:get-summary", payload: { runId: runId ?? undefined } }); }
  getPopulationCalibration(runId?: string | null) { return this.population.call<CalibrationEntry[]>({ type: "population:get-calibration", payload: { runId: runId ?? undefined } }); }
  queryPopulation(query: PopulationQuery, runId?: string | null) { return this.population.call<PopulationQueryResult>({ type: "population:query", payload: { runId: runId ?? undefined, query } }); }
  deletePopulationRun(runId: string) { return this.population.call<null>({ type: "population:delete-run", payload: { runId } }); }
  estimatePopulationIncomeTax(settings: IncomeTaxSettings, modelLevel: ModelLevel, runId?: string | null) {
    return this.population.call<IncomeTaxResult>({ type: "population:income-tax", payload: { runId: runId ?? undefined, settings, modelLevel } });
  }

  listEffectModules() { return this.effects.call<EffectModuleDefinition[]>({ type: "effects:registry" }); }
  calculateEffects(input: EffectCalculationInput) { return this.effects.call<EffectRun>({ type: "effects:calculate", payload: input }); }
  getLatestEffectRun(scenarioId: string, populationRunId?: string | null) {
    return this.effects.call<EffectRun | null>({ type: "effects:get-latest", payload: { scenarioId, populationRunId: populationRunId ?? undefined } });
  }
  listEffectRuns() { return this.effects.call<EffectRun[]>({ type: "effects:list-runs" }); }
  deleteEffectRun(runId: string) { return this.effects.call<null>({ type: "effects:delete-run", payload: { runId } }); }
}

export const localServer = new LocalServerClient();
