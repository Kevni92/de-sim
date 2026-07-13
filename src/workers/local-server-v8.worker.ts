import "./local-server-v6.worker";
import { effectModuleMetrics, effectModuleSources } from "../lib/effect-transparency";
import { sgb2PolicySources } from "../lib/sgb2-transparency";

const request = indexedDB.open("de-sim-local-server", 4);
const db = await new Promise<IDBDatabase>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const transaction = db.transaction(["sources", "metrics"], "readwrite");
effectModuleSources.forEach((source) => transaction.objectStore("sources").put(source));
sgb2PolicySources.forEach((source) => transaction.objectStore("sources").put(source));
effectModuleMetrics.forEach((metric) => transaction.objectStore("metrics").put(metric));
await new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error);
});
db.close();
