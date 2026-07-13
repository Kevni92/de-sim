import type { ModelLevel, SyntheticHousehold, SyntheticPerson } from "./types";
import { EFFECT_MODEL_VERSION, EFFECT_PARAMETER_PREFIX, type EffectCalculationInput, type EffectEvidenceStatus, type EffectModuleDefinition, type EffectModuleResult, type EffectNonMonetaryMeasure, type EffectRun, type EffectTimeSeriesPoint, type EffectTimingDefinition } from "./effect-contracts";
import { effectRegistry } from "./effect-registry";
export * from "./effect-contracts";
export { effectRegistry } from "./effect-registry";

export const defaultEffectParameters = Object.fromEntries(
  effectRegistry.flatMap((module) => module.parameters.map((item) => [item.id, item.defaultValue])),
) as Record<string, number>;

export function readEffectParameters(changes: Record<string, number>): Record<string, number> {
  const values = { ...defaultEffectParameters };
  for (const [key, value] of Object.entries(changes)) {
    if (key.startsWith(EFFECT_PARAMETER_PREFIX) && Number.isFinite(value)) values[key.slice(EFFECT_PARAMETER_PREFIX.length)] = value;
  }
  return values;
}

export function mergeEffectParameters(changes: Record<string, number>, parameters: Record<string, number>): Record<string, number> {
  const next = Object.fromEntries(Object.entries(changes).filter(([key]) => !key.startsWith(EFFECT_PARAMETER_PREFIX)));
  for (const [key, value] of Object.entries(parameters)) if (Number.isFinite(value)) next[`${EFFECT_PARAMETER_PREFIX}${key}`] = value;
  return next;
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const weightedSum = <T>(items: T[], value: (item: T) => number, weight: (item: T) => number) => items.reduce((sum, item) => sum + value(item) * weight(item), 0);
const modelScale = (level: ModelLevel) => level === "statisch" ? 0 : level === "verhalten" ? 0.55 : 1;
const longScale = (level: ModelLevel) => level === "langfrist" ? 1 : 0;

function ramp(year: number, timing: EffectTimingDefinition): number {
  if (year < timing.startYear) return 0;
  const rising = clamp((year - timing.startYear + 1) / Math.max(1, timing.rampYears), 0, 1);
  if (year <= timing.peakYear || timing.decayRate <= 0) return rising;
  return rising * Math.exp(-timing.decayRate * (year - timing.peakYear));
}

function series(
  input: EffectCalculationInput,
  definition: EffectModuleDefinition,
  baseline: number,
  direct: number,
  indirect: number,
  feedback: number,
  uncertainty: number,
): EffectTimeSeriesPoint[] {
  const points: EffectTimeSeriesPoint[] = [];
  for (let year = 0; year <= input.horizonYears; year += 1) {
    const factor = ramp(year, definition.timing);
    const directAtYear = year === 0 ? direct : direct * (definition.timing.permanence === "dauerhaft" ? 1 : factor);
    const indirectAtYear = indirect * factor;
    const feedbackAtYear = feedback * factor;
    const scenarioValue = baseline + directAtYear + indirectAtYear + feedbackAtYear;
    const centralDelta = directAtYear + indirectAtYear + feedbackAtYear;
    points.push({
      year: input.dataYear + year,
      baseline: round(baseline),
      scenarioValue: round(scenarioValue),
      directEffect: round(directAtYear),
      indirectEffect: round(indirectAtYear),
      feedback: round(feedbackAtYear),
      lower: round(baseline + centralDelta * (centralDelta >= 0 ? 1 - uncertainty : 1 + uncertainty)),
      upper: round(baseline + centralDelta * (centralDelta >= 0 ? 1 + uncertainty : 1 - uncertainty)),
    });
  }
  return points;
}

interface PopulationAggregates {
  weightedPopulation: number;
  weightedHouseholds: number;
  workingAge: number;
  employed: number;
  children: number;
  seniors: number;
  targetHouseholds: number;
  singleParentTargetHouseholds: number;
  twoEarnerTargetHouseholds: number;
  targetParents: number;
  employedTargetParents: number;
  averageEmploymentIncome: number;
  totalEmploymentIncomeBn: number;
}

function aggregatePopulation(persons: SyntheticPerson[], households: SyntheticHousehold[]): PopulationAggregates {
  const peopleByHousehold = new Map<string, SyntheticPerson[]>();
  for (const person of persons) {
    const entries = peopleByHousehold.get(person.householdId) ?? [];
    entries.push(person);
    peopleByHousehold.set(person.householdId, entries);
  }
  let targetHouseholds = 0;
  let singleParentTargetHouseholds = 0;
  let twoEarnerTargetHouseholds = 0;
  let targetParents = 0;
  let employedTargetParents = 0;
  for (const household of households) {
    if (!household.childAges.some((age) => age < 6)) continue;
    targetHouseholds += household.weight;
    if (household.householdType === "alleinerziehend") singleParentTargetHouseholds += household.weight;
    const adults = (peopleByHousehold.get(household.id) ?? []).filter((person) => person.age >= 18);
    const employedAdults = adults.filter((person) => person.employmentStatus === "erwerbstaetig");
    targetParents += adults.length * household.weight;
    employedTargetParents += employedAdults.length * household.weight;
    if (employedAdults.length >= 2) twoEarnerTargetHouseholds += household.weight;
  }
  const employed = persons.filter((person) => person.employmentStatus === "erwerbstaetig" && person.age >= 18 && person.age < 67);
  const employmentIncome = weightedSum(employed, (person) => person.grossEmploymentIncome, (person) => person.weight);
  const employedWeight = employed.reduce((sum, person) => sum + person.weight, 0);
  return {
    weightedPopulation: persons.reduce((sum, person) => sum + person.weight, 0),
    weightedHouseholds: households.reduce((sum, household) => sum + household.weight, 0),
    workingAge: persons.filter((person) => person.age >= 18 && person.age < 67).reduce((sum, person) => sum + person.weight, 0),
    employed: employedWeight,
    children: persons.filter((person) => person.age < 18).reduce((sum, person) => sum + person.weight, 0),
    seniors: persons.filter((person) => person.age >= 65).reduce((sum, person) => sum + person.weight, 0),
    targetHouseholds,
    singleParentTargetHouseholds,
    twoEarnerTargetHouseholds,
    targetParents,
    employedTargetParents,
    averageEmploymentIncome: employedWeight > 0 ? employmentIncome / employedWeight : 0,
    totalEmploymentIncomeBn: employmentIncome / 1_000_000_000,
  };
}

function resultFrom(
  input: EffectCalculationInput,
  definition: EffectModuleDefinition,
  aggregates: PopulationAggregates,
  values: {
    baseline?: number;
    direct?: number;
    indirect?: number;
    longTerm?: number;
    feedback?: number;
    uncertainty?: number;
    affectedPersons?: number;
    affectedHouseholds?: number;
    nonMonetary?: EffectNonMonetaryMeasure[];
    groups?: string[];
    warnings?: string[];
    assumptions?: string[];
    evidenceStatus?: EffectEvidenceStatus;
  } = {},
): EffectModuleResult {
  const baseline = values.baseline ?? 0;
  const direct = values.direct ?? 0;
  const indirect = values.indirect ?? 0;
  const longTerm = values.longTerm ?? 0;
  const feedback = values.feedback ?? 0;
  const uncertainty = values.uncertainty ?? 0.5;
  const central = direct + indirect + longTerm + feedback;
  const lower = central >= 0 ? central * (1 - uncertainty) : central * (1 + uncertainty);
  const upper = central >= 0 ? central * (1 + uncertainty) : central * (1 - uncertainty);
  const path = series(input, definition, baseline, direct, indirect + longTerm, feedback, uncertainty);
  return {
    moduleId: definition.id,
    title: definition.title,
    period: { fromYear: input.dataYear, toYear: input.dataYear + input.horizonYears },
    baselineValue: round(baseline),
    directEffect: round(direct),
    indirectEffect: round(indirect),
    longTermEffect: round(longTerm),
    feedbackEffect: round(feedback),
    totalEffect: round(central),
    lower: round(lower),
    central: round(central),
    upper: round(upper),
    affectedPersons: Math.round(values.affectedPersons ?? 0),
    affectedHouseholds: Math.round(values.affectedHouseholds ?? 0),
    monetaryEffect: round(central),
    nonMonetaryEffects: values.nonMonetary ?? [],
    relevantGroups: values.groups ?? [],
    evidenceStatus: values.evidenceStatus ?? definition.evidenceStatus,
    causality: definition.causality,
    warnings: [...definition.limitations, ...(values.warnings ?? [])],
    assumptions: values.assumptions ?? [],
    modelVersion: EFFECT_MODEL_VERSION,
    populationRunId: input.populationRunId,
    scenarioId: input.scenarioId,
    timeSeries: path,
  };
}

export function calculateEffectRun(
  input: EffectCalculationInput,
  persons: SyntheticPerson[],
  households: SyntheticHousehold[],
): EffectRun {
  const p = { ...defaultEffectParameters, ...input.parameters };
  const a = aggregatePopulation(persons, households);
  const behavior = modelScale(input.modelLevel);
  const longTerm = longScale(input.modelLevel);
  const taxRate = clamp(p["fiscal.taxContributionRatePct"] / 100, 0, 1);
  const results = new Map<string, EffectModuleResult>();

  const kita = effectRegistry.find((item) => item.id === "kita-betreuung")!;
  const baselinePlaces = a.targetHouseholds * 0.72;
  const additionalPlaces = baselinePlaces * p["kita.capacityChangePct"] / 100;
  const capacityCostBn = additionalPlaces * 15_000 / 1_000_000_000;
  const hoursCostBn = baselinePlaces * (p["kita.openingHoursChange"] / 39) * 7_500 / 1_000_000_000;
  const recoveredOutageHours = a.employedTargetParents * p["kita.outageDaysReduction"] * 6;
  const returners = Math.max(0, a.targetParents - a.employedTargetParents) * p["kita.returnToWorkSharePct"] / 100 * behavior;
  const expandedHoursFte = (recoveredOutageHours + a.employedTargetParents * Math.max(0, p["kita.openingHoursChange"]) * 45) / 1_600 * behavior;
  const additionalFte = returners * 0.65 + expandedHoursFte;
  const additionalIncomeBn = additionalFte * a.averageEmploymentIncome / 1_000_000_000;
  const kitaFeedback = additionalIncomeBn * taxRate;
  const kitaResult = resultFrom(input, kita, a, {
    baseline: 0,
    direct: -(capacityCostBn + hoursCostBn),
    indirect: input.modelLevel === "statisch" ? 0 : additionalIncomeBn,
    longTerm: input.modelLevel === "langfrist" ? additionalIncomeBn * 0.18 : 0,
    feedback: input.modelLevel === "statisch" ? 0 : kitaFeedback,
    uncertainty: input.modelLevel === "langfrist" ? 0.7 : input.modelLevel === "verhalten" ? 0.45 : 0.2,
    affectedPersons: a.targetParents,
    affectedHouseholds: a.targetHouseholds,
    nonMonetary: [
      { label: "Modellierte zusätzliche Plätze", value: Math.round(additionalPlaces), unit: "Plätze" },
      { label: "Wiedergewonnene Arbeitsstunden", value: Math.round(recoveredOutageHours * behavior), unit: "Stunden/Jahr" },
      { label: "Zusätzliche Beschäftigung", value: Math.round(additionalFte), unit: "Vollzeitäquivalente" },
      { label: "Modellierte Rückkehr in Beschäftigung", value: Math.round(returners), unit: "Personen" },
    ],
    groups: ["Haushalte mit Kindern unter 6", "Alleinerziehende", "Zwei-Erwerbspersonen-Haushalte", "Teilzeitbeschäftigte"],
    assumptions: ["Baseline-Betreuungsquote 72 %", "15.000 € jährliche Kosten je zusätzlichem Platz", "1.600 Arbeitsstunden je Vollzeitäquivalent"],
  });
  results.set(kita.id, kitaResult);

  const labour = effectRegistry.find((item) => item.id === "arbeitsvolumen")!;
  const labourFte = additionalFte * (0.65 + p["labour.participationElasticity"]) * behavior;
  const labourIncomeBn = labourFte * a.averageEmploymentIncome / 1_000_000_000;
  results.set(labour.id, resultFrom(input, labour, a, {
    indirect: labourIncomeBn,
    longTerm: labourIncomeBn * 0.25 * longTerm,
    feedback: labourIncomeBn * taxRate,
    uncertainty: input.modelLevel === "langfrist" ? 0.65 : 0.5,
    affectedPersons: a.targetParents,
    affectedHouseholds: a.targetHouseholds,
    nonMonetary: [
      { label: "Zusätzliches Arbeitsvolumen", value: Math.round(labourFte * 1_600), unit: "Stunden/Jahr" },
      { label: "Zusätzliche Beschäftigung", value: Math.round(labourFte), unit: "Vollzeitäquivalente" },
    ],
    groups: ["Eltern mit Betreuungslücke", "Teilzeitbeschäftigte", "Nichterwerbstätige im Erwerbsalter"],
    assumptions: ["Arbeitsangebot reagiert nur in Verhalten und langfristig", `Partizipationselastizität ${p["labour.participationElasticity"]}`],
  }));

  const sickness = effectRegistry.find((item) => item.id === "krankheitstage")!;
  const savedHours = a.employed * p["sickness.daysReduction"] * 7.5 * behavior;
  const sicknessFte = savedHours / 1_600;
  const sicknessOutputBn = sicknessFte * a.averageEmploymentIncome / 1_000_000_000;
  results.set(sickness.id, resultFrom(input, sickness, a, {
    indirect: sicknessOutputBn,
    feedback: sicknessOutputBn * taxRate * 0.5,
    uncertainty: 0.55,
    affectedPersons: a.employed,
    nonMonetary: [
      { label: "Vermiedene Ausfalltage", value: Math.round(a.employed * p["sickness.daysReduction"] * behavior), unit: "Tage/Jahr" },
      { label: "Wiedergewonnene Arbeitsstunden", value: Math.round(savedHours), unit: "Stunden/Jahr" },
    ],
    groups: ["Erwerbstätige"],
    assumptions: ["7,5 Stunden je vermiedenem Arbeitstag", "Nur die vorgegebene Tagesänderung wird bewertet"],
  }));

  const productivity = effectRegistry.find((item) => item.id === "produktivitaet")!;
  const productivityBase = a.totalEmploymentIncomeBn;
  const cumulativeProductivity = input.modelLevel === "langfrist"
    ? productivityBase * (Math.pow(1 + p["productivity.annualUpliftPct"] / 100, input.horizonYears) - 1)
    : 0;
  results.set(productivity.id, resultFrom(input, productivity, a, {
    baseline: productivityBase,
    longTerm: cumulativeProductivity,
    feedback: cumulativeProductivity * taxRate,
    uncertainty: 0.7,
    affectedPersons: a.employed,
    warnings: input.modelLevel !== "langfrist" ? ["In dieser Modellstufe wird kein Produktivitätspfad berechnet."] : [],
    assumptions: [`Jährlicher zusätzlicher Impuls ${p["productivity.annualUpliftPct"]} %`, "Erwerbseinkommen dient nur als skalierende Basis"],
  }));

  const education = effectRegistry.find((item) => item.id === "bildung-qualifikation")!;
  const qualified = a.children * p["education.qualificationGainPct"] / 100 * longTerm;
  results.set(education.id, resultFrom(input, education, a, {
    affectedPersons: a.children,
    uncertainty: 0.8,
    nonMonetary: [{ label: "Zusätzliche qualifizierende Abschlüsse", value: Math.round(qualified), unit: "Personen einer Kohorte" }],
    groups: ["Kinder und Jugendliche"],
    warnings: input.horizonYears < 10 ? ["Der gewählte Horizont ist kürzer als die angenommene Bildungswirkung."] : [],
    assumptions: [`Zusätzlicher Qualifikationsanteil ${p["education.qualificationGainPct"]} %`, "Keine monetäre Punktbewertung"],
  }));

  const admin = effectRegistry.find((item) => item.id === "verwaltung-buerokratie")!;
  const affectedAdminHouseholds = a.weightedHouseholds * 0.35;
  const savedAdminHours = affectedAdminHouseholds * p["administration.hoursSavedPerHousehold"] * (input.modelLevel === "statisch" ? 0 : 1);
  const timeValueBn = savedAdminHours * 30 / 1_000_000_000;
  results.set(admin.id, resultFrom(input, admin, a, {
    direct: -0.4,
    indirect: timeValueBn,
    uncertainty: 0.6,
    affectedHouseholds: affectedAdminHouseholds,
    nonMonetary: [{ label: "Vermiedener Bürokratieaufwand", value: Math.round(savedAdminHours), unit: "Stunden/Jahr" }],
    groups: ["Betroffene Haushalte", "Verwaltung"],
    assumptions: ["35 % der Haushalte betroffen", "30 € modellierter Zeitwert je Stunde", "0,4 Mrd. € Einführungskosten"],
  }));

  for (const id of ["migration-integration", "geburten-demografie", "altersausgaben"] as const) {
    const definition = effectRegistry.find((item) => item.id === id)!;
    const affected = id === "altersausgaben" ? a.seniors : id === "geburten-demografie" ? a.weightedPopulation : 0;
    results.set(id, resultFrom(input, definition, a, {
      affectedPersons: affected,
      evidenceStatus: definition.evidenceStatus,
      uncertainty: 1,
      warnings: ["Das Modul liefert bewusst keine monetäre Punktzahl."],
      nonMonetary: id === "altersausgaben" ? [{ label: "Gewichtete Bevölkerung ab 65", value: Math.round(a.seniors), unit: "Personen" }] : [],
    }));
  }

  const infrastructure = effectRegistry.find((item) => item.id === "infrastruktur-investition")!;
  const investment = p["infrastructure.investmentChangeBn"];
  const output = investment * p["infrastructure.outputMultiplier"] * behavior;
  results.set(infrastructure.id, resultFrom(input, infrastructure, a, {
    direct: -investment,
    indirect: input.modelLevel === "statisch" ? 0 : output * 0.35,
    longTerm: output * 0.65 * longTerm,
    feedback: output * taxRate * behavior,
    uncertainty: input.modelLevel === "statisch" ? 0.1 : 0.75,
    affectedPersons: a.weightedPopulation,
    assumptions: [`Investitionsänderung ${investment} Mrd. €/Jahr`, `Multiplikator ${p["infrastructure.outputMultiplier"]}`],
  }));

  const fiscal = effectRegistry.find((item) => item.id === "steuer-beitrag")!;
  const feedbackInputs = [kitaResult, results.get("arbeitsvolumen")!, results.get("krankheitstage")!, results.get("produktivitaet")!, results.get("infrastruktur-investition")!];
  const fiscalFeedback = feedbackInputs.reduce((sum, item) => sum + Math.max(0, item.feedbackEffect), 0);
  results.set(fiscal.id, resultFrom(input, fiscal, a, {
    feedback: input.modelLevel === "statisch" ? 0 : fiscalFeedback,
    uncertainty: input.modelLevel === "langfrist" ? 0.7 : 0.5,
    affectedPersons: feedbackInputs.reduce((max, item) => Math.max(max, item.affectedPersons), 0),
    warnings: ["Rückflüsse werden nicht automatisch dem statischen Budgetsaldo zugerechnet."],
    assumptions: [`Durchschnittliche Abgabenquote ${p["fiscal.taxContributionRatePct"]} %`, "Nur positive modellierte Einkommens- und Wertschöpfungsimpulse"],
  }));

  const ordered = effectRegistry.map((definition) => results.get(definition.id) ?? resultFrom(input, definition, a));
  const safeScenario = input.scenarioId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  const safePopulation = input.populationRunId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return {
    id: `effect-${safeScenario}-${safePopulation}`,
    scenarioId: input.scenarioId,
    populationRunId: input.populationRunId,
    modelVersion: EFFECT_MODEL_VERSION,
    modelLevel: input.modelLevel,
    horizonYears: input.horizonYears,
    dataYear: input.dataYear,
    legalYear: input.legalYear,
    createdAt: new Date().toISOString(),
    parameters: p,
    moduleResults: ordered,
    warnings: [
      "Alle Ergebnisse sind Szenariorechnungen und keine sicheren Prognosen.",
      "Korrelation, externe Evidenz, Annahme und modellierte Wirkung werden getrennt gekennzeichnet.",
      "Langfristige Bandbreiten sind bewusst breit; nicht ausreichend belegte Bereiche bleiben unberechnet.",
    ],
  };
}
