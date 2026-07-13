import { SGB2_SOURCE_IDS } from "./sgb2-policy";
import type {
  CalibrationEntry,
  PopulationDistributionItem,
  PopulationRun,
  PopulationRunMetadata,
  PopulationValidationIssue,
  Sgb2BenefitUnit,
  Sgb2BenefitUnitType,
  Sgb2EligibilityStatus,
  Sgb2IncomeBand,
  Sgb2PersonProfile,
  Sgb2PersonStatus,
  Sgb2PopulationSummary,
  SyntheticHousehold,
  SyntheticPerson,
} from "./types";

export const SGB2_POPULATION_SCHEMA_VERSION = 1;
export const SGB2_POPULATION_MODEL_VERSION = "sgb2-population-0.9.0";
export const TARGET_SGB2_BENEFIT_UNITS = 2_900_000;

const BENEFIT_UNIT_TYPE_TARGETS: Record<Sgb2BenefitUnitType, number> = {
  alleinstehend: 0.52,
  "paar-ohne-kinder": 0.08,
  "paar-mit-kindern": 0.15,
  alleinerziehend: 0.16,
  gemischt: 0.09,
};
const REGION_TARGETS: Record<Sgb2BenefitUnit["regionGroup"], number> = {
  west: 0.49,
  ost: 0.18,
  sued: 0.20,
  stadtstaat: 0.13,
};
const INCOME_TARGETS: Record<Sgb2IncomeBand, number> = {
  "kein-einkommen": 0.36,
  "niedriges-erwerbseinkommen": 0.27,
  "sonstiges-einkommen": 0.22,
  "vorrangige-leistung": 0.15,
};
const PERSON_STATUS_TARGETS: Record<Sgb2PersonStatus, number> = {
  erwerbsfaehig: 0.69,
  "nicht-erwerbsfaehig-kind": 0.28,
  "nicht-erwerbsfaehig-erwachsen": 0.03,
};
const BENEFIT_MONTH_TARGETS: Record<string, number> = {
  "1-3": 0.17,
  "4-6": 0.17,
  "7-9": 0.16,
  "10-12": 0.50,
};

const JOINT_DISTRIBUTION_NOTE = "Gemeinsame Verteilungen von Bedarfsgemeinschaft, Einkommen, Wohnen und Bezugsdauer sind regelbasiert modelliert und keine amtlichen Mikrodaten.";
const EASTERN_STATES = new Set(["Brandenburg", "Mecklenburg-Vorpommern", "Sachsen", "Sachsen-Anhalt", "Thüringen"]);
const SOUTHERN_STATES = new Set(["Bayern", "Baden-Württemberg"]);
const CITY_STATES = new Set(["Berlin", "Hamburg", "Bremen"]);

interface CandidateUnit extends Sgb2BenefitUnit {
  score: number;
  memberProfiles: Sgb2PersonProfile[];
}

