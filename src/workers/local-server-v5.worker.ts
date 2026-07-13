import "./local-server.worker";
import { revenueModuleMetrics, revenueModuleSources } from "../lib/revenue-transparency";

const DB_NAME = "de-sim-local-server";
const DB_VERSION = 4;
const SOURCES = "sources";
const METRICS = "metrics";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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

async function seedRevenueReferenceData() {
  const db = await openDb();
  const transaction = db.transaction([SOURCES, METRICS], "readwrite");
  revenueModuleSources.forEach((source) => transaction.objectStore(SOURCES).put(source));
  revenueModuleMetrics.forEach((metric) => transaction.objectStore(METRICS).put(metric));
  await transactionComplete(transaction);
  db.close();
}

await seedRevenueReferenceData();
