import type { LongTermScenarioSettings } from "./types";

export const LONG_TERM_MODEL_VERSION = "demography-cohort-1.0.0";
export const MAX_AGE = 100;
export const DEMOGRAPHY_BASELINE_SOURCE_ID = "source-population-destatis";
export const DEMOGRAPHY_MODEL_SOURCE_ID = "source-population-model";

export type Sex = "female" | "male";
export type ProjectionStatus = "aktuell" | "veraltet" | "eingaben-ungueltig";
export type ProjectionVariant = "lower" | "central" | "upper";

export interface CohortPopulation {
  female: number[];
  male: number[];
}

export interface DemographyAssumptions {
  fertilityByAge: number[];
  survivalBySex: Record<Sex, number[]>;
  immigrationByAge: number[];
  emigrationByAge: number[];
  label: string;
  dataYear: number;
  legalYear: number;
  sourceIds: string[];
}

export interface DemographyVariantSet {
  lower: DemographyAssumptions;
  central: DemographyAssumptions;
  upper: DemographyAssumptions;
}

export interface ProjectionYear {
  year: number;
  population: number;
  births: number;
  deaths: number;
  immigration: number;
  emigration: number;
  migrationBalance: number;
  children: number;
  workingAge: number;
  retirementAge: number;
  olderPopulation: number;
  youthDependencyRatio: number;
  oldAgeDependencyRatio: number;
  totalDependencyRatio: number;
  byAge: CohortPopulation;
}

export interface DemographyProjectionInput {
  scenarioId: string;
  baseYear: number;
  targetYear: number;
  startPopulation: CohortPopulation;
  baseline: DemographyAssumptions;
  scenario: DemographyAssumptions;
  variants: DemographyVariantSet;
  workingAgeStart: number;
  retirementAge: number;
  modelVersion?: string;
  legalYear: number;
  additionalBirthsByVariant?: Partial<Record<ProjectionVariant, Record<number, number>>>;
}

export interface DemographyProjectionRun {
  id: string;
  scenarioId: string;
  modelVersion: string;
  status: ProjectionStatus;
  baseYear: number;
  targetYear: number;
  dataYear: number;
  legalYear: number;
  inputSignature: string;
  createdAt: string;
  baseline: ProjectionYear[];
  scenario: ProjectionYear[];
  variants: Record<ProjectionVariant, ProjectionYear[]>;
  warnings: string[];
  sourceIds: string[];
}

export interface DemographyValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export type FamilyFertilityEvidenceStatus = "nicht-berechnet" | "gerichteter-zusammenhang" | "szenarioband-berechenbar";

export interface FamilyFertilityEffectInput {
  status: FamilyFertilityEvidenceStatus;
  effectPct: number;
  onsetYears: number;
  durationYears: number;
  baseYear: number;
  targetYear: number;
  annualBirthBaseline: number;
  sourceIds: string[];
  workingAgeStart: number;
}

export interface FamilyFertilityPathPoint {
  year: number;
  status: FamilyFertilityEvidenceStatus;
  direction: "positiv" | "negativ" | "nicht-berechnet";
  additionalBirths: number | null;
  lowerBirths: number | null;
  upperBirths: number | null;
  earliestWorkingAgeYear: number | null;
}

export interface FamilyFertilityPath {
  status: FamilyFertilityEvidenceStatus;
  points: FamilyFertilityPathPoint[];
  additionalBirthsByVariant: Record<ProjectionVariant, Record<number, number>>;
  sourceIds: string[];
  warnings: string[];
}

export interface FamilyReformImpact {
  directBudgetDeltaBn: number;
  familyReliefBn: number;
  fertilityPath: FamilyFertilityPath;
  warnings: string[];
}

export type MigrationAccessPreset = "rechtsstand-des-szenarios" | "vereinfachter-frueher-zugang" | "benutzerdefinierte-wartezeit";
export type MigrationStatus = "im-verfahren" | "noch-nicht-erwerbsberechtigt" | "erwerbsberechtigt" | "beschäftigt" | "qualifizierung";

