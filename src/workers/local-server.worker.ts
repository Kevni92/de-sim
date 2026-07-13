import type { LocalRequest, LocalResponse, ScenarioState, SourceRecord } from "../lib/types";

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<LocalRequest>) => void): void;
  postMessage(message: LocalResponse): void;
};

const DB_NAME = "de-sim-local-server";
const DB_VERSION = 1;
const SOURCES = "sources";
const SCENARIOS = "scenarios";

const seedSources: SourceRecord[] = [
  {
    id: "source-est",
    title: "Datensammlung zur Steuerpolitik",
    institution: "Bundesministerium der Finanzen",
    url: "https://www.bundesfinanzministerium.de/",
    dataYear: 2025,
    legalYear: 2026,
    status: "amtlich",
    confidence: "hoch",
    summary: "Amtliche Ausgangswerte für Einkommensteuer und Steueraufkommen.",
    method: "Übernahme veröffentlichter Aggregate; Reformwirkung im Prototyp als Modellrechnung.",
    limitations: ["Demo-Baseline", "noch keine vollständige Mikrosimulation"],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-budget",
    title: "Öffentlicher Gesamthaushalt",
    institution: "Destatis",
    url: "https://www.destatis.de/",
    dataYear: 2025,
    legalYear: 2026,
    status: "amtlich",
    confidence: "hoch",
    summary: "Aggregierte Einnahmen und Ausgaben des öffentlichen Gesamthaushalts.",
    method: "Konsolidierte Darstellung von Bund, Ländern, Kommunen und Sozialversicherung.",
    limitations: ["Werte im Init-Prototyp gerundet"],
    checkedAt: "2026-07-13",
  },
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SOURCES)) db.createObjectStore(SOURCES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SCENARIOS)) db.createObjectStore(SCENARIOS, { keyPath: "id" });
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

async function seed(db: IDBDatabase) {
  const count = await requestValue(db.transaction(SOURCES).objectStore(SOURCES).count());
  if (count > 0) return;
  const tx = db.transaction(SOURCES, "readwrite");
  seedSources.forEach((source) => tx.objectStore(SOURCES).put(source));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function handle(request: LocalRequest): Promise<LocalResponse> {
  try {
    const db = await openDb();
    await seed(db);
    if (request.type === "sources:list") {
      const data = await requestValue(db.transaction(SOURCES).objectStore(SOURCES).getAll());
      return { id: request.id, ok: true, data };
    }
    if (request.type === "scenarios:list") {
      const data = await requestValue(db.transaction(SCENARIOS).objectStore(SCENARIOS).getAll()) as ScenarioState[];
      data.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { id: request.id, ok: true, data };
    }
    if (request.type === "scenarios:save") {
      const tx = db.transaction(SCENARIOS, "readwrite");
      tx.objectStore(SCENARIOS).put(request.payload);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return { id: request.id, ok: true, data: request.payload };
    }
    const tx = db.transaction(SCENARIOS, "readwrite");
    tx.objectStore(SCENARIOS).delete(request.payload.scenarioId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { id: request.id, ok: true, data: null };
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

workerScope.addEventListener("message", async (event) => {
  workerScope.postMessage(await handle(event.data));
});
