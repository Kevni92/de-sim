import {
  BASELINE_CHILD_ALLOWANCE,
  BASELINE_INCOME_TAX_REVENUE_BN,
  calculateReformIncomeTax,
  calculateStatutoryIncomeTax2026,
  estimateIncomeTaxRevenue,
  type IncomeTaxDecileResult,
  type IncomeTaxResult,
} from "./income-tax";
import type {
  AgeGroup,
  CalibrationEntry,
  CommunityType,
  EmploymentStatus,
  HouseholdRole,
  HouseholdType,
  HousingStatus,
  ModelLevel,
  PopulationDistributionItem,
  PopulationGenerationOptions,
  PopulationQuery,
  PopulationQueryResult,
  PopulationRun,
  PopulationRunMetadata,
  PopulationSummary,
  PopulationValidationIssue,
  SyntheticHousehold,
  SyntheticPerson,
  WorkTimeStatus,
  IncomeTaxSettings,
} from "./types";

export const POPULATION_SCHEMA_VERSION = 1;
export const POPULATION_MODEL_VERSION = "synthetic-population-0.7.0";
export const DEFAULT_POPULATION_SAMPLE_SIZE = 10_000;
export const DEFAULT_POPULATION_SEED = "de-sim-2025";
export const DEFAULT_BASELINE_ID = "de-2024-2025-v1";
export const TARGET_POPULATION = 83_517_000;
export const TARGET_HOUSEHOLDS = 41_300_000;

