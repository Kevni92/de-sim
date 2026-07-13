import "./local-server-v5.worker";
import { expenseModuleMetrics, expenseModuleSources } from "../lib/expense-transparency";

const request = indexedDB.open("de-sim-local-server", 4);
const db = await new Promise<IDBDatabase>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const transaction = db.transaction(["sources", "metrics"], "readwrite");
expenseModuleSources.forEach((source) => transaction.objectStore("sources").put(source));
expenseModuleMetrics.forEach((metric) => transaction.objectStore("metrics").put(metric));
await new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error);
});
db.close();
