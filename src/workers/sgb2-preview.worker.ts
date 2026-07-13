import { aggregateSgb2AnnualResults } from "../lib/sgb2-aggregation";
import { calculateSgb2BenefitUnitClaim } from "../lib/sgb2-claim";
import { calculateSgb2HousingCosts } from "../lib/sgb2-housing";
import { defaultSgb2PolicyBundle, defaultSgb2ScenarioReference, type Sgb2ScenarioReference } from "../lib/sgb2-policy";
import type { Sgb2UiPreviewResult } from "../lib/sgb2-ui";
import type { Sgb2BenefitUnit, Sgb2PersonProfile } from "../lib/types";

type PreviewRequest = {
  id: string;
  type: "sgb2:preview";
  payload: { runId: string; reference: Sgb2ScenarioReference };
};

type PreviewResponse =
  | { id: string; ok: true; data: Sgb2UiPreviewResult }
  | { id: string; ok: false; error: string };

const scope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<PreviewRequest>) => void): void;
  postMessage(message: PreviewResponse): void;
};

const DB_NAME = "de-sim-population-server";
const DB_VERSION = 2;
const RUNS = "population-runs";
const PERSONS = "population-persons";
const HOUSEHOLDS = "population-households";
const SGB2_PERSONS = "population-sgb2-persons";
const BENEFIT_UNITS = "population-benefit-units";
const CALIBRATION = "population-calibration";
const VALIDATION = "population-validation";
const SETTINGS = "population-settings";

function createRunIndexedStore(db: IDBDatabase, name: string, keyPath: string) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath });
  store.createIndex("runId", "runId", { unique: false });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNS)) db.createObjectStore(RUNS, { keyPath: "metadata.id" });
      createRunIndexedStore(db, PERSONS, "id");
      createRunIndexedStore(db, HOUSEHOLDS, "id");
      createRunIndexedStore(db, SGB2_PERSONS, "id");
      createRunIndexedStore(db, BENEFIT_UNITS, "id");
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

function indexValues<T>(db: IDBDatabase, storeName: string, runId: string) {
  return requestValue(db.transaction(storeName).objectStore(storeName).index("runId").getAll(runId)) as Promise<T[]>;
}

function monthsForPolicy() {
  const validFrom = defaultSgb2PolicyBundle.policy.validFrom.slice(0, 7);
  const year = Number(validFrom.slice(0, 4));
  const startMonth = Number(validFrom.slice(5, 7));
  return Array.from({ length: 13 - startMonth }, (_, index) => `${year}-${String(startMonth + index).padStart(2, "0")}`);
}

function benefitStartMonth(unit: Sgb2BenefitUnit) {
  if (unit.entryMonth == null) return undefined;
  const year = defaultSgb2PolicyBundle.policy.validFrom.slice(0, 4);
  return `${year}-${String(unit.entryMonth).padStart(2, "0")}`;
}

function integratedPayment(claim: ReturnType<typeof calculateSgb2BenefitUnitClaim>, housing: ReturnType<typeof calculateSgb2HousingCosts>) {
  if (claim.paymentStatus !== "zahlbar") return 0;
  const totalNeed = claim.grossNeedCents + housing.recognizedHousingAndHeatingCents;
  const incomeCovered = Math.min(totalNeed, claim.countableIncomeCents);
  return Math.max(0, totalNeed - incomeCovered - claim.reductionCents);
}