export const populationSources = [
  {
    id: "source-population-destatis",
    title: "Bevölkerung nach Altersgruppen 2024",
    institution: "Statistisches Bundesamt",
    url: "https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Bevoelkerung/Bevoelkerungsstand/Tabellen/bevoelkerung-altersgruppen-deutschland-absulut-basis-2022.html",
    dataYear: 2024,
    legalYear: 2026,
    status: "amtlich" as const,
    confidence: "hoch" as const,
    summary: "Amtliche Randverteilung der Bevölkerung nach Altersgruppen und Bevölkerungsstand.",
    method: "Kalibrierungsziele werden als gerundete Anteile in die synthetische Baseline übernommen.",
    limitations: ["Gemeinsame Verteilungen werden modelliert.", "Keine amtlichen Einzeldaten werden übernommen."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-population-microcensus",
    title: "Mikrozensus 2024: Haushalte, Erwerbstätigkeit und Wohnen",
    institution: "Statistisches Bundesamt",
    url: "https://www.destatis.de/DE/Themen/Arbeit/Arbeitsmarkt/Erwerbstaetigkeit/_inhalt.html",
    dataYear: 2024,
    legalYear: 2026,
    status: "amtlich" as const,
    confidence: "hoch" as const,
    summary: "Randverteilungen zu Haushaltsformen, Erwerbsstatus und Wohnverhältnissen.",
    method: "Verdichtete Zielanteile für Raking; Abhängigkeiten zwischen Merkmalen werden synthetisch modelliert.",
    limitations: ["Teilweise gerundete Projektbaseline.", "Keine Reproduktion des Mikrozensus-Mikrodatensatzes."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-population-phf",
    title: "Private Haushalte und ihre Finanzen 2023",
    institution: "Deutsche Bundesbank",
    url: "https://www.bundesbank.de/de/bundesbank/forschung/studie-zur-wirtschaftlichen-lage-privater-haushalte-phf/ergebnisse-604886",
    dataYear: 2023,
    legalYear: 2026,
    status: "modell" as const,
    confidence: "mittel" as const,
    summary: "Ausgangspunkt für die vorsichtig modellierte Verteilung von Vermögen und Schulden.",
    method: "Parametrische synthetische Verteilung mit Eigentums-, Alters- und Einkommenszusammenhang.",
    limitations: ["Vermögenswerte sind keine amtlichen Einzelwerte.", "Obere Vermögensränder sind in Befragungen besonders unsicher."],
    checkedAt: "2026-07-13",
  },
  {
    id: "source-population-model",
    title: "Synthetischer Bevölkerungs- und Kalibrierungskern",
    institution: "HaushaltsKompass",
    url: "https://kevni92.github.io/de-sim-docs/",
    dataYear: 2025,
    legalYear: 2026,
    status: "modell" as const,
    confidence: "mittel" as const,
    summary: "Deterministische Erzeugung, Raking, Validierung und gewichtete Aggregation vollständig synthetischer Personen und Haushalte.",
    method: "Seed-basierter PRNG, regelbasierte gemeinsame Verteilung und iteratives proportionales Anpassen.",
    limitations: ["Keine kausale Prognose.", "Keine Regionalisierung unterhalb von Bundesland und Gemeindetyp.", "Gemeinsame Verteilungen bleiben Modellannahmen."],
    checkedAt: "2026-07-13",
  },
];

const STATE_TARGETS: Record<string, number> = {
  "Nordrhein-Westfalen": 0.217, Bayern: 0.160, "Baden-Württemberg": 0.134, Niedersachsen: 0.098,
  Hessen: 0.076, Rheinland-Pfalz: 0.050, Sachsen: 0.049, Berlin: 0.046, "Schleswig-Holstein": 0.036,
  Brandenburg: 0.031, "Sachsen-Anhalt": 0.026, Thüringen: 0.025, Hamburg: 0.023, Mecklenburg-Vorpommern: 0.019,
  Saarland: 0.012, Bremen: 0.008,
};
const HOUSEHOLD_TARGETS: Record<HouseholdType, number> = {
  alleinlebend: 0.414, "paar-ohne-kinder": 0.245, "paar-mit-kindern": 0.166,
  alleinerziehend: 0.055, mehrpersonen: 0.045, rentnerhaushalt: 0.075,
};
const AGE_TARGETS: Record<AgeGroup, number> = { "0-17": 0.184, "18-29": 0.139, "30-44": 0.185, "45-64": 0.276, "65-79": 0.154, "80+": 0.062 };
const EMPLOYMENT_TARGETS: Record<EmploymentStatus, number> = { erwerbstaetig: 0.548, arbeitslos: 0.021, rente: 0.226, bildung: 0.111, "nicht-erwerbstaetig": 0.094 };
const COMMUNITY_TARGETS: Record<CommunityType, number> = { grossstadt: 0.329, staedtisch: 0.376, laendlich: 0.295 };
const HOUSING_TARGETS: Record<HousingStatus, number> = { miete: 0.54, eigentum: 0.46 };
const SIZE_TARGETS = { "1": 0.414, "2": 0.338, "3": 0.119, "4+": 0.129 };
const CHILD_TARGETS = { "0": 0.70, "1": 0.14, "2": 0.12, "3+": 0.04 };

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDeterministicRandom(seed: string) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends string>(random: () => number, weights: Record<T, number>): T {
  const threshold = random();
  let cumulative = 0;
  for (const [key, weight] of Object.entries(weights) as Array<[T, number]>) {
    cumulative += weight;
    if (threshold <= cumulative) return key;
  }
  return Object.keys(weights).at(-1) as T;
}
function normal(random: () => number) { return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random()); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function ageGroup(age: number): AgeGroup { return age < 18 ? "0-17" : age < 30 ? "18-29" : age < 45 ? "30-44" : age < 65 ? "45-64" : age < 80 ? "65-79" : "80+"; }
function sizeGroup(size: number) { return size >= 4 ? "4+" : String(size); }
function childGroup(children: number) { return children >= 3 ? "3+" : String(children); }

function householdShape(type: HouseholdType, random: () => number) {
  if (type === "alleinlebend") return { adults: 1, children: 0 };
  if (type === "paar-ohne-kinder") return { adults: 2, children: 0 };
  if (type === "paar-mit-kindern") return { adults: 2, children: random() < 0.16 ? 3 : random() < 0.58 ? 2 : 1 };
  if (type === "alleinerziehend") return { adults: 1, children: random() < 0.18 ? 3 : random() < 0.58 ? 2 : 1 };
  if (type === "rentnerhaushalt") return { adults: random() < 0.48 ? 1 : 2, children: 0 };
  return { adults: random() < 0.7 ? 2 : 3, children: random() < 0.5 ? 0 : 1 };
}

function employmentForAge(age: number, random: () => number): EmploymentStatus {
  if (age < 18) return "bildung";
  if (age < 25 && random() < 0.55) return "bildung";
  if (age >= 67) return random() < 0.92 ? "rente" : "erwerbstaetig";
  const draw = random();
  if (draw < 0.78) return "erwerbstaetig";
  if (draw < 0.82) return "arbeitslos";
  return "nicht-erwerbstaetig";
}
function workTime(status: EmploymentStatus, random: () => number): WorkTimeStatus {
  if (status !== "erwerbstaetig") return "nicht-zutreffend";
  return random() < 0.68 ? "vollzeit" : random() < 0.82 ? "teilzeit" : "geringfuegig";
}
function adultAge(type: HouseholdType, random: () => number) {
  if (type === "rentnerhaushalt") return Math.round(clamp(72 + normal(random) * 8, 60, 96));
  return Math.round(clamp(43 + normal(random) * 14, 18, 84));
}
function annualIncome(age: number, employment: EmploymentStatus, time: WorkTimeStatus, random: () => number) {
  if (employment === "rente") return { employment: 0, pension: Math.round(clamp(Math.exp(9.8 + normal(random) * 0.45), 5_000, 80_000)), other: Math.round(Math.max(0, normal(random) * 1_500)) };
  if (employment !== "erwerbstaetig") return { employment: 0, pension: 0, other: Math.round(Math.max(0, normal(random) * 600)) };
  const ageFactor = age < 30 ? 0.78 : age > 60 ? 0.92 : 1;
  const timeFactor = time === "vollzeit" ? 1 : time === "teilzeit" ? 0.58 : 0.22;
  const employment = Math.round(clamp(Math.exp(10.65 + normal(random) * 0.55) * ageFactor * timeFactor, 2_000, 420_000));
  return { employment, pension: 0, other: Math.round(Math.max(0, Math.exp(7.2 + normal(random) * 1.0) - 1_300)) };
}

interface Weighted { weight: number; }
interface RakeDimension<T> { categories: Record<string, number>; key: (item: T) => string; }
function rake<T extends Weighted>(items: T[], total: number, dimensions: Array<RakeDimension<T>>) {
  const initial = total / Math.max(items.length, 1);
  items.forEach((item) => { item.weight = initial; });
  for (let iteration = 0; iteration < 24; iteration += 1) {
    dimensions.forEach((dimension) => {
      Object.entries(dimension.categories).forEach(([category, share]) => {
        const members = items.filter((item) => dimension.key(item) === category);
        const actual = members.reduce((sum, item) => sum + item.weight, 0);
        if (!members.length || actual <= 0) return;
        const factor = (share * total) / actual;
        members.forEach((item) => { item.weight *= factor; });
      });
    });
  }
  const sum = items.reduce((result, item) => result + item.weight, 0);
  const factor = total / Math.max(sum, 1);
  items.forEach((item) => { item.weight *= factor; });
}

function assignIncomeDeciles(persons: SyntheticPerson[]) {
  const adults = persons.filter((person) => person.age >= 18).sort((a, b) => a.taxableIncome - b.taxableIncome || a.id.localeCompare(b.id));
  adults.forEach((person, index) => { person.incomeDecile = Math.min(10, Math.floor(index * 10 / Math.max(adults.length, 1)) + 1); });
  persons.filter((person) => person.age < 18).forEach((person) => { person.incomeDecile = 1; });
}

function createCalibration(
  households: SyntheticHousehold[], persons: SyntheticPerson[], dimensions: Array<{ name: string; sourceId: string; tolerance: number; targets: Record<string, number>; items: Array<{ weight: number }>; key: (item: never) => string }>,
): CalibrationEntry[] {
  return dimensions.flatMap((dimension) => Object.entries(dimension.targets).map(([category, target]) => {
    const total = dimension.items.reduce((sum, item) => sum + item.weight, 0);
    const actual = dimension.items.reduce((sum, item) => sum + (dimension.key(item as never) === category ? item.weight : 0), 0) / Math.max(total, 1);
    const absoluteDeviation = actual - target;
    const relativeDeviation = target === 0 ? 0 : absoluteDeviation / target;
    return {
      id: `${dimension.name}:${category}`,
      dimension: dimension.name,
      category,
      target,
      actual,
      absoluteDeviation,
      relativeDeviation,
      tolerance: dimension.tolerance,
      status: Math.abs(relativeDeviation) <= dimension.tolerance ? "innerhalb-toleranz" : "warnung",
      sourceId: dimension.sourceId,
      unit: "anteil" as const,
    };
  }));
}

function validationIssues(households: SyntheticHousehold[], persons: SyntheticPerson[]) {
  const issues: PopulationValidationIssue[] = [];
  const householdsById = new Map(households.map((household) => [household.id, household]));
  const peopleByHousehold = new Map<string, SyntheticPerson[]>();
  persons.forEach((person) => {
    const group = peopleByHousehold.get(person.householdId) ?? [];
    group.push(person); peopleByHousehold.set(person.householdId, group);
    if (!householdsById.has(person.householdId)) issues.push({ code: "missing-household", severity: "error", entityType: "person", entityId: person.id, message: "Haushaltsreferenz fehlt." });
    if (!Number.isFinite(person.weight) || person.weight <= 0) issues.push({ code: "invalid-person-weight", severity: "error", entityType: "person", entityId: person.id, message: "Personengewicht ist nicht positiv und endlich." });
    if (person.age < 0 || person.age > 110) issues.push({ code: "invalid-age", severity: "error", entityType: "person", entityId: person.id, message: "Alter liegt außerhalb des erlaubten Bereichs." });
    if (person.employmentStatus !== "erwerbstaetig" && person.grossEmploymentIncome > 1_000) issues.push({ code: "income-status", severity: "warning", entityType: "person", entityId: person.id, message: "Erwerbseinkommen passt nicht zum Erwerbsstatus." });
  });
  households.forEach((household) => {
    const members = peopleByHousehold.get(household.id) ?? [];
    const adults = members.filter((person) => person.age >= 18).length;
    const children = members.length - adults;
    if (!Number.isFinite(household.weight) || household.weight <= 0) issues.push({ code: "invalid-household-weight", severity: "error", entityType: "household", entityId: household.id, message: "Haushaltsgewicht ist nicht positiv und endlich." });
    if (adults !== household.adultCount || children !== household.childCount) issues.push({ code: "household-size", severity: "error", entityType: "household", entityId: household.id, message: "Personenzahl stimmt nicht mit dem Haushalt überein." });
    if (household.householdType === "alleinerziehend" && adults !== 1) issues.push({ code: "single-parent-adults", severity: "error", entityType: "household", entityId: household.id, message: "Alleinerziehender Haushalt hat nicht genau eine erwachsene Person." });
    if (household.housingStatus === "eigentum" && household.grossColdRent !== 0) issues.push({ code: "owner-rent", severity: "error", entityType: "household", entityId: household.id, message: "Eigentumshaushalt enthält eine normale Bruttokaltmiete." });
    if (household.wealth < 0 || household.debt < 0) issues.push({ code: "negative-assets", severity: "error", entityType: "household", entityId: household.id, message: "Vermögen oder Schulden sind negativ." });
  });
  return issues;
}

function distribution<T>(items: T[], key: (item: T) => string, weight: (item: T) => number): PopulationDistributionItem[] {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const grouped = new Map<string, number>();
  items.forEach((item) => grouped.set(key(item), (grouped.get(key(item)) ?? 0) + weight(item)));
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "de", { numeric: true })).map(([id, value]) => ({ id, label: id, value, share: value / Math.max(total, 1) }));
}