export interface MigrationPathInput {
  baseYear: number;
  targetYear: number;
  annualArrivals: number;
  protectionSharePct: number;
  ageProfile: number[];
  accessPreset: MigrationAccessPreset;
  accessDelayYears: number;
  participationRatePct: number;
  employmentRatePct: number;
  workTimeFactorPct: number;
  averageAnnualWage: number;
  taxRatePct: number;
  contributionRatePct: number;
  transferRateWhenNotEmployedPct: number;
  workingAgeStart: number;
  retirementAge: number;
  legalYear: number;
  sourceIds: string[];
}

export interface MigrationPathPoint {
  year: number;
  arrivals: number;
  workingAge: number;
  legallyEligible: number;
  participants: number;
  employed: number;
  fullTimeEquivalents: number;
  taxableWageBill: number;
  taxes: number;
  socialContributions: number;
  transferDependent: number;
  statusCounts: Record<MigrationStatus, number>;
}

export interface MigrationPath {
  accessPreset: MigrationAccessPreset;
  legalYear: number;
  legalBasis: string[];
  accessDelayYears: number;
  points: MigrationPathPoint[];
  lower: MigrationPathPoint[];
  upper: MigrationPathPoint[];
  sourceIds: string[];
  warnings: string[];
}

export const migrationLegalBasis = ["asylgesetz-61", "aufenthaltsgesetz-4a"] as const;