async function calculatePreview(runId: string, reference: Sgb2ScenarioReference): Promise<Sgb2UiPreviewResult> {
  const db = await openDb();
  const [units, profiles] = await Promise.all([
    indexValues<Sgb2BenefitUnit>(db, BENEFIT_UNITS, runId),
    indexValues<Sgb2PersonProfile>(db, SGB2_PERSONS, runId),
  ]);
  db.close();
  if (!units.length || !profiles.length) throw new Error("Der gewählte Bevölkerungslauf enthält keine SGB-II-Mikrodaten.");

  const sortedUnits = [...units].sort((a, b) => a.id.localeCompare(b.id));
  const profilesByUnit = new Map<string, Sgb2PersonProfile[]>();
  profiles.forEach((profile) => {
    const list = profilesByUnit.get(profile.benefitUnitId) ?? [];
    list.push(profile);
    profilesByUnit.set(profile.benefitUnitId, list);
  });
  profilesByUnit.forEach((items) => items.sort((a, b) => a.personId.localeCompare(b.personId)));

  const baselineReference: Sgb2ScenarioReference = { ...defaultSgb2ScenarioReference, populationRunId: runId };
  const scenarioReference: Sgb2ScenarioReference = { ...reference, populationRunId: runId };
  const months = monthsForPolicy();
  const baselineClaims: ReturnType<typeof calculateSgb2BenefitUnitClaim>[] = [];
  const scenarioClaims: ReturnType<typeof calculateSgb2BenefitUnitClaim>[] = [];
  const baselineHousing: ReturnType<typeof calculateSgb2HousingCosts>[] = [];
  const scenarioHousing: ReturnType<typeof calculateSgb2HousingCosts>[] = [];
  const affectedUnits = new Set<string>();

  for (const month of months) {
    for (const unit of sortedUnits) {
      const unitProfiles = profilesByUnit.get(unit.id);
      if (!unitProfiles?.length) throw new Error(`Für Bedarfsgemeinschaft ${unit.id} fehlen Personenprofile.`);
      const claimOptions = { referenceMonth: month, respectModeledReceiptWindow: true };
      const housingFacts = { referenceMonth: month, benefitStartMonth: benefitStartMonth(unit) };
      const baselineClaim = calculateSgb2BenefitUnitClaim(unit, unitProfiles, baselineReference, claimOptions);
      const scenarioClaim = calculateSgb2BenefitUnitClaim(unit, unitProfiles, scenarioReference, claimOptions);
      const baselineHousingResult = calculateSgb2HousingCosts(unit, baselineReference, housingFacts);
      const scenarioHousingResult = calculateSgb2HousingCosts(unit, scenarioReference, housingFacts);
      baselineClaims.push(baselineClaim);
      scenarioClaims.push(scenarioClaim);
      baselineHousing.push(baselineHousingResult);
      scenarioHousing.push(scenarioHousingResult);
      if (integratedPayment(baselineClaim, baselineHousingResult) !== integratedPayment(scenarioClaim, scenarioHousingResult)) affectedUnits.add(unit.id);
    }
  }

  const baseline = aggregateSgb2AnnualResults(sortedUnits, baselineClaims, baselineHousing, baselineReference);
  const scenario = aggregateSgb2AnnualResults(sortedUnits, scenarioClaims, scenarioHousing, scenarioReference);
  const components = scenario.components.map((component) => {
    const baselineComponent = baseline.components.find((item) => item.component === component.component);
    return {
      id: component.component,
      label: component.component === "standard-need" ? "Regelbedarf" : component.component === "additional-need" ? "Mehrbedarfe" : component.component === "accommodation" ? "Unterkunft" : "Heizung",
      baselineCents: baselineComponent?.payment.roundedCents ?? 0,
      scenarioCents: component.payment.roundedCents,
      deltaCents: component.payment.roundedCents - (baselineComponent?.payment.roundedCents ?? 0),
    };
  });
  const payerMap = new Map<string, number>();
  scenario.payers.filter((item) => item.view === "net-financing").forEach((item) => payerMap.set(item.payer, (payerMap.get(item.payer) ?? 0) + item.payment.roundedCents));
  const affectedBenefitUnits = sortedUnits.filter((unit) => affectedUnits.has(unit.id)).reduce((sum, unit) => sum + unit.weight, 0);
  const affectedPersons = profiles.filter((profile) => affectedUnits.has(profile.benefitUnitId)).reduce((sum, profile) => sum + profile.weight, 0);

  return {
    runId,
    periodFrom: scenario.periodFrom,
    periodTo: scenario.periodTo,
    baselinePaymentCents: baseline.payment.roundedCents,
    scenarioPaymentCents: scenario.payment.roundedCents,
    deltaPaymentCents: scenario.payment.roundedCents - baseline.payment.roundedCents,
    affectedBenefitUnits,
    affectedPersons,
    weightedPaymentMonths: scenario.weightedPaymentMonths,
    components,
    payers: [...payerMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([payer, scenarioCents]) => ({
      payer,
      label: payer === "bund" ? "Bund" : payer === "kommunaler-traeger" ? "Kommunale Träger" : payer,
      scenarioCents,
    })),
    calibrationAdjustmentCents: scenario.calibrationAdjustment.roundedCents,
    sourceIds: scenario.sourceIds,
    uncertaintyClass: scenario.uncertaintyClass,
    limitations: scenario.limitations,
  };
}

scope.addEventListener("message", async (event) => {
  try {
    if (event.data.type !== "sgb2:preview") throw new Error("Unbekannte SGB-II-Vorschauoperation.");
    const data = await calculatePreview(event.data.payload.runId, event.data.payload.reference);
    scope.postMessage({ id: event.data.id, ok: true, data });
  } catch (error) {
    scope.postMessage({ id: event.data.id, ok: false, error: error instanceof Error ? error.message : "SGB-II-Vorschau fehlgeschlagen." });
  }
});