export function buildPopulationSummary(metadata: PopulationRunMetadata, households: SyntheticHousehold[], persons: SyntheticPerson[], calibration: CalibrationEntry[], validation: PopulationValidationIssue[]): PopulationSummary {
  return {
    runId: metadata.id,
    personCount: persons.length,
    householdCount: households.length,
    weightedPopulation: persons.reduce((sum, person) => sum + person.weight, 0),
    weightedHouseholds: households.reduce((sum, household) => sum + household.weight, 0),
    calibrationStatus: calibration.some((entry) => entry.status === "warnung") ? "warnung" : "innerhalb-toleranz",
    validationErrors: validation.filter((issue) => issue.severity === "error").length,
    validationWarnings: validation.filter((issue) => issue.severity === "warning").length,
    distributions: {
      ageGroup: distribution(persons, (person) => person.ageGroup, (person) => person.weight),
      householdType: distribution(households, (household) => household.householdType, (household) => household.weight),
      employmentStatus: distribution(persons, (person) => person.employmentStatus, (person) => person.weight),
      incomeDecile: distribution(persons.filter((person) => person.age >= 18), (person) => String(person.incomeDecile), (person) => person.weight),
      federalState: distribution(persons, (person) => person.federalState, (person) => person.weight),
      communityType: distribution(households, (household) => household.communityType, (household) => household.weight),
      housingStatus: distribution(households, (household) => household.housingStatus, (household) => household.weight),
    },
  };
}

