import { calculateEffectRun, effectRegistry, type EffectLocalRequest, type EffectLocalResponse, type EffectRun } from "../lib/long-term-effects";
import type { SyntheticHousehold, SyntheticPerson } from "../lib/types";

const scope = globalThis as unknown as { addEventListener(type: "message", listener: (event: MessageEvent<EffectLocalRequest>) => void): void; postMessage(message: EffectLocalResponse): void };
const EFFECT_DB = "de-sim-effects-server", RUNS = "effect-runs", POPULATION_DB = "de-sim-population-server";
const PERSONS = "population-persons", HOUSEHOLDS = "population-households", POPULATION_RUNS = "population-runs";

function value<T>(request: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function complete(transaction: IDBTransaction) { return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen")); }); }
function open(name: string, version?: number) { return new Promise<IDBDatabase>((resolve, reject) => { const request = version ? indexedDB.open(name, version) : indexedDB.open(name); request.onupgradeneeded = () => { if (name === EFFECT_DB && !request.result.objectStoreNames.contains(RUNS)) { const store = request.result.createObjectStore(RUNS, { keyPath: "id" }); store.createIndex("scenarioId", "scenarioId"); store.createIndex("populationRunId", "populationRunId"); store.createIndex("createdAt", "createdAt"); } }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function populationValues<T>(db: IDBDatabase, storeName: string, runId: string) { const store = db.transaction(storeName).objectStore(storeName); if (!store.indexNames.contains("runId")) throw new Error("Der Bevölkerungsspeicher ist nicht kompatibel."); return value(store.index("runId").getAll(runId)) as Promise<T[]>; }

async function handle(request: EffectLocalRequest): Promise<EffectLocalResponse> {
  try {
    if (request.type === "effects:registry") return { id: request.id, ok: true, data: effectRegistry };
    const db = await open(EFFECT_DB, 1);
    if (request.type === "effects:calculate") {
      const populationDb = await open(POPULATION_DB);
      const run = await value(populationDb.transaction(POPULATION_RUNS).objectStore(POPULATION_RUNS).get(request.payload.populationRunId));
      if (!run) throw new Error("Der referenzierte Bevölkerungslauf ist lokal nicht vorhanden.");
      const [persons, households] = await Promise.all([
        populationValues<SyntheticPerson>(populationDb, PERSONS, request.payload.populationRunId),
        populationValues<SyntheticHousehold>(populationDb, HOUSEHOLDS, request.payload.populationRunId),
      ]);
      populationDb.close();
      if (!persons.length || !households.length) throw new Error("Der Bevölkerungslauf enthält keine auswertbaren Personen oder Haushalte.");
      const result: EffectRun = { ...calculateEffectRun(request.payload, persons, households), inputSignature: request.payload.inputSignature };
      const transaction = db.transaction(RUNS, "readwrite"); transaction.objectStore(RUNS).put(result); await complete(transaction);
      return { id: request.id, ok: true, data: result };
    }
    const store = db.transaction(RUNS, request.type === "effects:delete-run" ? "readwrite" : "readonly").objectStore(RUNS);
    if (request.type === "effects:list-runs") { const runs = await value(store.getAll()) as EffectRun[]; return { id: request.id, ok: true, data: runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }; }
    if (request.type === "effects:get-latest") { const runs = await value(store.index("scenarioId").getAll(request.payload.scenarioId)) as EffectRun[]; const filtered = request.payload.populationRunId ? runs.filter((run) => run.populationRunId === request.payload.populationRunId) : runs; return { id: request.id, ok: true, data: filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null }; }
    if (request.type === "effects:delete-run") { store.delete(request.payload.runId); await complete(store.transaction); return { id: request.id, ok: true, data: null }; }
    throw new Error("Unbekannte Wirkungsoperation.");
  } catch (error) { return { id: request.id, ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" }; }
}
scope.addEventListener("message", async (event) => scope.postMessage(await handle(event.data)));
