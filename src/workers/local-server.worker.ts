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
const DB_VERSION = 4;
const SOURCES = "sources";
const METRICS = "metrics";
const SCENARIOS = "scenarios";
const DRAFTS = "drafts";
const ACTIVE_DRAFT_ID = "active";

const seedSources: SourceRecord[] = [
  {
    id: "source-est",
    title: "Einkommensteuertarif 2026 nach § 32a EStG",
    institution: "Bundesministerium der Finanzen",
    url: "https://www.bmf-steuerrechner.de/ekst/eingabeformekst.xhtml",
    dataYear: 2026,
    legalYear: 2026,
    status: "amtlich",
    confidence: "hoch",
    summary: "Amtliche Tarifformeln und Prüfmöglichkeit für die tarifliche Einkommensteuer 2026.",
    method: "Stückweise Berechnung nach § 32a EStG; das zu versteuernde Einkommen und die tarifliche Steuer werden auf volle Euro abgerundet. Bei Zusammenveranlagung wird das Splittingverfahren angewendet.",
    limitations: ["Erfasst nur die tarifliche Einkommensteuer.", "Solidaritätszuschlag, Kirchensteuer, Sozialabgaben und individuelle Abzüge sind nicht Bestandteil des Moduls."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-income-reference",
    title: "Kalibrierte Referenzpopulation Einkommensteuer",
    institution: "DE-SIM Projekt",
    url: "https://kevni92.github.io/de-sim-docs/",
    dataYear: 2025,
    legalYear: 2026,
    status: "modell",
    confidence: "mittel",
    summary: "Gewichtete Referenzpopulation mit zehn Dezilen und fünf Einkommenspunkten je Dezil für Aufkommens- und Verteilungsrechnungen.",
    method: "50 Zellen werden auf 42 Millionen Steuerfälle skaliert und so kalibriert, dass die gesetzliche Baseline ein Aufkommen von 358,2 Mrd. Euro reproduziert.",
    limitations: ["Keine synthetische Mikrobevölkerung mit Einzelfallmerkmalen.", "Verteilung, Familienstruktur und Kinderzahl sind vereinfachte Referenzannahmen."],
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
    limitations: ["Werte in der Anwendung sind gerundet.", "Zeitliche Abgrenzungen können zwischen Teilhaushalten variieren."],
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
    method: "Deterministische Tarifrechnung, gewichtete Aggregation und getrennte Verhaltenskomponente.",
    limitations: ["Noch keine repräsentative Mikrosimulation.", "Verhaltensreaktionen sind Elastizitätsannahmen und keine Prognose."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-assumptions",
    title: "Annahmen für noch nicht angebundene Module",
    institution: "DE-SIM Projekt",
    url: "https://kevni92.github.io/de-sim-docs/",
    dataYear: 2025,
    legalYear: 2026,
    status: "annahme",
    confidence: "niedrig",
    summary: "Explizit gekennzeichnete Annahmen für Bereiche ohne fachlich kalibriertes Modell.",
    method: "Beispielwerte ausschließlich zur Erprobung von Interaktion und Darstellung.",
    limitations: ["Nicht für politische Schlussfolgerungen geeignet.", "Wird durch fachlich geprüfte Daten ersetzt."],
    checkedAt: "2026-07-13",
  },
];

const sharedChangeLog = [
  { date: "2026-07-13", version: "0.4.0", note: "Gesetzlichen Einkommensteuertarif 2026, Referenzpopulation und getrennte Verhaltenskomponente eingeführt." },
  { date: "2026-07-13", version: "0.3.0", note: "Transparenzregister und versionierten Rechenweg ergänzt." },
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
      { name: "Baseline der Einnahmeposten", value: "gerundete Aggregate", sourceId: "source-budget" },
      { name: "Einkommensteuer", value: "Ergebnis des ESt-Moduls", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Baseline laden", expression: "R₀ = Σ statusQuoᵢ" },
      { label: "Szenario anwenden", expression: "R₁ = R₀ + ΔESt" },
    ],
    uncertainty: { kind: "band", lowerPercent: -8, upperPercent: 8, description: "Kombination aus gerundeten Haushaltswerten und Modellunsicherheit." },
    limitations: ["Kategorien sind verdichtet.", "Noch keine vollständige periodengerechte Gesamtrechnung."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-total-expense",
    label: "Gesamtausgaben",
    category: "Staatshaushalt",
    description: "Summe der ausgewiesenen direkten Ausgabenblöcke.",
    unit: "Mrd. € pro Jahr",
    status: "amtlich",
    confidence: "hoch",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-budget"],
    formula: "Ausgaben = Σ Ausgabenpostenᵢ",
    parameters: [{ name: "Ausgabenblöcke", value: "verdichtete Ausgangswerte", sourceId: "source-budget" }],
    calculation: [{ label: "Summieren", expression: "A = Σ ausgabeᵢ" }],
    uncertainty: { kind: "band", lowerPercent: -3, upperPercent: 3, description: "Rundungs- und Abgrenzungsband." },
    limitations: ["Nicht alle Ausgabenarten werden einzeln dargestellt."],
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
    calculation: [{ label: "Differenz bilden", expression: "S = R − A" }],
    uncertainty: { kind: "band", lowerPercent: -12, upperPercent: 12, description: "Kombinierte Bandbreite der Eingangsgrößen." },
    limitations: ["Keine dynamische Zins- oder Konjunkturrückkopplung."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-public-debt",
    label: "Öffentlicher Schuldenstand",
    category: "Staatshaushalt",
    description: "Gerundeter Schuldenstand als Ausgangswert der Darstellung.",
    unit: "Mrd. €",
    status: "amtlich",
    confidence: "hoch",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-debt"],
    formula: "Schuldenstand₁ = Ausgangswert + max(0, −ΔSaldo)",
    parameters: [{ name: "Ausgangswert", value: "2.634,0 Mrd. €", sourceId: "source-debt" }],
    calculation: [{ label: "Szenarioeffekt", expression: "D₁ = D₀ + max(0, −ΔS)" }],
    uncertainty: { kind: "band", lowerPercent: -4, upperPercent: 4, description: "Vereinfachtes Band für Stichtag und Abgrenzung." },
    limitations: ["Keine Laufzeiten- und Zinsstruktur."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-public-budget-lines",
    label: "Einzelposten des Staatshaushalts",
    category: "Staatshaushalt",
    description: "Gerundete Einnahmen- oder Ausgabenposition aus dem konsolidierten Haushalt.",
    unit: "Mrd. € pro Jahr",
    status: "amtlich",
    confidence: "hoch",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-budget"],
    formula: "Szenariowertᵢ = Baselineᵢ + Änderungᵢ",
    parameters: [{ name: "Baseline", value: "positionsspezifischer Ausgangswert", sourceId: "source-budget" }],
    calculation: [{ label: "Änderung anwenden", expression: "wertᵢ = statusQuoᵢ + Δᵢ" }],
    uncertainty: { kind: "band", lowerPercent: -5, upperPercent: 5, description: "Rundungs- und Abgrenzungsband." },
    limitations: ["Unterpositionen sind noch nicht einzeln abrufbar."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-income-tax-revenue",
    label: "Aufkommen der Einkommensteuer",
    category: "Einkommensteuer",
    description: "Kalibriertes jährliches Einkommensteueraufkommen unter den Parametern des aktiven Szenarios.",
    unit: "Mrd. € pro Jahr",
    status: "modell",
    confidence: "mittel",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-est", "source-income-reference", "source-model"],
    formula: "Aufkommen = Kalibrierungsfaktor × Σ Gewichtᵢ × tarifliche Steuerᵢ",
    parameters: [
      { name: "Gesetzliche Baseline", value: "§ 32a EStG 2026", sourceId: "source-est" },
      { name: "Referenzpopulation", value: "50 Zellen · 42 Mio. Steuerfälle", sourceId: "source-income-reference" },
      { name: "Baseline-Aufkommen", value: "358,2 Mrd. €", sourceId: "source-budget" },
      { name: "Verhaltenselastizität", value: "0 statisch · 0,15 Verhalten · 0,30 langfristig", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Gesetzliche Steuer", expression: "T₀ᵢ = §32a-Formel 2026(zvEᵢ)" },
      { label: "Reformsteuer", expression: "T₁ᵢ = ReformedTariff(zvEᵢ, Parameter)" },
      { label: "Kalibrieren", expression: "k = 358,2 / Σ GewichtᵢT₀ᵢ" },
      { label: "Statisch aggregieren", expression: "Rₛ = k × Σ GewichtᵢT₁ᵢ" },
      { label: "Verhalten anwenden", expression: "zvE'ᵢ = zvEᵢ × [1 + ε × ΔNettosatzᵢ]" },
      { label: "Ergebnis", expression: "R = k × Σ GewichtᵢT₁(zvE'ᵢ)" },
    ],
    uncertainty: { kind: "band", lowerPercent: -20, upperPercent: 20, description: "Bandbreite für Referenzpopulation, Kalibrierung und Verhaltensannahmen." },
    limitations: ["Keine repräsentative Mikrosimulation.", "Keine Günstigerprüfung mit Kindergeld.", "Soli, Kirchensteuer und Sozialabgaben sind nicht enthalten."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-income-tax-tariff",
    label: "Tarifkurve der Einkommensteuer",
    category: "Einkommensteuer",
    description: "Gesetzlicher Grenzsteuersatz 2026 und parametrisches Reformszenario entlang des zu versteuernden Einkommens.",
    unit: "% Grenzsteuersatz",
    status: "modell",
    confidence: "hoch",
    dataYear: 2026,
    legalYear: 2026,
    sourceIds: ["source-est", "source-model"],
    formula: "Baseline: §32a EStG 2026; Reform: stetige stückweise Progression aus Freibetrag, Sätzen und Schwellen",
    parameters: [
      { name: "Grundfreibetrag gesetzlich", value: "12.348 €", sourceId: "source-est" },
      { name: "Beginn 42 %", value: "69.879 €", sourceId: "source-est" },
      { name: "Beginn 45 %", value: "277.826 €", sourceId: "source-est" },
    ],
    calculation: [
      { label: "Abrunden", expression: "zvE = floor(zvE in Euro)" },
      { label: "Tarifzone bestimmen", expression: "0; Progressionszone 1; Progressionszone 2; 42 %; 45 %" },
      { label: "Splitting", expression: "Tjoint(zvE) = 2 × Tsingle(floor(zvE/2))" },
    ],
    uncertainty: { kind: "not-applicable", description: "Die gesetzliche Baseline folgt deterministisch der veröffentlichten Tarifformel. Modellunsicherheit betrifft Aggregation und Verhalten." },
    limitations: ["Das Reformszenario verwendet eine stetige parametrisierte Progression und ist kein Gesetzestext."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-income-tax-distribution",
    label: "Verteilungswirkung der Einkommensteuer",
    category: "Haushalte und Verteilung",
    description: "Gewichtete monatliche Tarifwirkung nach Einkommensdezilen sowie Zahl der Gewinner und Verlierer.",
    unit: "€ pro Steuerfall und Monat",
    status: "modell",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-est", "source-income-reference", "source-model"],
    formula: "Monatswirkungᵢ = (Steuer Baselineᵢ − Steuer Reformᵢ) / 12",
    parameters: [
      { name: "Dezile", value: "10 × 5 gewichtete Referenzpunkte", sourceId: "source-income-reference" },
      { name: "Gewinnergrenze", value: "> 1 € pro Monat", sourceId: "source-model" },
      { name: "Verlierergrenze", value: "< −1 € pro Monat", sourceId: "source-model" },
    ],
    calculation: [
      { label: "Steuerfälle berechnen", expression: "Δᵢ = (T₀ᵢ − T₁ᵢ) / 12" },
      { label: "Dezile aggregieren", expression: "Δd = Σ GewichtᵢΔᵢ / Σ Gewichtᵢ" },
      { label: "Gewinner zählen", expression: "Σ Gewichtᵢ für Δᵢ > 1" },
    ],
    uncertainty: { kind: "band", lowerPercent: -35, upperPercent: 35, description: "Breites Band bis zur Einführung einer synthetischen Bevölkerung." },
    limitations: ["Vereinfachte Verteilung statt Mikrodaten.", "Transfers und Sozialbeiträge sind nicht gekoppelt."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-household-examples",
    label: "Wirkung auf Referenzhaushalte",
    category: "Haushalte und Verteilung",
    description: "Direkter Tarifvergleich für vier illustrative Haushaltstypen.",
    unit: "€ pro Monat",
    status: "modell",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-est", "source-model"],
    formula: "Monatswirkung = (Tarifsteuer gesetzlich − Tarifsteuer Reform) / 12",
    parameters: [{ name: "Profile", value: "Single, Alleinerziehend, Familie, Hoheinkommen", sourceId: "source-model" }],
    calculation: [
      { label: "Profil laden", expression: "zvE, Familienstand, Kinder" },
      { label: "Tarife vergleichen", expression: "Δ = (T₀ − T₁) / 12" },
    ],
    uncertainty: { kind: "not-applicable", description: "Die Werte sind deterministisch für die ausgewählten Profile; die Auswahl selbst ist nicht repräsentativ." },
    limitations: ["Nicht repräsentativ.", "Keine individuelle Steuerberatung.", "Keine Günstigerprüfung mit Kindergeld."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-regional-effects",
    label: "Regionale Szenariowirkung",
    category: "Regionen",
    description: "Platzhalter für eine spätere regionale Auswertung.",
    unit: "noch nicht berechnet",
    status: "unbekannt",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-assumptions"],
    formula: "noch nicht implementiert",
    parameters: [{ name: "Regionaldaten", value: "fehlen", sourceId: "source-assumptions" }],
    calculation: [{ label: "Status", expression: "keine Berechnung" }],
    uncertainty: { kind: "not-applicable", description: "Ohne Berechnung kann kein Unsicherheitsband angegeben werden." },
    limitations: ["Keine regionalen Ergebnisse interpretieren."],
    changeLog: sharedChangeLog,
  },
  {
    id: "metric-time-path",
    label: "Zeitverlauf der Budgetwirkung",
    category: "Zeitverlauf",
    description: "Schematische Fortschreibung der jährlichen Budgetwirkung.",
    unit: "Mrd. € pro Jahr",
    status: "annahme",
    confidence: "niedrig",
    dataYear: 2025,
    legalYear: 2026,
    sourceIds: ["source-model", "source-assumptions"],
    formula: "Δₜ = Δ₀ × (1 + 0,02 × t)",
    parameters: [{ name: "jährlicher Darstellungsfaktor", value: "2 %", sourceId: "source-assumptions" }],
    calculation: [{ label: "Fortschreiben", expression: "Δₜ = Δ₀ × (1 + 0,02t)" }],
    uncertainty: { kind: "band", lowerPercent: -40, upperPercent: 40, description: "Keine makroökonomische Prognose." },
    limitations: ["Keine Inflation, Konjunktur oder Demografie."],
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
    uncertainty: { kind: "band", lowerPercent: -45, upperPercent: 45, description: "Breites Band für ungeklärte Abgrenzung und Datenbasis." },
    limitations: ["Keine pauschale Netto-Kostenbehauptung.", "Werte sind weiterhin Demonstrationsannahmen."],
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