export function generatePopulation(options: PopulationGenerationOptions): { run: PopulationRun; households: SyntheticHousehold[]; persons: SyntheticPerson[] } {
  const sampleSize = Math.round(clamp(options.sampleSize, 500, 50_000));
  const seed = options.seed.trim() || DEFAULT_POPULATION_SEED;
  const baselineId = options.baselineId || DEFAULT_BASELINE_ID;
  const runId = `population-${hashSeed(`${seed}|${sampleSize}|${baselineId}|${POPULATION_MODEL_VERSION}`).toString(16)}`;
  const random = createDeterministicRandom(`${seed}|${baselineId}|${POPULATION_MODEL_VERSION}`);
  const households: SyntheticHousehold[] = [];
  const persons: SyntheticPerson[] = [];

  while (persons.length < sampleSize) {
    const index = households.length;
    const id = `${runId}-h-${String(index + 1).padStart(6, "0")}`;
    const householdType = pickWeighted(random, HOUSEHOLD_TARGETS);
    const shape = householdShape(householdType, random);
    const federalState = pickWeighted(random, STATE_TARGETS);
    const communityType = pickWeighted(random, COMMUNITY_TARGETS);
    const housingStatus = pickWeighted(random, HOUSING_TARGETS);
    const childAges = Array.from({ length: shape.children }, () => Math.floor(random() * 18)).sort((a, b) => b - a);
    const memberStart = persons.length;

    for (let adultIndex = 0; adultIndex < shape.adults; adultIndex += 1) {
      const age = adultAge(householdType, random);
      const employmentStatus = employmentForAge(age, random);
      const workTimeStatus = workTime(employmentStatus, random);
      const income = annualIncome(age, employmentStatus, workTimeStatus, random);
      const transferIncome = employmentStatus === "arbeitslos" || employmentStatus === "nicht-erwerbstaetig" ? Math.round(7_000 + random() * 8_000) : 0;
      persons.push({
        id: `${runId}-p-${String(persons.length + 1).padStart(7, "0")}`, runId, householdId: id, age, ageGroup: ageGroup(age),
        householdRole: shape.adults === 1 && shape.children === 0 ? "alleinlebend" : shape.children > 0 ? "elternteil" : "partner",
        employmentStatus, workTimeStatus, grossEmploymentIncome: income.employment, otherTaxableIncome: income.other, pensionIncome: income.pension,
        transferIncome, socialInsuranceIncome: income.employment, taxableIncome: Math.round(Math.max(0, income.employment + income.other + income.pension * 0.82 - 2_500)),
        weight: 1, federalState, communityType, incomeDecile: 1,
      });
    }
    childAges.forEach((age) => persons.push({
      id: `${runId}-p-${String(persons.length + 1).padStart(7, "0")}`, runId, householdId: id, age, ageGroup: "0-17", householdRole: "kind",
      employmentStatus: "bildung", workTimeStatus: "nicht-zutreffend", grossEmploymentIncome: 0, otherTaxableIncome: 0, pensionIncome: 0,
      transferIncome: 3_000, socialInsuranceIncome: 0, taxableIncome: 0, weight: 1, federalState, communityType, incomeDecile: 1,
    }));
    const members = persons.slice(memberStart);
    const grossIncome = members.reduce((sum, person) => sum + person.grossEmploymentIncome + person.otherTaxableIncome + person.pensionIncome + person.transferIncome, 0);
    const rentBase = communityType === "grossstadt" ? 13 : communityType === "staedtisch" ? 10 : 8;
    const housingCosts = Math.round((55 + members.length * 24) * rentBase + random() * 180);
    const disposableIncome = Math.round(Math.max(0, grossIncome * 0.78 + members.reduce((sum, person) => sum + person.transferIncome, 0) - housingCosts));
    const ownershipFactor = housingStatus === "eigentum" ? 2.4 : 0.45;
    const wealth = Math.round(Math.max(0, Math.exp(10.8 + normal(random) * 1.25) * ownershipFactor * (grossIncome > 70_000 ? 1.5 : 1)));
    const debt = Math.round(Math.max(0, housingStatus === "eigentum" ? Math.exp(10.1 + normal(random) * 1.0) : Math.exp(7.5 + normal(random) * 1.0)));
    households.push({
      id, runId, householdType, adultCount: shape.adults, childCount: shape.children, childAges,
      employmentConstellation: members.filter((person) => person.employmentStatus === "erwerbstaetig").length >= 2 ? "zwei-erwerbstaetige" : members.some((person) => person.employmentStatus === "erwerbstaetig") ? "eine-erwerbstaetige-person" : householdType === "rentnerhaushalt" ? "rente" : "ohne-erwerbstaetigkeit",
      grossIncome, disposableIncome, transferComponents: { familienleistungen: shape.children * 3_000, grundsicherung: members.reduce((sum, person) => sum + person.transferIncome, 0) },
      housingStatus, grossColdRent: housingStatus === "miete" ? housingCosts : 0, housingCosts, wealth, debt, federalState, communityType, weight: 1,
    });
  }

  assignIncomeDeciles(persons);
  rake(households, TARGET_HOUSEHOLDS, [
    { categories: HOUSEHOLD_TARGETS, key: (item) => item.householdType }, { categories: STATE_TARGETS, key: (item) => item.federalState },
    { categories: COMMUNITY_TARGETS, key: (item) => item.communityType }, { categories: HOUSING_TARGETS, key: (item) => item.housingStatus },
    { categories: SIZE_TARGETS, key: (item) => sizeGroup(item.adultCount + item.childCount) }, { categories: CHILD_TARGETS, key: (item) => childGroup(item.childCount) },
  ]);
  rake(persons, TARGET_POPULATION, [
    { categories: AGE_TARGETS, key: (item) => item.ageGroup }, { categories: EMPLOYMENT_TARGETS, key: (item) => item.employmentStatus },
    { categories: STATE_TARGETS, key: (item) => item.federalState }, { categories: COMMUNITY_TARGETS, key: (item) => item.communityType },
    { categories: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [String(index + 1), 0.1])), key: (item) => String(item.incomeDecile) },
  ]);

  const calibration = createCalibration(households, persons, [
    { name: "Altersgruppen", sourceId: "source-population-destatis", tolerance: 0.015, targets: AGE_TARGETS, items: persons, key: (item: SyntheticPerson) => item.ageGroup },
    { name: "Haushaltstyp", sourceId: "source-population-microcensus", tolerance: 0.02, targets: HOUSEHOLD_TARGETS, items: households, key: (item: SyntheticHousehold) => item.householdType },
    { name: "Haushaltsgröße", sourceId: "source-population-microcensus", tolerance: 0.02, targets: SIZE_TARGETS, items: households, key: (item: SyntheticHousehold) => sizeGroup(item.adultCount + item.childCount) },
    { name: "Erwerbsstatus", sourceId: "source-population-microcensus", tolerance: 0.025, targets: EMPLOYMENT_TARGETS, items: persons, key: (item: SyntheticPerson) => item.employmentStatus },
    { name: "Einkommensdezil", sourceId: "source-population-model", tolerance: 0.03, targets: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [String(index + 1), 0.1])), items: persons.filter((person) => person.age >= 18), key: (item: SyntheticPerson) => String(item.incomeDecile) },
    { name: "Kinderzahl", sourceId: "source-population-microcensus", tolerance: 0.025, targets: CHILD_TARGETS, items: households, key: (item: SyntheticHousehold) => childGroup(item.childCount) },
    { name: "Bundesland", sourceId: "source-population-destatis", tolerance: 0.025, targets: STATE_TARGETS, items: persons, key: (item: SyntheticPerson) => item.federalState },
    { name: "Gemeindetyp", sourceId: "source-population-model", tolerance: 0.03, targets: COMMUNITY_TARGETS, items: households, key: (item: SyntheticHousehold) => item.communityType },
    { name: "Wohnen", sourceId: "source-population-microcensus", tolerance: 0.025, targets: HOUSING_TARGETS, items: households, key: (item: SyntheticHousehold) => item.housingStatus },
  ] as never);
  const validation = validationIssues(households, persons);
  const deviations = calibration.map((entry) => Math.abs(entry.relativeDeviation));
  const metadata: PopulationRunMetadata = {
    id: runId, schemaVersion: POPULATION_SCHEMA_VERSION, modelVersion: POPULATION_MODEL_VERSION, seed, createdAt: new Date().toISOString(),
    dataYear: 2024, legalYear: 2026, baselineId, sourceIds: populationSources.map((source) => source.id), sampleSize: persons.length,
    weightedPopulation: persons.reduce((sum, person) => sum + person.weight, 0), weightedHouseholds: households.reduce((sum, household) => sum + household.weight, 0),
    calibrationMethod: "Iteratives proportionales Anpassen (24 Raking-Iterationen)",
    quality: { maxRelativeDeviation: Math.max(...deviations), meanRelativeDeviation: deviations.reduce((sum, value) => sum + value, 0) / Math.max(deviations.length, 1), status: calibration.some((entry) => entry.status === "warnung") ? "warnung" : "innerhalb-toleranz" },
    limitations: ["Vollständig synthetisch; keine echten Personen oder amtlichen Mikrodaten.", "Gemeinsame Verteilungen und Vermögen sind modelliert.", "Keine kausale Prognose und keine Regionalisierung unterhalb der Bundesländer."], active: true,
  };
  const summary = buildPopulationSummary(metadata, households, persons, calibration, validation);
  return { run: { metadata, summary, calibration, validation }, households, persons };
}

