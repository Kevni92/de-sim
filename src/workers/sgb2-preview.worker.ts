import { buildSgb2MonthlySettlements, defaultSgb2FinancingRules, type Sgb2AggregateComponent, type Sgb2FinancingRule } from "../lib/sgb2-aggregation";
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

type PreviewSummary = {
  periodFrom: string;
  periodTo: string;
  paymentCents: number;
  weightedPaymentMonths: number;
  components: Array<{ id: Sgb2AggregateComponent; paymentCents: number }>;
  payers: Array<{ payer: string; paymentCents: number }>;
  sourceIds: string[];
  uncertaintyClass: "mittel" | "hoch";
  limitations: string[];
};

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
const COMPONENTS: Sgb2AggregateComponent[] = ["standard-need", "additional-need", "accommodation", "heating"];

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function stableSum(values: number[]) {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const adjusted = value - compensation;
    const next = sum + adjusted;
    compensation = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}

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

function financingRules(reference: Sgb2ScenarioReference) {
  const rules = defaultSgb2FinancingRules.filter((rule) => rule.view === "net-financing").map((rule) => ({ ...rule }));
  const overrides = new Map<Sgb2AggregateComponent, typeof reference.financingOverrides>();
  reference.financingOverrides.forEach((override) => {
    const component = override.component as Sgb2AggregateComponent;
    if (!COMPONENTS.includes(component)) throw new Error(`Finanzierungs-Override verwendet unbekannte Komponente ${override.component}.`);
    const list = overrides.get(component) ?? [];
    list.push(override);
    overrides.set(component, list);
  });
  overrides.forEach((items, component) => {
    for (let index = rules.length - 1; index >= 0; index -= 1) if (rules[index].component === component) rules.splice(index, 1);
    items.forEach((item) => rules.push({
      view: "net-financing",
      component,
      payer: item.payer,
      share: item.share,
      sourceId: "source-sgb2-law",
      uncertaintyClass: "mittel",
      note: "Expliziter Szenario-Override der Nettofinanzierung.",
    }));
  });
  COMPONENTS.forEach((component) => {
    const total = stableSum(rules.filter((rule) => rule.component === component).map((rule) => rule.share));
    if (Math.abs(total - 1) > 1e-9) throw new Error(`Finanzierungsanteile für ${component} müssen exakt 1 ergeben; gefunden ${total}.`);
  });
  return rules as Sgb2FinancingRule[];
}

function summarize(
  units: Sgb2BenefitUnit[],
  claims: ReturnType<typeof calculateSgb2BenefitUnitClaim>[],
  housingResults: ReturnType<typeof calculateSgb2HousingCosts>[],
  reference: Sgb2ScenarioReference,
): PreviewSummary {
  const settlements = buildSgb2MonthlySettlements(units, claims, housingResults);
  const components = COMPONENTS.map((id) => ({
    id,
    paymentCents: Math.round(stableSum(settlements.map((settlement) => {
      const component = settlement.components.find((item) => item.component === id);
      return (component?.paymentCents ?? 0) * settlement.weight;
    }))),
  }));
  const rules = financingRules(reference);
  const payerExact = new Map<string, number[]>();
  rules.forEach((rule) => {
    const component = components.find((item) => item.id === rule.component)!;
    const values = payerExact.get(rule.payer) ?? [];
    values.push(component.paymentCents * rule.share);
    payerExact.set(rule.payer, values);
  });
  const months = unique(settlements.map((item) => item.month));
  return {
    periodFrom: months[0],
    periodTo: months[months.length - 1],
    paymentCents: Math.round(stableSum(settlements.map((item) => item.paymentCents * item.weight))),
    weightedPaymentMonths: stableSum(settlements.filter((item) => item.paymentActive).map((item) => item.weight)),
    components,
    payers: [...payerExact.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([payer, values]) => ({ payer, paymentCents: Math.round(stableSum(values)) })),
    sourceIds: unique([...settlements.flatMap((item) => item.sourceIds), ...rules.map((rule) => rule.sourceId)]),
    uncertaintyClass: housingResults.some((item) => item.uncertaintyClass === "hoch") ? "hoch" : "mittel",
    limitations: unique([
      ...settlements.flatMap((item) => item.limitations),
      "Einkommensdeckung und Leistungsminderungen werden für die Komponentenberichterstattung proportional mit stabiler Restcent-Regel verteilt; der Gesamtanspruch selbst wird davon nicht verändert.",
      "Die Nettofinanzierung der Unterkunft und Heizung nutzt ohne landesspezifischen Override eine offen ausgewiesene bundesweite Modellquote von 70 Prozent Bund und 30 Prozent kommunaler Träger.",
      "Referenzabweichungen werden ausgewiesen, aber niemals durch eine freie Kalibrier- oder Restgröße in das Modellergebnis zurückgeschrieben.",
    ]),
  };
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

  const baseline = summarize(sortedUnits, baselineClaims, baselineHousing, baselineReference);
  const scenario = summarize(sortedUnits, scenarioClaims, scenarioHousing, scenarioReference);
  const components = scenario.components.map((component) => {
    const baselineComponent = baseline.components.find((item) => item.id === component.id);
    return {
      id: component.id,
      label: component.id === "standard-need" ? "Regelbedarf" : component.id === "additional-need" ? "Mehrbedarfe" : component.id === "accommodation" ? "Unterkunft" : "Heizung",
      baselineCents: baselineComponent?.paymentCents ?? 0,
      scenarioCents: component.paymentCents,
      deltaCents: component.paymentCents - (baselineComponent?.paymentCents ?? 0),
    };
  });
  const affectedBenefitUnits = sortedUnits.filter((unit) => affectedUnits.has(unit.id)).reduce((sum, unit) => sum + unit.weight, 0);
  const affectedPersons = profiles.filter((profile) => affectedUnits.has(profile.benefitUnitId)).reduce((sum, profile) => sum + profile.weight, 0);

  return {
    runId,
    periodFrom: scenario.periodFrom,
    periodTo: scenario.periodTo,
    baselinePaymentCents: baseline.paymentCents,
    scenarioPaymentCents: scenario.paymentCents,
    deltaPaymentCents: scenario.paymentCents - baseline.paymentCents,
    affectedBenefitUnits,
    affectedPersons,
    weightedPaymentMonths: scenario.weightedPaymentMonths,
    components,
    payers: scenario.payers.map(({ payer, paymentCents }) => ({
      payer,
      label: payer === "bund" ? "Bund" : payer === "kommunaler-traeger" ? "Kommunale Träger" : payer,
      scenarioCents: paymentCents,
    })),
    calibrationAdjustmentCents: 0,
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
