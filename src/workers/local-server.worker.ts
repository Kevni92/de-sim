import type {
  ActiveScenarioDraft,
  LocalRequest,
  LocalResponse,
  MetricRecord,
  ScenarioState,
  SourceRecord,
} from "../lib/types";

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<LocalRequest>) => void): void;
  postMessage(message: LocalResponse): void;
};

const DB_NAME = "de-sim-local-server";
const DB_VERSION = 3;
const SOURCES = "sources";
const METRICS = "metrics";
const SCENARIOS = "scenarios";
const DRAFTS = "drafts";
const ACTIVE_DRAFT_ID = "active";

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
    summary: "Amtliche Ausgangswerte und Rechtsgrundlagen für Einkommensteuer und Steueraufkommen.",
    method: "Veröffentlichte Aggregate und Tarifparameter werden als Baseline übernommen.",
    limitations: ["Die im Prototyp verwendete Baseline ist gerundet.", "Noch keine vollständige Mikrosimulation."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-budget",
    title: "Öffentlicher Gesamthaushalt",
    institution: "Statistisches Bundesamt",
    url: "https://www.destatis.de/",
    dataYear: 2025,
    legalYear: 2026,
    status: "amtlich",
    confidence: "hoch",
    summary: "Aggregierte Einnahmen und Ausgaben des öffentlichen Gesamthaushalts.",
    method: "Konsolidierte Darstellung von Bund, Ländern, Kommunen und Sozialversicherung.",
    limitations: ["Werte im Demonstrationsmodell sind gerundet.", "Zeitliche Abgrenzungen können zwischen Teilhaushalten variieren."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-debt",
    title: "Öffentliche Verschuldung",
    institution: "Deutsche Bundesbank",
    url: "https://www.bundesbank.de/",
    dataYear: 2025,
    legalYear: 2026,
    status: "amtlich",
    confidence: "hoch",
    summary: "Ausgangspunkt für den dargestellten öffentlichen Schuldenstand.",
    method: "Übernahme eines gerundeten Aggregats für die Demonstrationsoberfläche.",
    limitations: ["Abgrenzung und Stichtag sind im Prototyp vereinfacht."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-model",
    title: "DE-SIM Modellkern und Berechnungslogik",
    institution: "DE-SIM Projekt",
    url: "https://kevni92.github.io/de-sim-docs/",
    dataYear: 2025,
    legalYear: 2026,
    status: "modell",
    confidence: "mittel",
    summary: "Versionierte Modelllogik für abgeleitete Szenariowerte.",
    method: "Deterministische Berechnung aus Szenarioparametern und dokumentierten Baselines.",
    limitations: ["Noch keine kalibrierte Mikrosimulation.", "Verhaltensreaktionen sind derzeit vereinfachte Faktoren."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-assumptions",
    title: "Demonstrationsannahmen für noch nicht angebundene Module",
    institution: "DE-SIM Projekt",
    url: "https://kevni92.github.io/de-sim-docs/",
    dataYear: 2025,
    legalYear: 2026,
    status: "annahme",
    confidence: "niedrig",
    summary: "Explizit gekennzeichnete Annahmen für UI-Bereiche ohne fachlich kalibriertes Modell.",
    method: "Plausible Beispielwerte ausschließlich zur Erprobung von Interaktion und Darstellung.",
    limitations: ["Nicht für politische Schlussfolgerungen geeignet.", "Wird durch fachlich geprüfte Daten ersetzt."],
    checkedAt: "2026-07-13",
  },
];

const sharedChangeLog = [
  { date: "2026-07-13", version: "0.3.0", note: "Transparenzregister und versionierter Rechenweg ergänzt." },
  { date: "2026-07-13", version: "0.2.0", note: "Zentrales Szenariomodell eingeführt." },
];

const seedMetrics: MetricRecord[] = [
  {
    id: "metric-total-revenue",
    label: "Gesamteinnahmen",
    category: "Staatshaushalt",
    description: "Konsolidierte Einnahmen des dargestellten öffentlichen Gesamthaushalts im aktiven Szenario.",
    unit: "Mrd. € pro Jahr",
    status: "modell",
    confidence: "mittel",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-budget", "source-model"],
    formula: "Einnahmen = Σ Einnahmepostenᵢ",
    parameters: [
      { name: "Baseline der Einnahmeposten", value: "gerundete Demonstrationsaggregate", sourceId: "source-budget" },
      { name: "Einkommensteueränderung", value: "aus aktivem Szenario", sourceId: "source-model" },
      { name: "Gegenfinanzierung Kreditaufnahme", value: "− Änderung Einkommensteuer", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Baseline laden", expression: "Σ statusQuoᵢ" },
      { label: "Szenario anwenden", expression: "statusQuoᵢ + Δᵢ" },
      { label: "Konsolidieren", expression: "Σ szenarioWertᵢ", note: "Keine Doppelzählung innerhalb der angezeigten Kategorien." },
    ],
    uncertainty: { kind: "band", lowerPercent: -8, upperPercent: 8, description: "Bandbreite für gerundete Baselines und noch vereinfachte Verhaltensreaktionen." },
    limitations: ["Kategorien sind für die Oberfläche verdichtet.", "Noch keine vollständige periodengerechte Volkswirtschaftliche Gesamtrechnung."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-total-expense",
    label: "Gesamtausgaben",
    category: "Staatshaushalt",
    description: "Summe der in der Oberfläche ausgewiesenen direkten Ausgabenblöcke.",
    unit: "Mrd. € pro Jahr",
    status: "amtlich",
    confidence: "hoch",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-budget"],
    formula: "Ausgaben = Σ Ausgabenpostenᵢ",
    parameters: [{ name: "Ausgabenblöcke", value: "Rente, Gesundheit, Pflege, Familie, Bildung, Verteidigung, Verwaltung", sourceId: "source-budget" }],
    calculation: [
      { label: "Teilaggregate laden", expression: "ausgabeᵢ = statusQuoᵢ" },
      { label: "Summieren", expression: "Σ ausgabeᵢ" },
    ],
    uncertainty: { kind: "band", lowerPercent: -3, upperPercent: 3, description: "Rundungs- und Abgrenzungsband der Demonstrationsaggregate." },
    limitations: ["Nicht alle Ausgabenarten werden einzeln dargestellt.", "Steuervergünstigungen werden separat behandelt."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-budget-balance",
    label: "Budgetsaldo",
    category: "Staatshaushalt",
    description: "Differenz aus konsolidierten Einnahmen und Ausgaben im aktiven Szenario.",
    unit: "Mrd. € pro Jahr",
    status: "modell",
    confidence: "mittel",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-budget", "source-model"],
    formula: "Saldo = Gesamteinnahmen − Gesamtausgaben",
    parameters: [
      { name: "Gesamteinnahmen", value: "metric-total-revenue", sourceId: "source-model" },
      { name: "Gesamtausgaben", value: "metric-total-expense", sourceId: "source-budget" },
    ],
    calculation: [
      { label: "Einnahmen berechnen", expression: "R = Σ Einnahmepostenᵢ" },
      { label: "Ausgaben berechnen", expression: "A = Σ Ausgabenpostenᵢ" },
      { label: "Saldo bilden", expression: "S = R − A" },
    ],
    uncertainty: { kind: "band", lowerPercent: -12, upperPercent: 12, description: "Kombinierte Bandbreite der zugrunde liegenden Einnahmen- und Ausgabenwerte." },
    limitations: ["Keine dynamische Zins- oder Konjunkturrückkopplung.", "Der Saldo ist eine Szenariogröße, keine Prognose."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-public-debt",
    label: "Öffentlicher Schuldenstand",
    category: "Staatshaushalt",
    description: "Gerundeter Schuldenstand als Ausgangswert der Demonstrationsrechnung.",
    unit: "Mrd. €",
    status: "amtlich",
    confidence: "hoch",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-debt"],
    formula: "Schuldenstandₜ = veröffentlichter Ausgangswert + kumulierter Finanzierungsbedarf",
    parameters: [
      { name: "Ausgangswert", value: "2.634,0 Mrd. €", sourceId: "source-debt" },
      { name: "Szenarioeffekt", value: "max(0, −Δ Saldo)", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Ausgangswert", expression: "D₀ = 2.634,0" },
      { label: "Szenarioeffekt", expression: "D₁ = D₀ + max(0, −ΔS)" },
    ],
    uncertainty: { kind: "band", lowerPercent: -4, upperPercent: 4, description: "Vereinfachtes Band für Stichtag, Abgrenzung und Rundung." },
    limitations: ["Keine Laufzeiten- und Zinsstruktur.", "Keine vollständige Fortschreibung über mehrere Haushaltsjahre."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-public-budget-lines",
    label: "Einzelposten des Staatshaushalts",
    category: "Staatshaushalt",
    description: "Gerundete Einnahmen- oder Ausgabenposition aus dem konsolidierten Demonstrationshaushalt.",
    unit: "Mrd. € pro Jahr",
    status: "amtlich",
    confidence: "hoch",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-budget"],
    formula: "Szenariowertᵢ = Baselineᵢ + Änderungᵢ",
    parameters: [{ name: "Baseline", value: "positionsspezifischer Ausgangswert", sourceId: "source-budget" }],
    calculation: [
      { label: "Position auswählen", expression: "i = gewählte Haushaltsposition" },
      { label: "Änderung anwenden", expression: "wertᵢ = statusQuoᵢ + Δᵢ" },
    ],
    uncertainty: { kind: "band", lowerPercent: -5, upperPercent: 5, description: "Rundungs- und Abgrenzungsband für verdichtete Einzelposten." },
    limitations: ["Die Oberfläche zeigt verdichtete Kategorien.", "Unterpositionen sind noch nicht einzeln abrufbar."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-income-tax-revenue",
    label: "Aufkommen der Einkommensteuer",
    category: "Einkommensteuer",
    description: "Geschätztes jährliches Aufkommen der Einkommensteuer unter den Parametern des aktiven Szenarios.",
    unit: "Mrd. € pro Jahr",
    status: "modell",
    confidence: "mittel",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-est", "source-model"],
    formula: "Aufkommen = Baseline + Tarif- und Freibetragseffekte × Modellstufenfaktor",
    parameters: [
      { name: "Grundfreibetrag", value: "aus aktivem Szenario", sourceId: "source-est" },
      { name: "Eingangs- und Spitzensteuersatz", value: "aus aktivem Szenario", sourceId: "source-est" },
      { name: "Tarifschwellen", value: "aus aktivem Szenario", sourceId: "source-est" },
      { name: "Modellstufenfaktor", value: "statisch 1,00 · Verhalten 0,85 · langfristig 0,70", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Baseline", expression: "B = 358,2 Mrd. €" },
      { label: "Tarifeffekt", expression: "T = f(Freibetrag, Sätze, Schwellen, Splitting)" },
      { label: "Modellstufe", expression: "Δ = T × Faktor(Modellstufe)" },
      { label: "Ergebnis", expression: "Aufkommen = B + Δ" },
    ],
    uncertainty: { kind: "band", lowerPercent: -25, upperPercent: 25, description: "Bandbreite für fehlende Mikrodaten und vereinfachte Verhaltensreaktionen." },
    limitations: ["Keine vollständige Abbildung des Steuerrechts.", "Keine repräsentative Mikrosimulation auf Einzelfalldaten.", "Verhaltensfaktoren sind Demonstrationsannahmen."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-income-tax-tariff",
    label: "Tarifkurve der Einkommensteuer",
    category: "Einkommensteuer",
    description: "Grenzsteuersatz entlang des zu versteuernden Einkommens für Baseline und aktives Szenario.",
    unit: "% Grenzsteuersatz",
    status: "modell",
    confidence: "mittel",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-est", "source-model"],
    formula: "s(y) = stückweise Funktion aus Freibetrag, Progression, Spitzen- und Reichensteuersatz",
    parameters: [
      { name: "Zu versteuerndes Einkommen", value: "0 bis 200.000 €" },
      { name: "Tarifparameter", value: "aus aktivem Szenario", sourceId: "source-est" },
    ],
    calculation: [
      { label: "Freibetrag", expression: "s(y)=0 für y≤F" },
      { label: "Progression", expression: "lineare Interpolation zwischen Eingangs- und Spitzensteuersatz" },
      { label: "Obere Zonen", expression: "Spitzensteuersatz; ab 180.000 € Reichensteuersatz" },
    ],
    uncertainty: { kind: "not-applicable", description: "Die Kurve folgt deterministisch den gewählten Parametern; Unsicherheit betrifft die Aufkommenswirkung, nicht die gezeichnete Funktion." },
    limitations: ["Vereinfachte lineare Progression statt vollständiger gesetzlicher Tarifformel."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-income-tax-distribution",
    label: "Verteilungswirkung der Einkommensteuer",
    category: "Haushalte und Verteilung",
    description: "Monatliche Nettowirkung nach Einkommensdezilen sowie Zahl der Gewinner und Verlierer.",
    unit: "€ pro Haushalt und Monat",
    status: "annahme",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-model", "source-assumptions"],
    formula: "Nettowirkung₍d₎ = Steuerlast Baseline₍d₎ − Steuerlast Szenario₍d₎",
    parameters: [
      { name: "Dezilgewichte", value: "Demoverteilung", sourceId: "source-assumptions" },
      { name: "Tarifänderung", value: "aus aktivem Szenario", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Gruppen bilden", expression: "Haushalte → Einkommensdezile D1…D10" },
      { label: "Steuerlast vergleichen", expression: "Δnetto₍d₎ = tax₀₍d₎ − tax₁₍d₎" },
      { label: "Gewinner/Verlierer", expression: "Anzahl nach Vorzeichen von Δnetto" },
    ],
    uncertainty: { kind: "band", lowerPercent: -35, upperPercent: 35, description: "Breites Band, da die synthetische Bevölkerung erst in einem späteren Milestone folgt." },
    limitations: ["Derzeit Beispielverteilung statt synthetischer Bevölkerung.", "Transfers und Sozialbeiträge sind noch nicht vollständig gekoppelt."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-household-examples",
    label: "Wirkung auf Beispielhaushalte",
    category: "Haushalte und Verteilung",
    description: "Anschauliche monatliche Wirkung auf ausgewählte, nicht repräsentative Haushaltstypen.",
    unit: "€ pro Monat",
    status: "annahme",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-model", "source-assumptions"],
    formula: "Nettowirkung = Steuer Szenario − Steuer Baseline je Beispielprofil",
    parameters: [{ name: "Haushaltsprofile", value: "vier illustrative Profile", sourceId: "source-assumptions" }],
    calculation: [
      { label: "Profil laden", expression: "Einkommen, Familienstand, Kinder" },
      { label: "Baseline berechnen", expression: "tax₀(profile)" },
      { label: "Szenario berechnen", expression: "tax₁(profile)" },
      { label: "Monatswert", expression: "(tax₀ − tax₁) / 12" },
    ],
    uncertainty: { kind: "band", lowerPercent: -15, upperPercent: 15, description: "Darstellungsband für vereinfachte Beispielprofile." },
    limitations: ["Nicht repräsentativ.", "Keine individuelle Steuerberatung.", "Nur ausgewählte Merkmale werden berücksichtigt."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-regional-effects",
    label: "Regionale Szenariowirkung",
    category: "Regionen",
    description: "Schematische Darstellung der Wirkung nach ausgewählten Bundesländern.",
    unit: "€ pro Haushalt und Monat",
    status: "annahme",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-assumptions"],
    formula: "Regionale Wirkung = nationale Wirkung × Demonstrationsfaktor Region",
    parameters: [{ name: "Regionalfaktoren", value: "noch nicht fachlich kalibriert", sourceId: "source-assumptions" }],
    calculation: [{ label: "Darstellung", expression: "ΔRegion = ΔNational × FaktorRegion" }],
    uncertainty: { kind: "band", lowerPercent: -50, upperPercent: 50, description: "Sehr hohe Unsicherheit bis zur Anbindung regionaler Mikrodaten." },
    limitations: ["Reine Demonstrationsdarstellung.", "Nicht als regionaler Vergleich interpretieren."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-time-path",
    label: "Zeitverlauf der Budgetwirkung",
    category: "Zeitverlauf",
    description: "Schematische Fortschreibung der jährlichen Budgetwirkung über mehrere Jahre.",
    unit: "Mrd. € pro Jahr",
    status: "annahme",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-model", "source-assumptions"],
    formula: "Δₜ = Δ₀ × (1 + 0,04 × t)",
    parameters: [{ name: "jährlicher Demonstrationsfaktor", value: "4 %", sourceId: "source-assumptions" }],
    calculation: [{ label: "Fortschreiben", expression: "Δₜ = Δ₀ × (1 + 0,04t)" }],
    uncertainty: { kind: "band", lowerPercent: -40, upperPercent: 40, description: "Keine makroökonomische Prognose; nur schematischer Verlauf." },
    limitations: ["Keine Inflation, Konjunktur oder Demografie.", "Kein Barwert und keine Zinsrechnung."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-migration-components",
    label: "Teilbereiche Migration und Asyl",
    category: "Fachliche Themenfelder",
    description: "Getrennte Demonstrationswerte für Unterbringung, Verfahren, Integration und weitere Bereiche.",
    unit: "Mrd. € pro Jahr",
    status: "annahme",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-assumptions", "source-budget"],
    formula: "Gesamt = Unterbringung + Verfahren + Integration + weitere Bereiche",
    parameters: [
      { name: "Unterbringung", value: "9,8 Mrd. €", sourceId: "source-assumptions" },
      { name: "Verfahren", value: "5,1 Mrd. €", sourceId: "source-assumptions" },
      { name: "Integration", value: "4,4 Mrd. €", sourceId: "source-assumptions" },
      { name: "weitere Bereiche", value: "10,5 Mrd. €", sourceId: "source-assumptions" },
    ],
    calculation: [{ label: "Teilbereiche addieren", expression: "9,8 + 5,1 + 4,4 + 10,5 = 29,8" }],
    uncertainty: { kind: "band", lowerPercent: -45, upperPercent: 45, description: "Breites Band, da Abgrenzung und Datenbasis noch nicht fachlich freigegeben sind." },
    limitations: ["Keine pauschale Netto-Kostenbehauptung.", "Einnahmen, Erwerbstätigkeit und langfristige Wirkungen sind noch nicht gekoppelt.", "Werte sind Demonstrationsannahmen."],
    changeLog: sharedChangeLog,
  },
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SOURCES)) db.createObjectStore(SOURCES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(METRICS)) db.createObjectStore(METRICS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SCENARIOS)) db.createObjectStore(SCENARIOS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS, { keyPath: "id" });
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

async function seedReferenceData(db: IDBDatabase) {
  const transaction = db.transaction([SOURCES, METRICS], "readwrite");
  seedSources.forEach((source) => transaction.objectStore(SOURCES).put(source));
  seedMetrics.forEach((metric) => transaction.objectStore(METRICS).put(metric));
  await transactionComplete(transaction);
}

async function handle(request: LocalRequest): Promise<LocalResponse> {
  try {
    const db = await openDb();
    await seedReferenceData(db);

    if (request.type === "sources:list") {
      const data = await requestValue(db.transaction(SOURCES).objectStore(SOURCES).getAll()) as SourceRecord[];
      return { id: request.id, ok: true, data };
    }

    if (request.type === "metrics:list") {
      const data = await requestValue(db.transaction(METRICS).objectStore(METRICS).getAll()) as MetricRecord[];
      data.sort((a, b) => a.category.localeCompare(b.category, "de") || a.label.localeCompare(b.label, "de"));
      return { id: request.id, ok: true, data };
    }

    if (request.type === "scenarios:list") {
      const data = await requestValue(db.transaction(SCENARIOS).objectStore(SCENARIOS).getAll()) as ScenarioState[];
      data.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { id: request.id, ok: true, data };
    }

    if (request.type === "scenarios:save") {
      const transaction = db.transaction(SCENARIOS, "readwrite");
      transaction.objectStore(SCENARIOS).put(request.payload);
      await transactionComplete(transaction);
      return { id: request.id, ok: true, data: request.payload };
    }

    if (request.type === "scenarios:delete") {
      const transaction = db.transaction(SCENARIOS, "readwrite");
      transaction.objectStore(SCENARIOS).delete(request.payload.scenarioId);
      await transactionComplete(transaction);
      return { id: request.id, ok: true, data: null };
    }

    if (request.type === "draft:get") {
      const record = await requestValue(db.transaction(DRAFTS).objectStore(DRAFTS).get(ACTIVE_DRAFT_ID)) as { id: string; payload: ActiveScenarioDraft } | undefined;
      return { id: request.id, ok: true, data: record?.payload ?? null };
    }

    const transaction = db.transaction(DRAFTS, "readwrite");
    transaction.objectStore(DRAFTS).put({ id: ACTIVE_DRAFT_ID, payload: request.payload });
    await transactionComplete(transaction);
    return { id: request.id, ok: true, data: request.payload };
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

workerScope.addEventListener("message", async (event) => {
  workerScope.postMessage(await handle(event.data));
});