function queryKey(entity: SyntheticPerson | SyntheticHousehold, groupBy: PopulationQuery["groupBy"]): string {
  if (groupBy === "transferReceipt") {
    const transfer = "transferIncome" in entity ? entity.transferIncome : Object.values(entity.transferComponents).reduce((sum, value) => sum + value, 0);
    return transfer > 0 ? "mit-transfer" : "ohne-transfer";
  }
  const value = (entity as unknown as Record<string, unknown>)[groupBy];
  return String(value ?? "unbekannt");
}
function numericField(entity: SyntheticPerson | SyntheticHousehold, field: PopulationQuery["field"]) { return Number((entity as unknown as Record<string, unknown>)[field ?? ""] ?? 0); }
function weightedMedian(values: Array<{ value: number; weight: number }>) {
  const sorted = [...values].sort((a, b) => a.value - b.value); const total = sorted.reduce((sum, item) => sum + item.weight, 0); let cumulative = 0;
  for (const item of sorted) { cumulative += item.weight; if (cumulative >= total / 2) return item.value; }
  return sorted.at(-1)?.value ?? 0;
}
export function queryPopulation(runId: string, persons: SyntheticPerson[], households: SyntheticHousehold[], query: PopulationQuery): PopulationQueryResult {
  const entities = query.entity === "persons" ? persons : households;
  const groups = new Map<string, Array<SyntheticPerson | SyntheticHousehold>>();
  entities.forEach((entity) => { const key = queryKey(entity, query.groupBy); const group = groups.get(key) ?? []; group.push(entity); groups.set(key, group); });
  const totalWeight = entities.reduce((sum, entity) => sum + entity.weight, 0);
  const items = [...groups.entries()].map(([id, group]) => {
    const weight = group.reduce((sum, entity) => sum + entity.weight, 0);
    let value = weight;
    if (query.measure === "share") value = weight / Math.max(totalWeight, 1);
    if (query.measure === "sum") value = group.reduce((sum, entity) => sum + numericField(entity, query.field) * entity.weight, 0);
    if (query.measure === "mean") value = group.reduce((sum, entity) => sum + numericField(entity, query.field) * entity.weight, 0) / Math.max(weight, 1);
    if (query.measure === "median") value = weightedMedian(group.map((entity) => ({ value: numericField(entity, query.field), weight: entity.weight })));
    return { id, label: id, value, share: weight / Math.max(totalWeight, 1) };
  }).sort((a, b) => a.id.localeCompare(b.id, "de", { numeric: true }));
  return { runId, query, items };
}