interface WeightedItem { weight: number; }
interface RakeDimension<T> { targets: Record<string, number>; key: (item: T) => string; }

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicFraction(value: string) {
  return hashSeed(value) / 4294967296;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCents(value: number) {
  return Math.max(0, Math.round(value));
}

function regionGroup(state: string): Sgb2BenefitUnit["regionGroup"] {
  if (CITY_STATES.has(state)) return "stadtstaat";
  if (SOUTHERN_STATES.has(state)) return "sued";
  if (EASTERN_STATES.has(state)) return "ost";
  return "west";
}

function regionId(household: SyntheticHousehold) {
  const state = household.federalState.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-");
  return `${state}:${household.communityType}`;
}

function memberGroups(household: SyntheticHousehold, members: SyntheticPerson[]) {
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const adults = sorted.filter((person) => person.age >= 18);
  const children = sorted.filter((person) => person.age < 18);
  if (household.householdType !== "mehrpersonen" || adults.length <= 2) return [sorted];
  const primary = [...adults.slice(0, 2), ...children];
  return [primary, ...adults.slice(2).map((adult) => [adult])].filter((group) => group.length > 0);
}

function benefitUnitType(members: SyntheticPerson[]): Sgb2BenefitUnitType {
  const adults = members.filter((person) => person.age >= 18).length;
  const children = members.length - adults;
  if (adults === 1 && children === 0) return "alleinstehend";
  if (adults === 2 && children === 0) return "paar-ohne-kinder";
  if (adults === 1 && children > 0) return "alleinerziehend";
  if (adults === 2 && children > 0) return "paar-mit-kindern";
  return "gemischt";
}

function personStatus(person: SyntheticPerson): Sgb2PersonStatus {
  if (person.age < 15) return "nicht-erwerbsfaehig-kind";
  if (person.age <= 66 && person.employmentStatus !== "rente") return "erwerbsfaehig";
  return "nicht-erwerbsfaehig-erwachsen";
}

function eligibilityStatus(person: SyntheticPerson): Sgb2EligibilityStatus {
  if (person.age >= 67 || person.employmentStatus === "rente") return "ausgeschlossen-alter";
  if (person.age < 25 && person.householdRole === "weitere-person") return "ausgeschlossen-modell";
  return "potenziell-leistungsberechtigt";
}

function monthlyIncome(person: SyntheticPerson) {
  const employmentGrossCents = roundCents(person.grossEmploymentIncome / 12 * 100);
  const otherIncomeCents = roundCents(person.otherTaxableIncome / 12 * 100);
  const pensionIncomeCents = roundCents(person.pensionIncome / 12 * 100);
  const transferIncomeCents = roundCents(person.transferIncome / 12 * 100);
  const countableIncomeProxyCents = roundCents(employmentGrossCents * 0.78 + otherIncomeCents + pensionIncomeCents * 0.9);
  return { employmentGrossCents, otherIncomeCents, pensionIncomeCents, transferIncomeCents, countableIncomeProxyCents };
}

function standardNeedProxyCents(members: SyntheticPerson[]) {
  const adultCount = members.filter((person) => person.age >= 18).length;
  return members.reduce((sum, person) => {
    if (person.age >= 18) return sum + (adultCount >= 2 ? 50_600 : 56_300);
    if (person.age < 6) return sum + 35_700;
    if (person.age < 14) return sum + 39_000;
    return sum + 47_100;
  }, 0);
}

function housingProfile(household: SyntheticHousehold, unitMembers: SyntheticPerson[], householdMembers: SyntheticPerson[], unitId: string) {
  const householdSize = Math.max(1, householdMembers.length);
  const memberShare = unitMembers.length / householdSize;
  const jitter = deterministicFraction(`${unitId}|housing`);
  const ownerAdjustment = household.housingStatus === "eigentum" ? 14 : 0;
  const floorAreaTotal = clamp(38 + (householdSize - 1) * 17 + ownerAdjustment + (jitter - 0.5) * 10, 28, 220);
  const floorAreaSquareMeters = Math.round(floorAreaTotal * memberShare * 10) / 10;
  const heatRegionFactor = household.communityType === "grossstadt" ? 1.08 : household.communityType === "laendlich" ? 1.12 : 1;
  const heatingTotalCents = roundCents((55 + floorAreaTotal * 0.95 + householdSize * 20) * heatRegionFactor * (0.88 + jitter * 0.24) * 100);
  let baseRentTotalCents = 0;
  let coldOperatingTotalCents = 0;
  if (household.housingStatus === "miete") {
    const grossColdTotalCents = roundCents(household.grossColdRent * 100);
    baseRentTotalCents = roundCents(grossColdTotalCents * 0.78);
    coldOperatingTotalCents = Math.max(0, grossColdTotalCents - baseRentTotalCents);
  } else {
    coldOperatingTotalCents = roundCents((75 + floorAreaTotal * 1.45 + householdSize * 16) * 100);
  }
  const baseRentCents = roundCents(baseRentTotalCents * memberShare);
  const coldOperatingCostsCents = roundCents(coldOperatingTotalCents * memberShare);
  return {
    regionId: regionId(household),
    housingStatus: household.housingStatus,
    floorAreaSquareMeters,
    baseRentCents,
    coldOperatingCostsCents,
    grossColdRentCents: baseRentCents + coldOperatingCostsCents,
    heatingCostsCents: roundCents(heatingTotalCents * memberShare),
    sourceId: SGB2_SOURCE_IDS.housingModel,
    uncertainty: "hoch" as const,
  };
}

function incomeBand(profiles: Sgb2PersonProfile[], needProxyCents: number): Sgb2IncomeBand {
  const employment = profiles.reduce((sum, profile) => sum + profile.income.employmentGrossCents, 0);
  const pension = profiles.reduce((sum, profile) => sum + profile.income.pensionIncomeCents, 0);
  const countable = profiles.reduce((sum, profile) => sum + profile.income.countableIncomeProxyCents, 0);
  if (countable <= 100) return "kein-einkommen";
  if (pension > 0 && employment === 0) return "vorrangige-leistung";
  if (employment > 0 && countable < needProxyCents) return "niedriges-erwerbseinkommen";
  return "sonstiges-einkommen";
}

function receiptScore(household: SyntheticHousehold, members: SyntheticPerson[], profiles: Sgb2PersonProfile[], needProxyCents: number, unitId: string) {
  const countable = profiles.reduce((sum, profile) => sum + profile.income.countableIncomeProxyCents, 0);
  const gapShare = clamp((needProxyCents - countable) / Math.max(needProxyCents, 1), 0, 1);
  const unemployed = members.filter((person) => person.employmentStatus === "arbeitslos").length;
  const nonEmployed = members.filter((person) => person.employmentStatus === "nicht-erwerbstaetig").length;
  const singleParent = benefitUnitType(members) === "alleinerziehend";
  const assetPenalty = household.wealth > 80_000 ? 0.24 : household.wealth > 30_000 ? 0.08 : 0;
  const urbanBonus = household.communityType === "grossstadt" ? 0.04 : household.communityType === "staedtisch" ? 0.02 : 0;
  const deterministicNoise = (deterministicFraction(`${unitId}|receipt`) - 0.5) * 0.14;
  return gapShare * 0.62 + Math.min(0.28, unemployed * 0.18) + Math.min(0.12, nonEmployed * 0.06) + (singleParent ? 0.12 : 0) + (household.housingStatus === "miete" ? 0.04 : 0) + urbanBonus + deterministicNoise - assetPenalty;
}

function monthsGroup(months: number) {
  if (months <= 3) return "1-3";
  if (months <= 6) return "4-6";
  if (months <= 9) return "7-9";
  return "10-12";
}

function benefitMonths(score: number, unitId: string) {
  const jitter = deterministicFraction(`${unitId}|months`);
  return Math.round(clamp(2 + score * 8.5 + jitter * 3, 1, 12));
}

function rake<T extends WeightedItem>(items: T[], total: number, dimensions: Array<RakeDimension<T>>) {
  if (!items.length) return;
  const initialSum = items.reduce((sum, item) => sum + item.weight, 0);
  const initialFactor = total / Math.max(initialSum, 1);
  items.forEach((item) => { item.weight *= initialFactor; });
  for (let iteration = 0; iteration < 30; iteration += 1) {
    dimensions.forEach((dimension) => {
      Object.entries(dimension.targets).forEach(([category, targetShare]) => {
        const members = items.filter((item) => dimension.key(item) === category);
        const actual = members.reduce((sum, item) => sum + item.weight, 0);
        if (!members.length || actual <= 0) return;
        const factor = targetShare * total / actual;
        members.forEach((item) => { item.weight *= factor; });
      });
    });
  }
  const finalSum = items.reduce((sum, item) => sum + item.weight, 0);
  const finalFactor = total / Math.max(finalSum, 1);
  items.forEach((item) => { item.weight *= finalFactor; });
}

function distribution<T>(items: T[], key: (item: T) => string, weight: (item: T) => number): PopulationDistributionItem[] {
  const grouped = new Map<string, number>();
  items.forEach((item) => grouped.set(key(item), (grouped.get(key(item)) ?? 0) + weight(item)));
  const total = [...grouped.values()].reduce((sum, value) => sum + value, 0);
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "de", { numeric: true }))
    .map(([id, value]) => ({ id, label: id, value, share: value / Math.max(total, 1) }));
}

