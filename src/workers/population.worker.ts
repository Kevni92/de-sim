import {
  DEFAULT_BASELINE_ID,
  DEFAULT_POPULATION_SAMPLE_SIZE,
  DEFAULT_POPULATION_SEED,
  estimatePopulationIncomeTax,
  generatePopulation,
  populationSources,
  queryPopulation,
} from "../lib/population-model";
import type {
  CalibrationEntry,
  LocalRequest,
  LocalResponse,
  PopulationRun,
  PopulationRunMetadata,
  PopulationValidationIssue,
  SyntheticHousehold,
  SyntheticPerson,
} from "../lib/types";

const scope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<LocalRequest>) => void): void;
  postMessage(message: LocalResponse): void;
};

const DB_NAME = "de-sim-population-server";
const DB_VERSION = 1;
const RUNS = "population-runs";
const PERSONS = "population-persons";
const HOUSEHOLDS = "population-households";
const CALIBRATION = "population-calibration";
const VALIDATION = "population-validation";
const SETTINGS = "population-settings";
const ACTIVE_KEY = "active-run";

type StoredRun = PopulationRun;
type StoredCalibration = CalibrationEntry & { storageId: string; runId: string };
type StoredValidation = PopulationValidationIssue & { storageId: string; runId: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNS)) db.createObjectStore(RUNS, { keyPath: "metadata.id" });
      if (!db.objectStoreNames.contains(PERSONS)) {
        const store = db.createObjectStore(PERSONS, { keyPath: "id" });
        store.createIndex("runId", "runId", { unique: false });
      }
      if (!db.objectStoreNames.contains(HOUSEHOLDS)) {
        const store = db.createObjectStore(HOUSEHOLDS, { keyPath: "id" });
        store.createIndex("runId", "runId", { unique: false });
      }
      if (!db.objectStoreNames.contains(CALIBRATION)) {
        const store = db.createObjectStore(CALIBRATION, { keyPath: "storageId" });
        store.createIndex("runId", "runId", { unique: false });
      }
      if (!db.objectStoreNames.contains(VALIDATION)) {
        const store = db.createObjectStore(VALIDATION, { keyPath: "storageId" });
        store.createIndex("runId", "runId", { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen"));
  });
}
function indexValues<T>(db: IDBDatabase, storeName: string, runId: string) {
  return requestValue(db.transaction(storeName).objectStore(storeName).index("runId").getAll(runId)) as Promise<T[]>;
}
async function activeRunId(db: IDBDatabase) {
  const value = await requestValue(db.transaction(SETTINGS).objectStore(SETTINGS).get(ACTIVE_KEY)) as { id: string; runId: string } | undefined;
  return value?.runId ?? null;
}
async function setActiveRun(db: IDBDatabase, runId: string | null) {
  const transaction = db.transaction([SETTINGS, RUNS], "readwrite");
  const runs = await requestValue(transaction.objectStore(RUNS).getAll()) as StoredRun[];
  runs.forEach((run) => transaction.objectStore(RUNS).put({ ...run, metadata: { ...run.metadata, active: run.metadata.id === runId } }));
  transaction.objectStore(SETTINGS).put({ id: ACTIVE_KEY, runId });
  await transactionComplete(transaction);
}
async function deleteByRun(db: IDBDatabase, storeName: string, runId: string) {
  const transaction = db.transaction(storeName, "readwrite");
  const index = transaction.objectStore(storeName).index("runId");
  await new Promise<void>((resolve, reject) => {
    const cursor = index.openKeyCursor(IDBKeyRange.only(runId));
    cursor.onsuccess = () => {
      const result = cursor.result;
      if (!result) { resolve(); return; }
      transaction.objectStore(storeName).delete(result.primaryKey);
      result.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
  await transactionComplete(transaction);
}
async function deleteRunData(db: IDBDatabase, runId: string) {
  await deleteByRun(db, PERSONS, runId);
  await deleteByRun(db, HOUSEHOLDS, runId);
  await deleteByRun(db, CALIBRATION, runId);
  await deleteByRun(db, VALIDATION, runId);
  const transaction = db.transaction(RUNS, "readwrite");
  transaction.objectStore(RUNS).delete(runId);
  await transactionComplete(transaction);
}

async function saveGeneratedPopulation(db: IDBDatabase, generated: ReturnType<typeof generatePopulation>) {
  const runId = generated.run.metadata.id;
  const existing = await requestValue(db.transaction(RUNS).objectStore(RUNS).get(runId)) as StoredRun | undefined;
  if (existing) await deleteRunData(db, runId);
  const transaction = db.transaction([RUNS, PERSONS, HOUSEHOLDS, CALIBRATION, VALIDATION], "readwrite");
  transaction.objectStore(RUNS).put(generated.run);
  generated.persons.forEach((person) => transaction.objectStore(PERSONS).put(person));
  generated.households.forEach((household) => transaction.objectStore(HOUSEHOLDS).put(household));
  generated.run.calibration.forEach((entry) => transaction.objectStore(CALIBRATION).put({ ...entry, runId, storageId: `${runId}:${entry.id}` } satisfies StoredCalibration));
  generated.run.validation.forEach((entry, index) => transaction.objectStore(VALIDATION).put({ ...entry, runId, storageId: `${runId}:${entry.code}:${entry.entityId ?? index}` } satisfies StoredValidation));
  await transactionComplete(transaction);
  await setActiveRun(db, runId);
  return generated.run;
}

async function ensureDefaultRun(db: IDBDatabase) {
  const runId = await activeRunId(db);
  if (runId) {
    const existing = await requestValue(db.transaction(RUNS).objectStore(RUNS).get(runId)) as StoredRun | undefined;
    if (existing) return existing;
  }
  return saveGeneratedPopulation(db, generatePopulation({ seed: DEFAULT_POPULATION_SEED, sampleSize: DEFAULT_POPULATION_SAMPLE_SIZE, baselineId: DEFAULT_BASELINE_ID }));
}
async function resolveRun(db: IDBDatabase, requested?: string) {
  const id = requested ?? await activeRunId(db);
  if (!id) return ensureDefaultRun(db);
  const run = await requestValue(db.transaction(RUNS).objectStore(RUNS).get(id)) as StoredRun | undefined;
  if (!run) throw new Error("Der referenzierte Bevölkerungslauf ist lokal nicht vorhanden.");
  return run;
}

async function handle(request: LocalRequest): Promise<LocalResponse> {
  try {
    const db = await openDb();
    if (request.type === "population:generate") return { id: request.id, ok: true, data: await saveGeneratedPopulation(db, generatePopulation(request.payload)) };
    if (request.type === "population:get-active") return { id: request.id, ok: true, data: await ensureDefaultRun(db) };
    if (request.type === "population:list-runs") {
      const runs = await requestValue(db.transaction(RUNS).objectStore(RUNS).getAll()) as StoredRun[];
      runs.sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt));
      return { id: request.id, ok: true, data: runs };
    }
    if (request.type === "population:activate") {
      await resolveRun(db, request.payload.runId); await setActiveRun(db, request.payload.runId);
      return { id: request.id, ok: true, data: await resolveRun(db, request.payload.runId) };
    }
    if (request.type === "population:get-summary") return { id: request.id, ok: true, data: (await resolveRun(db, request.payload.runId)).summary };
    if (request.type === "population:get-calibration") {
      const run = await resolveRun(db, request.payload.runId);
      const entries = await indexValues<StoredCalibration>(db, CALIBRATION, run.metadata.id);
      return { id: request.id, ok: true, data: entries.map(({ storageId: _storageId, runId: _runId, ...entry }) => entry) };
    }
    if (request.type === "population:query") {
      const run = await resolveRun(db, request.payload.runId);
      const [persons, households] = await Promise.all([indexValues<SyntheticPerson>(db, PERSONS, run.metadata.id), indexValues<SyntheticHousehold>(db, HOUSEHOLDS, run.metadata.id)]);
      return { id: request.id, ok: true, data: queryPopulation(run.metadata.id, persons, households, request.payload.query) };
    }
    if (request.type === "population:income-tax") {
      const run = await resolveRun(db, request.payload.runId);
      const [persons, households] = await Promise.all([indexValues<SyntheticPerson>(db, PERSONS, run.metadata.id), indexValues<SyntheticHousehold>(db, HOUSEHOLDS, run.metadata.id)]);
      return { id: request.id, ok: true, data: estimatePopulationIncomeTax(run.metadata, persons, households, request.payload.settings, request.payload.modelLevel) };
    }
    if (request.type === "population:delete-run") {
      const current = await activeRunId(db);
      await deleteRunData(db, request.payload.runId);
      if (current === request.payload.runId) {
        const remaining = await requestValue(db.transaction(RUNS).objectStore(RUNS).getAll()) as StoredRun[];
        remaining.sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt));
        if (remaining[0]) await setActiveRun(db, remaining[0].metadata.id);
        else await setActiveRun(db, null);
      }
      return { id: request.id, ok: true, data: null };
    }
    throw new Error("Unbekannte Bevölkerungsoperation.");
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

void populationSources;
scope.addEventListener("message", async (event) => scope.postMessage(await handle(event.data)));