export function estimatePopulationIncomeTax(run: PopulationRunMetadata, persons: SyntheticPerson[], households: SyntheticHousehold[], settings: IncomeTaxSettings, modelLevel: ModelLevel): IncomeTaxResult {
  const fallback = estimateIncomeTaxRevenue(settings, modelLevel);
  const peopleByHousehold = new Map<string, SyntheticPerson[]>();
  persons.forEach((person) => { const group = peopleByHousehold.get(person.householdId) ?? []; group.push(person); peopleByHousehold.set(person.householdId, group); });
  const units = households.map((household) => {
    const adults = (peopleByHousehold.get(household.id) ?? []).filter((person) => person.age >= 18);
    const income = adults.reduce((sum, person) => sum + person.taxableIncome, 0);
    const joint = adults.length >= 2;
    const baselineTax = calculateStatutoryIncomeTax2026(Math.max(0, income - household.childCount * BASELINE_CHILD_ALLOWANCE), joint);
    const reformTax = calculateReformIncomeTax(settings, Math.max(0, income - household.childCount * settings.childAllowance), joint);
    const monthlyChange = (baselineTax - reformTax) / 12;
    const decile = Math.max(1, Math.round(adults.reduce((sum, person) => sum + person.incomeDecile, 0) / Math.max(adults.length, 1)));
    return { household, baselineTax, reformTax, monthlyChange, decile };
  }).filter((unit) => unit.baselineTax > 0 || unit.reformTax > 0 || unit.household.grossIncome > 0);
  const baselineRawBn = units.reduce((sum, unit) => sum + unit.baselineTax * unit.household.weight / 1_000_000_000, 0);
  const calibrationFactor = BASELINE_INCOME_TAX_REVENUE_BN / Math.max(baselineRawBn, 0.001);
  const staticValue = units.reduce((sum, unit) => sum + unit.reformTax * unit.household.weight / 1_000_000_000, 0) * calibrationFactor;
  const behaviorFactor = fallback.staticValue === 0 ? 1 : fallback.value / fallback.staticValue;
  const value = staticValue * behaviorFactor;
  const totalUnits = units.reduce((sum, unit) => sum + unit.household.weight, 0);
  const winnersM = units.reduce((sum, unit) => sum + (unit.monthlyChange > 1 ? unit.household.weight : 0), 0) / 1_000_000;
  const losersM = units.reduce((sum, unit) => sum + (unit.monthlyChange < -1 ? unit.household.weight : 0), 0) / 1_000_000;
  const neutralM = Math.max(0, totalUnits / 1_000_000 - winnersM - losersM);
  const medianMonthlyChange = weightedMedian(units.map((unit) => ({ value: unit.monthlyChange, weight: unit.household.weight })));
  const averageMonthlyChange = units.reduce((sum, unit) => sum + unit.monthlyChange * unit.household.weight, 0) / Math.max(totalUnits, 1);
  const deciles: IncomeTaxDecileResult[] = Array.from({ length: 10 }, (_, index) => {
    const group = units.filter((unit) => unit.decile === index + 1); const weight = group.reduce((sum, unit) => sum + unit.household.weight, 0);
    const changes = group.map((unit) => unit.monthlyChange);
    return { id: `D${index + 1}`, label: `Dezil ${index + 1}`, representativeIncome: weight ? group.reduce((sum, unit) => sum + unit.household.grossIncome * unit.household.weight, 0) / weight : 0,
      monthlyChange: weight ? group.reduce((sum, unit) => sum + unit.monthlyChange * unit.household.weight, 0) / weight : 0,
      lowerMonthlyChange: changes.length ? Math.min(...changes) : 0, upperMonthlyChange: changes.length ? Math.max(...changes) : 0,
      winnersM: group.reduce((sum, unit) => sum + (unit.monthlyChange > 1 ? unit.household.weight : 0), 0) / 1_000_000,
      losersM: group.reduce((sum, unit) => sum + (unit.monthlyChange < -1 ? unit.household.weight : 0), 0) / 1_000_000 };
  });
  return { ...fallback, baselineValue: BASELINE_INCOME_TAX_REVENUE_BN, staticValue, staticDelta: staticValue - BASELINE_INCOME_TAX_REVENUE_BN, value, delta: value - BASELINE_INCOME_TAX_REVENUE_BN,
    behavioralAdjustment: value - staticValue, winnersM, losersM, neutralM, medianMonthlyChange, averageMonthlyChange, taxUnitsM: totalUnits / 1_000_000, calibrationFactor, deciles,
    populationRunId: run.id, populationSampleSize: run.sampleSize, weightedPopulation: run.weightedPopulation, populationDataYear: run.dataYear, calibrationStatus: run.quality.status };
}