function calibrationEntries<T>(name: string, sourceId: string, tolerance: number, targets: Record<string, number>, items: T[], key: (item: T) => string, weight: (item: T) => number): CalibrationEntry[] {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  return Object.entries(targets).map(([category, target]) => {
    const actual = items.reduce((sum, item) => sum + (key(item) === category ? weight(item) : 0), 0) / Math.max(total, 1);
    const absoluteDeviation = actual - target;
    const relativeDeviation = target === 0 ? 0 : absoluteDeviation / target;
    return {
      id: `SGB-II:${name}:${category}`,
      dimension: `SGB II · ${name}`,
      category,
      target,
      actual,
      absoluteDeviation,
      relativeDeviation,
      tolerance,
      status: Math.abs(relativeDeviation) <= tolerance ? "innerhalb-toleranz" as const : "warnung" as const,
      sourceId,
      unit: "anteil" as const,
      note: JOINT_DISTRIBUTION_NOTE,
    };
  });
}

function validateSgb2Population(units: Sgb2BenefitUnit[], profiles: Sgb2PersonProfile[], households: SyntheticHousehold[], persons: SyntheticPerson[]) {
  const issues: PopulationValidationIssue[] = [];
  const unitIds = new Set<string>();
  const profileIds = new Set<string>();
  const householdMap = new Map(households.map((household) => [household.id, household]));
  const personMap = new Map(persons.map((person) => [person.id, person]));
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));

  units.forEach((unit) => {
    if (unitIds.has(unit.id)) issues.push({ code: "sgb2-duplicate-benefit-unit", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Bedarfsgemeinschafts-ID ist nicht eindeutig." });
    unitIds.add(unit.id);
    if (!householdMap.has(unit.householdId)) issues.push({ code: "sgb2-missing-household", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Zugehöriger Haushalt fehlt." });
    if (!Number.isFinite(unit.weight) || unit.weight <= 0) issues.push({ code: "sgb2-invalid-weight", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Bedarfsgemeinschaftsgewicht ist nicht positiv und endlich." });
    if (unit.receiptStatus === "bezug" && (unit.benefitMonths < 1 || unit.benefitMonths > 12)) issues.push({ code: "sgb2-invalid-benefit-months", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Bezugsmonate liegen außerhalb 1 bis 12." });
    if (unit.receiptStatus !== "bezug" && unit.benefitMonths !== 0) issues.push({ code: "sgb2-months-without-receipt", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Bezugsmonate sind ohne modellierten Leistungsbezug gesetzt." });
    if (unit.memberIds.some((id) => !personMap.has(id))) issues.push({ code: "sgb2-missing-person", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Mindestens ein Mitglied fehlt im Personenbestand." });
    if (unit.housing.grossColdRentCents !== unit.housing.baseRentCents + unit.housing.coldOperatingCostsCents) issues.push({ code: "sgb2-housing-components", severity: "error", entityType: "benefit-unit", entityId: unit.id, message: "Bruttokaltmiete entspricht nicht der Summe ihrer Komponenten." });
  });

  profiles.forEach((profile) => {
    if (profileIds.has(profile.id)) issues.push({ code: "sgb2-duplicate-person-profile", severity: "error", entityType: "sgb2-person", entityId: profile.id, message: "SGB-II-Personenprofil-ID ist nicht eindeutig." });
    profileIds.add(profile.id);
    const unit = unitMap.get(profile.benefitUnitId);
    if (!unit || !unit.memberIds.includes(profile.personId)) issues.push({ code: "sgb2-person-unit-link", severity: "error", entityType: "sgb2-person", entityId: profile.id, message: "Personenprofil und Bedarfsgemeinschaft sind nicht konsistent verknüpft." });
    if (!personMap.has(profile.personId)) issues.push({ code: "sgb2-person-source-missing", severity: "error", entityType: "sgb2-person", entityId: profile.id, message: "Quellperson fehlt." });
    if (!Number.isFinite(profile.weight) || profile.weight <= 0) issues.push({ code: "sgb2-invalid-person-weight", severity: "error", entityType: "sgb2-person", entityId: profile.id, message: "Personengewicht ist nicht positiv und endlich." });
  });
  return issues;
}

function buildCandidates(run: PopulationRunMetadata, households: SyntheticHousehold[], persons: SyntheticPerson[]) {
  const personsByHousehold = new Map<string, SyntheticPerson[]>();
  persons.forEach((person) => {
    const group = personsByHousehold.get(person.householdId) ?? [];
    group.push(person);
    personsByHousehold.set(person.householdId, group);
  });
  const candidates: CandidateUnit[] = [];
  households.forEach((household) => {
    const householdMembers = (personsByHousehold.get(household.id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    memberGroups(household, householdMembers).forEach((members, index) => {
      const id = `${household.id}-bg-${String(index + 1).padStart(2, "0")}`;
      const profiles = members.map<Sgb2PersonProfile>((person) => ({
        id: `${person.id}-sgb2`,
        runId: run.id,
        personId: person.id,
        householdId: household.id,
        benefitUnitId: id,
        status: personStatus(person),
        eligibilityStatus: eligibilityStatus(person),
        relationshipRole: person.householdRole,
        age: person.age,
        income: monthlyIncome(person),
        benefitMonths: 0,
        weight: person.weight,
        benefitWeight: 0,
        sourceId: SGB2_SOURCE_IDS.statistics,
        assumptionIds: ["sgb2-joint-distribution-model"],
      }));
      const housing = housingProfile(household, members, householdMembers, id);
      const needProxy = standardNeedProxyCents(members) + housing.grossColdRentCents + housing.heatingCostsCents;
      const countable = profiles.reduce((sum, profile) => sum + profile.income.countableIncomeProxyCents, 0);
      const type = benefitUnitType(members);
      const score = receiptScore(household, members, profiles, needProxy, id);
      const eligibleMemberIds = profiles.filter((profile) => profile.eligibilityStatus === "potenziell-leistungsberechtigt").map((profile) => profile.personId);
      const nonEligibleMemberIds = profiles.filter((profile) => profile.eligibilityStatus !== "potenziell-leistungsberechtigt").map((profile) => profile.personId);
      candidates.push({
        id,
        runId: run.id,
        householdId: household.id,
        memberIds: members.map((person) => person.id),
        eligibleMemberIds,
        nonEligibleMemberIds,
        type,
        regionGroup: regionGroup(household.federalState),
        incomeBand: incomeBand(profiles, needProxy),
        receiptStatus: "kein-bezug",
        benefitMonths: 0,
        entryMonth: null,
        exitMonth: null,
        monthlyCountableIncomeProxyCents: countable,
        monthlyNeedProxyCents: needProxy,
        housing,
        baseWeight: household.weight,
        weight: household.weight,
        derivationTrace: [
          `Haushalt ${household.id} mit ${householdMembers.length} Personen`,
          householdMembers.length === members.length ? "Haushalt und Bedarfsgemeinschaft sind deckungsgleich." : "Mehrpersonenhaushalt wurde deterministisch in mehrere Bedarfsgemeinschaften getrennt.",
          `BG-Typ ${type}; Region ${regionGroup(household.federalState)}; Einkommensband ${incomeBand(profiles, needProxy)}`,
        ],
        sourceIds: [SGB2_SOURCE_IDS.statistics, SGB2_SOURCE_IDS.housingModel],
        assumptionIds: ["sgb2-joint-distribution-model", "sgb2-benefit-duration-model"],
        score,
        memberProfiles: profiles,
      });
    });
  });
  return candidates;
}

export function deriveSgb2Population(run: PopulationRunMetadata, households: SyntheticHousehold[], persons: SyntheticPerson[]) {
  const candidates = buildCandidates(run, households, persons)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  let cumulativeWeight = 0;
  const selected: CandidateUnit[] = [];
  for (const candidate of candidates) {
    if (!candidate.eligibleMemberIds.length || cumulativeWeight >= TARGET_SGB2_BENEFIT_UNITS) continue;
    candidate.receiptStatus = "bezug";
    candidate.benefitMonths = benefitMonths(candidate.score, candidate.id);
    const availableEntryMonths = 13 - candidate.benefitMonths;
    candidate.entryMonth = 1 + Math.floor(deterministicFraction(`${candidate.id}|entry`) * Math.max(1, availableEntryMonths));
    candidate.exitMonth = candidate.entryMonth + candidate.benefitMonths - 1;
    candidate.memberProfiles.forEach((profile) => { profile.benefitMonths = candidate.benefitMonths; });
    selected.push(candidate);
    cumulativeWeight += candidate.baseWeight;
  }

  rake(selected, TARGET_SGB2_BENEFIT_UNITS, [
    { targets: BENEFIT_UNIT_TYPE_TARGETS, key: (unit) => unit.type },
    { targets: REGION_TARGETS, key: (unit) => unit.regionGroup },
    { targets: INCOME_TARGETS, key: (unit) => unit.incomeBand },
    { targets: BENEFIT_MONTH_TARGETS, key: (unit) => monthsGroup(unit.benefitMonths) },
  ]);

  const selectedIds = new Set(selected.map((unit) => unit.id));
  candidates.forEach((candidate) => {
    if (!selectedIds.has(candidate.id)) candidate.weight = candidate.baseWeight;
    const benefitWeight = selectedIds.has(candidate.id) ? candidate.weight : 0;
    candidate.memberProfiles.forEach((profile) => { profile.benefitWeight = benefitWeight; });
  });

  const benefitUnits = candidates.map<Sgb2BenefitUnit>(({ score: _score, memberProfiles: _memberProfiles, ...unit }) => unit);
  const personProfiles = candidates.flatMap((candidate) => candidate.memberProfiles);
  const recipientProfiles = personProfiles.filter((profile) => profile.benefitWeight > 0);
  const selectedUnits = benefitUnits.filter((unit) => unit.receiptStatus === "bezug");

  const calibration: CalibrationEntry[] = [
    {
      id: "SGB-II:Bedarfsgemeinschaften:gesamt",
      dimension: "SGB II · Bedarfsgemeinschaften",
      category: "gesamt",
      target: TARGET_SGB2_BENEFIT_UNITS,
      actual: selectedUnits.reduce((sum, unit) => sum + unit.weight, 0),
      absoluteDeviation: selectedUnits.reduce((sum, unit) => sum + unit.weight, 0) - TARGET_SGB2_BENEFIT_UNITS,
      relativeDeviation: (selectedUnits.reduce((sum, unit) => sum + unit.weight, 0) - TARGET_SGB2_BENEFIT_UNITS) / TARGET_SGB2_BENEFIT_UNITS,
      tolerance: 0.005,
      status: "innerhalb-toleranz",
      sourceId: SGB2_SOURCE_IDS.statistics,
      unit: "anzahl",
      note: "Gerundetes amtliches Strukturziel; Statistik- und Rechtsstand werden getrennt geführt.",
    },
    ...calibrationEntries("BG-Typ", SGB2_SOURCE_IDS.statistics, 0.06, BENEFIT_UNIT_TYPE_TARGETS, selectedUnits, (unit) => unit.type, (unit) => unit.weight),
    ...calibrationEntries("Region", SGB2_SOURCE_IDS.statistics, 0.07, REGION_TARGETS, selectedUnits, (unit) => unit.regionGroup, (unit) => unit.weight),
    ...calibrationEntries("Einkommenslage", SGB2_SOURCE_IDS.statistics, 0.08, INCOME_TARGETS, selectedUnits, (unit) => unit.incomeBand, (unit) => unit.weight),
    ...calibrationEntries("Bezugsdauer", SGB2_SOURCE_IDS.statistics, 0.08, BENEFIT_MONTH_TARGETS, selectedUnits, (unit) => monthsGroup(unit.benefitMonths), (unit) => unit.weight),
    ...calibrationEntries("Personenstatus", SGB2_SOURCE_IDS.statistics, 0.10, PERSON_STATUS_TARGETS, recipientProfiles, (profile) => profile.status, (profile) => profile.benefitWeight),
  ];

  const weightedBenefitUnits = selectedUnits.reduce((sum, unit) => sum + unit.weight, 0);
  const weightedSgb2Persons = recipientProfiles.reduce((sum, profile) => sum + profile.benefitWeight, 0);
  const weightedHouseholds = households.reduce((sum, household) => sum + household.weight, 0);
  const averageBenefitMonths = selectedUnits.reduce((sum, unit) => sum + unit.benefitMonths * unit.weight, 0) / Math.max(weightedBenefitUnits, 1);
  const summary: Sgb2PopulationSummary = {
    schemaVersion: SGB2_POPULATION_SCHEMA_VERSION,
    modelVersion: SGB2_POPULATION_MODEL_VERSION,
    benefitUnitCount: selectedUnits.length,
    weightedBenefitUnits,
    weightedSgb2Persons,
    averageBenefitMonths,
    receiptRateAmongHouseholds: weightedBenefitUnits / Math.max(weightedHouseholds, 1),
    distributions: {
      sgb2BenefitUnitType: distribution(selectedUnits, (unit) => unit.type, (unit) => unit.weight),
      sgb2PersonStatus: distribution(recipientProfiles, (profile) => profile.status, (profile) => profile.benefitWeight),
      sgb2IncomeBand: distribution(selectedUnits, (unit) => unit.incomeBand, (unit) => unit.weight),
      sgb2Region: distribution(selectedUnits, (unit) => unit.regionGroup, (unit) => unit.weight),
      sgb2BenefitMonths: distribution(selectedUnits, (unit) => monthsGroup(unit.benefitMonths), (unit) => unit.weight),
    },
    jointDistributionAssumptions: [
      JOINT_DISTRIBUTION_NOTE,
      "Leistungsbezug wird aus Einkommen, Erwerbsstatus, Haushaltsform, Vermögen, Wohnstatus und deterministischem Modellrest abgeleitet.",
      "Wohnfläche, Mietkomponenten, Heizkosten und Bezugsmonate sind korrelierte Modellgrößen mit expliziter hoher Unsicherheit.",
    ],
  };
  const validation = validateSgb2Population(benefitUnits, personProfiles, households, persons);
  return { benefitUnits, personProfiles, calibration, validation, summary };
}

export function augmentPopulationRunWithSgb2(generated: { run: PopulationRun; households: SyntheticHousehold[]; persons: SyntheticPerson[] }) {
  const sgb2 = deriveSgb2Population(generated.run.metadata, generated.households, generated.persons);
  const baseCalibration = generated.run.calibration.filter((entry) => !entry.id.startsWith("SGB-II:"));
  const baseValidation = generated.run.validation.filter((issue) => !issue.code.startsWith("sgb2-"));
  const calibration = [...baseCalibration, ...sgb2.calibration];
  const validation = [...baseValidation, ...sgb2.validation];
  const deviations = calibration.map((entry) => Math.abs(entry.relativeDeviation));
  const run: PopulationRun = {
    ...generated.run,
    metadata: {
      ...generated.run.metadata,
      sourceIds: Array.from(new Set([...generated.run.metadata.sourceIds, SGB2_SOURCE_IDS.statistics, SGB2_SOURCE_IDS.housingModel])),
      sgb2SchemaVersion: SGB2_POPULATION_SCHEMA_VERSION,
      sgb2ModelVersion: SGB2_POPULATION_MODEL_VERSION,
      quality: {
        maxRelativeDeviation: Math.max(...deviations),
        meanRelativeDeviation: deviations.reduce((sum, value) => sum + value, 0) / Math.max(deviations.length, 1),
        status: calibration.some((entry) => entry.status === "warnung") ? "warnung" : "innerhalb-toleranz",
      },
      limitations: Array.from(new Set([...generated.run.metadata.limitations, ...sgb2.summary.jointDistributionAssumptions])),
    },
    calibration,
    validation,
    summary: {
      ...generated.run.summary,
      calibrationStatus: calibration.some((entry) => entry.status === "warnung") ? "warnung" : "innerhalb-toleranz",
      validationErrors: validation.filter((issue) => issue.severity === "error").length,
      validationWarnings: validation.filter((issue) => issue.severity === "warning").length,
      distributions: { ...generated.run.summary.distributions, ...sgb2.summary.distributions },
    },
    sgb2Summary: sgb2.summary,
  };
  return { ...generated, run, benefitUnits: sgb2.benefitUnits, sgb2Persons: sgb2.personProfiles };
}