export const defaultLongTermScenarioSettings: LongTermScenarioSettings = {
  targetYear: 2070,
  preset: "amtliche-referenz",
  workingAgeStart: 20,
  retirementAge: 67,
  fertilityEffectStatus: "nicht-berechnet",
  fertilityEffectPct: 0,
  migrationNetAnnual: 250_000,
  protectionSharePct: 0,
  accessDelayYears: 1,
  participationRatePct: 78,
  employmentRatePct: 93,
  workTimeFactorPct: 82,
  contributionRatePct: 18.6,
  averageAnnualWage: 48_000,
  pensionBenefitRatePct: 48,
  federalGrantBn: 115,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const cloneArray = (values: number[]) => [...values];

function gaussian(age: number, mean: number, spread: number) {
  return Math.exp(-((age - mean) ** 2) / (2 * spread ** 2));
}

function normalizedProfile(total: number, weight: (age: number) => number) {
  const values = Array.from({ length: MAX_AGE + 1 }, (_, age) => Math.max(0, weight(age)));
  const sum = values.reduce((current, value) => current + value, 0);
  return values.map((value) => total * value / sum);
}

export function cloneCohorts(population: CohortPopulation): CohortPopulation {
  return { female: cloneArray(population.female), male: cloneArray(population.male) };
}

export function createDefaultStartPopulation(baseYear = 2026): CohortPopulation {
  const total = 84_700_000;
  const allAges = normalizedProfile(total, (age) => 0.48 + gaussian(age, 55, 20) + gaussian(age, 30, 13) + gaussian(age, 8, 9));
  return {
    female: allAges.map((value, age) => round(value * (age >= 75 ? 0.535 : 0.505))),
    male: allAges.map((value, age) => round(value * (age >= 75 ? 0.465 : 0.495))),
  };
}

function survivalProfile(sex: Sex) {
  return Array.from({ length: MAX_AGE + 1 }, (_, age) => {
    const mortality = age < 1 ? 0.003 : 0.00025 * Math.exp(age / 22) + (sex === "male" ? 0.00025 : 0);
    return clamp(1 - mortality, age === MAX_AGE ? 0.55 : 0.75, 0.9998);
  });
}

function fertilityProfile(scale = 1) {
  return Array.from({ length: MAX_AGE + 1 }, (_, age) => {
    if (age < 15 || age > 49) return 0;
    const base = 0.006 + 0.041 * gaussian(age, 31, 7);
    return round(base * scale);
  });
}

function migrationProfile(total: number) {
  return normalizedProfile(total, (age) => 0.15 * gaussian(age, 8, 7) + 0.5 * gaussian(age, 29, 10) + 0.2 * gaussian(age, 52, 15) + 0.04);
}

export function createDefaultDemographyAssumptions(label = "Amtliche Referenz · mittlere Variante", migrationScale = 1, fertilityScale = 1): DemographyAssumptions {
  return {
    fertilityByAge: fertilityProfile(fertilityScale),
    survivalBySex: { female: survivalProfile("female"), male: survivalProfile("male") },
    immigrationByAge: migrationProfile(520_000 * migrationScale),
    emigrationByAge: migrationProfile(270_000),
    label,
    dataYear: 2024,
    legalYear: 2026,
    sourceIds: [DEMOGRAPHY_BASELINE_SOURCE_ID, DEMOGRAPHY_MODEL_SOURCE_ID],
  };
}

export function createDefaultVariantSet(): DemographyVariantSet {
  return {
    lower: createDefaultDemographyAssumptions("Amtliche Referenz · untere Variante", 0.72, 0.88),
    central: createDefaultDemographyAssumptions("Amtliche Referenz · mittlere Variante"),
    upper: createDefaultDemographyAssumptions("Amtliche Referenz · obere Variante", 1.28, 1.12),
  };
}

function assumptionsIssues(assumptions: DemographyAssumptions, path: string): DemographyValidationIssue[] {
  const issues: DemographyValidationIssue[] = [];
  for (const [key, values] of Object.entries(assumptions)) {
    if (!["fertilityByAge", "immigrationByAge", "emigrationByAge"].includes(key) && key !== "survivalBySex") continue;
    if (key === "survivalBySex") {
      for (const sex of ["female", "male"] as Sex[]) {
        if (assumptions.survivalBySex[sex].length !== MAX_AGE + 1) issues.push({ code: "array-length", message: "Jede Überlebensreihe muss 101 Alterswerte enthalten.", path: `${path}.survivalBySex.${sex}` });
        if (assumptions.survivalBySex[sex].some((value) => !Number.isFinite(value) || value < 0 || value > 1)) issues.push({ code: "survival-range", message: "Überlebenswahrscheinlichkeiten müssen zwischen 0 und 1 liegen.", path: `${path}.survivalBySex.${sex}` });
      }
      continue;
    }
    const list = values as number[];
    if (list.length !== MAX_AGE + 1) issues.push({ code: "array-length", message: "Altersprofile müssen 101 Alterswerte enthalten.", path: `${path}.${key}` });
    if (list.some((value) => !Number.isFinite(value) || value < 0)) issues.push({ code: "negative-input", message: "Altersprofile dürfen keine negativen oder ungültigen Werte enthalten.", path: `${path}.${key}` });
  }
  return issues;
}

export function validateDemographyInput(input: DemographyProjectionInput): DemographyValidationIssue[] {
  const issues: DemographyValidationIssue[] = [];
  if (!Number.isInteger(input.baseYear) || !Number.isInteger(input.targetYear) || input.targetYear <= input.baseYear) issues.push({ code: "invalid-years", message: "Das Zieljahr muss nach dem Basisjahr liegen.", path: "targetYear" });
  if (input.targetYear > 2100) issues.push({ code: "unsupported-horizon", message: "Projektionen über 2100 hinaus sind in der ersten Ausbaustufe nicht vorgesehen.", path: "targetYear" });
  for (const sex of ["female", "male"] as Sex[]) {
    if (input.startPopulation[sex].length !== MAX_AGE + 1) issues.push({ code: "array-length", message: "Die Startbevölkerung benötigt 101 Alterswerte je Geschlecht.", path: `startPopulation.${sex}` });
    if (input.startPopulation[sex].some((value) => !Number.isFinite(value) || value < 0)) issues.push({ code: "invalid-population", message: "Die Startbevölkerung darf keine negativen oder ungültigen Werte enthalten.", path: `startPopulation.${sex}` });
  }
  if (input.workingAgeStart < 0 || input.workingAgeStart >= input.retirementAge || input.retirementAge > MAX_AGE) issues.push({ code: "invalid-age-boundaries", message: "Erwerbs- und Rentenaltersgrenzen sind inkonsistent.", path: "workingAgeStart" });
  issues.push(...assumptionsIssues(input.baseline, "baseline"), ...assumptionsIssues(input.scenario, "scenario"));
  for (const variant of ["lower", "central", "upper"] as ProjectionVariant[]) issues.push(...assumptionsIssues(input.variants[variant], `variants.${variant}`));
  return issues;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function projectionInputSignature(input: DemographyProjectionInput): string {
  let hash = 2166136261;
  for (const char of stableJson(input)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `demography-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sum(population: CohortPopulation, from = 0, to = MAX_AGE) {
  return population.female.slice(from, to + 1).reduce((total, value, index) => total + value + population.male[from + index], 0);
}

function emptyCohorts(): CohortPopulation { return { female: Array(MAX_AGE + 1).fill(0), male: Array(MAX_AGE + 1).fill(0) }; }

function projectPath(input: DemographyProjectionInput, assumptions: DemographyAssumptions, variant?: ProjectionVariant): ProjectionYear[] {
  const result: ProjectionYear[] = [];
  let current = cloneCohorts(input.startPopulation);
  for (let year = input.baseYear; year <= input.targetYear; year += 1) {
    if (year > input.baseYear) {
      const next = emptyCohorts();
      let births = 0;
      let deaths = 0;
      let immigration = 0;
      let emigration = 0;
      for (const sex of ["female", "male"] as Sex[]) {
        for (let age = 0; age <= MAX_AGE; age += 1) {
          const before = current[sex][age];
          const survivors = before * assumptions.survivalBySex[sex][age];
          deaths += before - survivors;
          const nextAge = Math.min(MAX_AGE, age + 1);
          const inbound = assumptions.immigrationByAge[age] * 0.5;
          const outbound = Math.min(survivors, assumptions.emigrationByAge[age] * 0.5);
          next[sex][nextAge] += survivors + inbound - outbound;
          immigration += inbound;
          emigration += outbound;
        }
        const femaleBirths = sex === "female"
          ? current.female.reduce((total, women, age) => total + women * assumptions.fertilityByAge[age], 0)
          : 0;
        births += femaleBirths;
      }
      const additionalBirths = variant ? input.additionalBirthsByVariant?.[variant]?.[year] ?? 0 : 0;
      births += additionalBirths;
      next.female[0] += births * 0.488;
      next.male[0] += births * 0.512;
      current = next;
      result.push(snapshot(year, current, births, deaths, immigration, emigration, input.retirementAge, input.workingAgeStart));
      continue;
    }
    result.push(snapshot(year, current, 0, 0, 0, 0, input.retirementAge, input.workingAgeStart));
  }
  return result;
}

function snapshot(year: number, population: CohortPopulation, births: number, deaths: number, immigration: number, emigration: number, retirementAge: number, workingAgeStart: number): ProjectionYear {
  const total = sum(population);
  const children = sum(population, 0, Math.max(0, workingAgeStart - 1));
  const workingAge = sum(population, workingAgeStart, Math.max(workingAgeStart, retirementAge - 1));
  const olderPopulation = sum(population, retirementAge, MAX_AGE);
  const denominator = Math.max(1, workingAge);
  return {
    year,
    population: round(total, 0),
    births: round(births, 0),
    deaths: round(deaths, 0),
    immigration: round(immigration, 0),
    emigration: round(emigration, 0),
    migrationBalance: round(immigration - emigration, 0),
    children: round(children, 0),
    workingAge: round(workingAge, 0),
    retirementAge: round(retirementAge, 0),
    olderPopulation: round(olderPopulation, 0),
    youthDependencyRatio: round(children / denominator * 100, 3),
    oldAgeDependencyRatio: round(olderPopulation / denominator * 100, 3),
    totalDependencyRatio: round((children + olderPopulation) / denominator * 100, 3),
    byAge: cloneCohorts(population),
  };
}

export function projectDemography(input: DemographyProjectionInput): DemographyProjectionRun {
  const issues = validateDemographyInput(input);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join(" "));
  const variants = {
    lower: projectPath(input, input.variants.lower, "lower"),
    central: projectPath(input, input.variants.central, "central"),
    upper: projectPath(input, input.variants.upper, "upper"),
  } satisfies Record<ProjectionVariant, ProjectionYear[]>;
  const inputSignature = projectionInputSignature(input);
  return {
    id: `demography-${input.scenarioId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${inputSignature.slice(-8)}`,
    scenarioId: input.scenarioId,
    modelVersion: input.modelVersion ?? LONG_TERM_MODEL_VERSION,
    status: "aktuell",
    baseYear: input.baseYear,
    targetYear: input.targetYear,
    dataYear: input.baseline.dataYear,
    legalYear: input.legalYear,
    inputSignature,
    createdAt: new Date().toISOString(),
    baseline: projectPath({ ...input, scenario: input.baseline }, input.baseline),
    scenario: variants.central,
    variants,
    warnings: [
      "Die Zeitreihen sind Wenn-Dann-Szenarien und keine sicheren Vorhersagen.",
      "Die erste Ausbaustufe ist bundesweit aggregiert und schreibt keine individuellen Biografien fort.",
      "Die amtliche Referenz dient der Einordnung und Kalibrierung; Reformwirkungen benötigen eigene Wirkungsverträge.",
    ],
    sourceIds: [...new Set([...input.baseline.sourceIds, ...input.scenario.sourceIds])],
  };
}

function rampForFamilyEffect(year: number, input: FamilyFertilityEffectInput) {
  const start = input.baseYear + Math.max(0, Math.round(input.onsetYears));
  const end = start + Math.max(1, Math.round(input.durationYears));
  if (year < start) return 0;
  return clamp((year - start + 1) / Math.max(1, end - start), 0, 1);
}

export function calculateFamilyFertilityPath(input: FamilyFertilityEffectInput): FamilyFertilityPath {
  if (!Number.isInteger(input.baseYear) || input.targetYear < input.baseYear || input.annualBirthBaseline < 0 || !Number.isFinite(input.effectPct)) throw new Error("Ungültige Annahmen für den familienpolitischen Wirkungspfad.");
  const empty: Record<ProjectionVariant, Record<number, number>> = { lower: {}, central: {}, upper: {} };
  const warnings = [
    "Direkte Familienausgaben und eine mögliche demografische Wirkung werden getrennt gerechnet.",
    "Zusätzliche Geburten beeinflussen das Erwerbspotenzial erst nach dem errechneten Kohortenübergang.",
  ];
  const points: FamilyFertilityPathPoint[] = [];
  for (let year = input.baseYear; year <= input.targetYear; year += 1) {
    const factor = rampForFamilyEffect(year, input);
    const central = input.status === "szenarioband-berechenbar" ? input.annualBirthBaseline * input.effectPct / 100 * factor : null;
    const lower = central === null ? null : central * 0.5;
    const upper = central === null ? null : central * 1.5;
    const direction = input.status === "nicht-berechnet" ? "nicht-berechnet" : input.effectPct < 0 ? "negativ" : "positiv";
    const earliestWorkingAgeYear = central === null ? null : year + input.workingAgeStart;
    points.push({ year, status: input.status, direction, additionalBirths: central, lowerBirths: lower, upperBirths: upper, earliestWorkingAgeYear });
    if (central !== null) {
      empty.central[year] = central;
      empty.lower[year] = lower ?? 0;
      empty.upper[year] = upper ?? 0;
    }
  }
  if (input.status === "nicht-berechnet") warnings.push("Die konkrete Geburtenwirkung ist nicht ausreichend belegt und bleibt ohne Punktwert.");
  if (input.status === "gerichteter-zusammenhang") warnings.push("Die Wirkungsrichtung ist sichtbar; eine zusätzliche Geburtenzahl wird nicht behauptet.");
  return { status: input.status, points, additionalBirthsByVariant: empty, sourceIds: [...input.sourceIds], warnings };
}

export function calculateFamilyReformImpact(input: {
  benefitChangePct: number;
  familyBaselineBn: number;
  fertility: FamilyFertilityEffectInput;
}): FamilyReformImpact {
  if (!Number.isFinite(input.benefitChangePct) || input.familyBaselineBn < 0) throw new Error("Ungültige direkte Familienannahme.");
  const directBudgetDeltaBn = input.familyBaselineBn * input.benefitChangePct / 100;
  const path = calculateFamilyFertilityPath(input.fertility);
  return {
    directBudgetDeltaBn: round(directBudgetDeltaBn, 3),
    familyReliefBn: round(-directBudgetDeltaBn, 3),
    fertilityPath: path,
    warnings: ["Die direkte Budgetwirkung ist keine Gegenfinanzierung eines unsicheren Geburtenpfads.", ...path.warnings],
  };
}

function validateMigrationInput(input: MigrationPathInput) {
  if (!Number.isInteger(input.baseYear) || input.targetYear < input.baseYear || input.annualArrivals < 0 || input.ageProfile.length !== MAX_AGE + 1) throw new Error("Ungültige Migrationsannahmen.");
  if (input.ageProfile.some((value) => !Number.isFinite(value) || value < 0) || input.ageProfile.reduce((sum, value) => sum + value, 0) <= 0) throw new Error("Das Altersprofil der Migration muss aus nichtnegativen Werten bestehen.");
  if (input.workingAgeStart < 0 || input.retirementAge <= input.workingAgeStart || input.retirementAge > MAX_AGE) throw new Error("Ungültige Altersgrenzen im Migrationspfad.");
  for (const value of [input.protectionSharePct, input.participationRatePct, input.employmentRatePct, input.workTimeFactorPct, input.taxRatePct, input.contributionRatePct, input.transferRateWhenNotEmployedPct]) if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Quoten im Migrationspfad müssen zwischen 0 und 100 liegen.");
}

function migrationDelay(input: MigrationPathInput) {
  if (input.accessPreset === "vereinfachter-frueher-zugang") return 0;
  if (input.accessPreset === "rechtsstand-des-szenarios") return Math.max(0, Math.round(input.accessDelayYears));
  return Math.max(0, Math.round(input.accessDelayYears));
}

function migrationProfileSum(input: MigrationPathInput) {
  return input.ageProfile.reduce((sum, value) => sum + value, 0);
}

function calculateMigrationPathForRates(input: MigrationPathInput, participationRatePct: number, employmentRatePct: number): MigrationPathPoint[] {
  const delay = migrationDelay(input);
  const profileTotal = migrationProfileSum(input);
  const points: MigrationPathPoint[] = [];
  for (let year = input.baseYear; year <= input.targetYear; year += 1) {
    let workingAge = 0;
    let legallyEligible = 0;
    let participants = 0;
    let employed = 0;
    const statusCounts: Record<MigrationStatus, number> = { "im-verfahren": 0, "noch-nicht-erwerbsberechtigt": 0, erwerbsberechtigt: 0, beschäftigt: 0, qualifizierung: 0 };
    for (let arrivalYear = input.baseYear; arrivalYear <= year; arrivalYear += 1) {
      const yearsSinceArrival = year - arrivalYear;
      for (let initialAge = 0; initialAge <= MAX_AGE; initialAge += 1) {
        const count = input.annualArrivals * input.ageProfile[initialAge] / profileTotal;
        const age = Math.min(MAX_AGE, initialAge + yearsSinceArrival);
        const protectedCount = count * input.protectionSharePct / 100;
        const generalCount = count - protectedCount;
        const isWorkingAge = age >= input.workingAgeStart && age < input.retirementAge;
        if (!isWorkingAge) continue;
        workingAge += count;
        const eligible = generalCount + (yearsSinceArrival >= delay ? protectedCount : 0);
        legallyEligible += eligible;
        const cohortParticipants = eligible * participationRatePct / 100;
        const cohortEmployed = cohortParticipants * employmentRatePct / 100;
        participants += cohortParticipants;
        employed += cohortEmployed;
        const notEligible = protectedCount - (yearsSinceArrival >= delay ? protectedCount : 0);
        statusCounts[notEligible > 0 ? (yearsSinceArrival === 0 ? "im-verfahren" : "noch-nicht-erwerbsberechtigt") : "erwerbsberechtigt"] += notEligible > 0 ? notEligible : eligible;
        statusCounts.beschäftigt += cohortEmployed;
        statusCounts.qualifizierung += Math.max(0, cohortParticipants - cohortEmployed);
      }
    }
    const fte = employed * input.workTimeFactorPct / 100;
    const wageBill = fte * input.averageAnnualWage;
    const taxes = wageBill * input.taxRatePct / 100;
    const contributions = wageBill * input.contributionRatePct / 100;
    points.push({
      year,
      arrivals: input.annualArrivals,
      workingAge: round(workingAge, 0),
      legallyEligible: round(legallyEligible, 0),
      participants: round(participants, 0),
      employed: round(employed, 0),
      fullTimeEquivalents: round(fte, 0),
      taxableWageBill: round(wageBill, 0),
      taxes: round(taxes, 0),
      socialContributions: round(contributions, 0),
      transferDependent: round(Math.max(0, workingAge - employed) * input.transferRateWhenNotEmployedPct / 100, 0),
      statusCounts: Object.fromEntries(Object.entries(statusCounts).map(([key, value]) => [key, round(value, 0)])) as Record<MigrationStatus, number>,
    });
  }
  return points;
}

export function calculateMigrationPath(input: MigrationPathInput): MigrationPath {
  validateMigrationInput(input);
  const central = calculateMigrationPathForRates(input, input.participationRatePct, input.employmentRatePct);
  const lower = calculateMigrationPathForRates(input, input.participationRatePct * 0.8, input.employmentRatePct * 0.8);
  const upper = calculateMigrationPathForRates(input, clamp(input.participationRatePct * 1.15, 0, 100), clamp(input.employmentRatePct * 1.15, 0, 100));
  const delay = migrationDelay(input);
  return {
    accessPreset: input.accessPreset,
    legalYear: input.legalYear,
    legalBasis: [...migrationLegalBasis],
    accessDelayYears: delay,
    points: central,
    lower,
    upper,
    sourceIds: [...new Set([...input.sourceIds, ...migrationLegalBasis.map((id) => `source-${id}`)])],
    warnings: [
      "Allgemeine Migration und schutz-/asylbezogene Zuwanderung werden im Modell getrennt geführt.",
      "Erwerbsberechtigung ist keine Beschäftigungsgarantie; Beiträge entstehen nur über Beschäftigung und Arbeitsvolumen.",
      input.accessPreset === "vereinfachter-frueher-zugang" ? "Der frühere Zugang ist ein Szenario und überschreibt nicht den geltenden Rechtsstand." : "Der Rechtsstand ist als Baseline mit Daten- und Rechtsjahr gespeichert.",
    ],
  };
}

export function isProjectionCurrent(run: DemographyProjectionRun, input: DemographyProjectionInput) {
  return run.inputSignature === projectionInputSignature(input);
}

export function markProjectionStatus(run: DemographyProjectionRun, input: DemographyProjectionInput): DemographyProjectionRun {
  return { ...run, status: isProjectionCurrent(run, input) ? "aktuell" : "veraltet" };
}

export function defaultProjectionInput(scenarioId = "active-draft", targetYear = 2070): DemographyProjectionInput {
  const variants = createDefaultVariantSet();
  return {
    scenarioId,
    baseYear: 2026,
    targetYear,
    startPopulation: createDefaultStartPopulation(),
    baseline: variants.central,
    scenario: variants.central,
    variants,
    workingAgeStart: defaultLongTermScenarioSettings.workingAgeStart,
    retirementAge: defaultLongTermScenarioSettings.retirementAge,
    legalYear: defaultLongTermScenarioSettings.preset === "amtliche-referenz" ? 2026 : 2026,
  };
}

export function applyPreset(input: DemographyProjectionInput, settings: Pick<LongTermScenarioSettings, "preset" | "fertilityEffectPct" | "migrationNetAnnual">): DemographyProjectionInput {
  const factor = settings.preset === "niedrigere-nettozuwanderung" ? 0.65 : settings.preset === "hoehere-nettozuwanderung" ? 1.35 : 1;
  const central = { ...input.scenario, immigrationByAge: migrationProfile(Math.max(0, settings.migrationNetAnnual) * factor + 270_000) };
  if (settings.fertilityEffectPct === 0) return { ...input, scenario: central, variants: { ...input.variants, central } };
  const adjusted = { ...central, fertilityByAge: central.fertilityByAge.map((value) => value * (1 + settings.fertilityEffectPct / 100)) };
  return { ...input, scenario: adjusted, variants: { ...input.variants, central: adjusted } };
}
