import type { IncomeTaxSettings, ModelLevel } from "./types";

export const INCOME_TAX_LEGAL_YEAR = 2026;
export const BASELINE_INCOME_TAX_REVENUE_BN = 358.2;
export const BASELINE_CHILD_ALLOWANCE = 9_756;
export const BASELINE_TAX_UNITS_M = 42;

export const statutoryIncomeTax2026: IncomeTaxSettings = {
  allowance: 12_348,
  entryRate: 14,
  topRate: 42,
  topThreshold: 69_879,
  richRate: 45,
  childAllowance: BASELINE_CHILD_ALLOWANCE,
  spouseSplitting: true,
};

export interface IncomeTaxCurvePoint {
  taxableIncome: number;
  baselineTax: number;
  reformTax: number;
  baselineMarginalRate: number;
  reformMarginalRate: number;
}

export interface IncomeTaxDecileResult {
  id: string;
  label: string;
  representativeIncome: number;
  monthlyChange: number;
  lowerMonthlyChange: number;
  upperMonthlyChange: number;
  winnersM: number;
  losersM: number;
}

export interface IncomeTaxHouseholdResult {
  id: string;
  name: string;
  description: string;
  taxableIncomeBeforeChildren: number;
  children: number;
  joint: boolean;
  baselineTax: number;
  reformTax: number;
  annualChange: number;
  monthlyChange: number;
}

export interface IncomeTaxResult {
  legalYear: 2026;
  modelLevel: ModelLevel;
  baselineValue: number;
  value: number;
  delta: number;
  staticValue: number;
  staticDelta: number;
  behavioralAdjustment: number;
  winnersM: number;
  losersM: number;
  neutralM: number;
  medianMonthlyChange: number;
  averageMonthlyChange: number;
  taxUnitsM: number;
  calibrationFactor: number;
  deciles: IncomeTaxDecileResult[];
  households: IncomeTaxHouseholdResult[];
  curve: IncomeTaxCurvePoint[];
}

interface PopulationCell {
  decile: number;
  taxableIncomeBeforeChildren: number;
  unitsM: number;
  joint: boolean;
  partnerShare: number;
  children: number;
}

const DECILE_PROFILES = [
  { income: 8_000, jointShare: 0.12, children: 0.08 },
  { income: 14_000, jointShare: 0.18, children: 0.12 },
  { income: 22_000, jointShare: 0.24, children: 0.18 },
  { income: 30_000, jointShare: 0.3, children: 0.24 },
  { income: 39_000, jointShare: 0.36, children: 0.3 },
  { income: 49_000, jointShare: 0.42, children: 0.36 },
  { income: 61_000, jointShare: 0.48, children: 0.4 },
  { income: 78_000, jointShare: 0.54, children: 0.42 },
  { income: 105_000, jointShare: 0.58, children: 0.38 },
  { income: 220_000, jointShare: 0.52, children: 0.28 },
] as const;

const WITHIN_DECILE_MULTIPLIERS = [0.78, 0.9, 1, 1.12, 1.28] as const;

function createReferencePopulation(): PopulationCell[] {
  const cells: PopulationCell[] = [];
  DECILE_PROFILES.forEach((profile, decileIndex) => {
    WITHIN_DECILE_MULTIPLIERS.forEach((multiplier, pointIndex) => {
      const joint = pointIndex / WITHIN_DECILE_MULTIPLIERS.length < profile.jointShare;
      const children = pointIndex / WITHIN_DECILE_MULTIPLIERS.length < profile.children
        ? (decileIndex >= 4 && pointIndex === 0 ? 2 : 1)
        : 0;
      cells.push({
        decile: decileIndex + 1,
        taxableIncomeBeforeChildren: Math.round(profile.income * multiplier),
        unitsM: BASELINE_TAX_UNITS_M / 50,
        joint,
        partnerShare: 0.6,
        children,
      });
    });
  });
  return cells;
}

const REFERENCE_POPULATION = createReferencePopulation();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function floorEuro(value: number) {
  return Math.floor(Math.max(0, value));
}

function statutoryTaxContinuous2026(taxableIncome: number) {
  const zve = floorEuro(taxableIncome);
  if (zve <= 12_348) return 0;
  if (zve <= 17_799) {
    const y = (zve - 12_348) / 10_000;
    return (914.51 * y + 1_400) * y;
  }
  if (zve <= 69_878) {
    const z = (zve - 17_799) / 10_000;
    return (173.1 * z + 2_397) * z + 1_034.87;
  }
  if (zve <= 277_825) return 0.42 * zve - 11_135.63;
  return 0.45 * zve - 19_470.38;
}

export function calculateStatutoryIncomeTax2026(taxableIncome: number, joint = false) {
  if (!joint) return Math.floor(statutoryTaxContinuous2026(taxableIncome));
  const halfIncome = floorEuro(taxableIncome / 2);
  return 2 * Math.floor(statutoryTaxContinuous2026(halfIncome));
}

export function statutoryMarginalRate2026(taxableIncome: number) {
  const zve = Math.max(0, taxableIncome);
  if (zve <= 12_348) return 0;
  if (zve <= 17_799) {
    const y = (zve - 12_348) / 10_000;
    return clamp((2 * 914.51 * y + 1_400) / 100, 0, 100);
  }
  if (zve <= 69_878) {
    const z = (zve - 17_799) / 10_000;
    return clamp((2 * 173.1 * z + 2_397) / 100, 0, 100);
  }
  if (zve <= 277_825) return 42;
  return 45;
}

function reformShape(settings: IncomeTaxSettings) {
  const allowance = clamp(settings.allowance, 0, 40_000);
  const firstEnd = allowance + 5_451;
  const topThreshold = Math.max(firstEnd + 1, settings.topThreshold);
  const richThreshold = Math.max(277_826, topThreshold + 1);
  const entryRate = clamp(settings.entryRate, 0, 70) / 100;
  const topRate = clamp(settings.topRate, 0, 70) / 100;
  const richRate = clamp(settings.richRate, 0, 75) / 100;
  const middleRate = clamp(24, settings.entryRate, settings.topRate) / 100;
  return { allowance, firstEnd, topThreshold, richThreshold, entryRate, middleRate, topRate, richRate };
}

function integrateLinearRates(startRate: number, endRate: number, amount: number, width: number) {
  if (amount <= 0) return 0;
  const bounded = Math.min(amount, width);
  const slope = (endRate - startRate) / width;
  return startRate * bounded + 0.5 * slope * bounded * bounded;
}

function reformTaxContinuous(settings: IncomeTaxSettings, taxableIncome: number) {
  const zve = floorEuro(taxableIncome);
  const shape = reformShape(settings);
  if (zve <= shape.allowance) return 0;

  const firstWidth = shape.firstEnd - shape.allowance;
  const firstAmount = Math.min(zve - shape.allowance, firstWidth);
  let tax = integrateLinearRates(shape.entryRate, shape.middleRate, firstAmount, firstWidth);
  if (zve <= shape.firstEnd) return tax;

  const secondWidth = shape.topThreshold - shape.firstEnd;
  const secondAmount = Math.min(zve - shape.firstEnd, secondWidth);
  tax += integrateLinearRates(shape.middleRate, shape.topRate, secondAmount, secondWidth);
  if (zve <= shape.topThreshold) return tax;

  const topAmount = Math.min(zve, shape.richThreshold) - shape.topThreshold;
  tax += Math.max(0, topAmount) * shape.topRate;
  if (zve <= shape.richThreshold) return tax;

  tax += (zve - shape.richThreshold) * shape.richRate;
  return tax;
}

export function reformMarginalRate(settings: IncomeTaxSettings, taxableIncome: number) {
  const zve = Math.max(0, taxableIncome);
  const shape = reformShape(settings);
  if (zve <= shape.allowance) return 0;
  if (zve <= shape.firstEnd) {
    const progress = (zve - shape.allowance) / (shape.firstEnd - shape.allowance);
    return 100 * (shape.entryRate + progress * (shape.middleRate - shape.entryRate));
  }
  if (zve <= shape.topThreshold) {
    const progress = (zve - shape.firstEnd) / (shape.topThreshold - shape.firstEnd);
    return 100 * (shape.middleRate + progress * (shape.topRate - shape.middleRate));
  }
  if (zve <= shape.richThreshold) return 100 * shape.topRate;
  return 100 * shape.richRate;
}

export function calculateReformIncomeTax(
  settings: IncomeTaxSettings,
  taxableIncome: number,
  joint = false,
  partnerShare = 0.6,
) {
  if (!joint) return Math.floor(reformTaxContinuous(settings, taxableIncome));
  if (settings.spouseSplitting) {
    const halfIncome = floorEuro(taxableIncome / 2);
    return 2 * Math.floor(reformTaxContinuous(settings, halfIncome));
  }
  const firstIncome = floorEuro(taxableIncome * clamp(partnerShare, 0.5, 1));
  const secondIncome = floorEuro(taxableIncome - firstIncome);
  return Math.floor(reformTaxContinuous(settings, firstIncome)) + Math.floor(reformTaxContinuous(settings, secondIncome));
}

function taxableAfterChildAllowance(income: number, children: number, allowance: number) {
  return Math.max(0, income - Math.max(0, children) * Math.max(0, allowance));
}

function weightedMedian(values: Array<{ value: number; weight: number }>) {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= total / 2) return item.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

function behavioralIncome(
  income: number,
  baselineMarginalRate: number,
  reformMarginal: number,
  modelLevel: ModelLevel,
) {
  if (modelLevel === "statisch") return income;
  const baseElasticity = modelLevel === "verhalten" ? 0.15 : 0.3;
  const highIncomeFactor = income >= 100_000 ? 1.5 : income >= 60_000 ? 1.2 : 1;
  const elasticity = baseElasticity * highIncomeFactor;
  const baselineNetRate = Math.max(0.05, 1 - baselineMarginalRate / 100);
  const reformNetRate = Math.max(0.05, 1 - reformMarginal / 100);
  const response = clamp(elasticity * (reformNetRate / baselineNetRate - 1), modelLevel === "verhalten" ? -0.12 : -0.2, modelLevel === "verhalten" ? 0.12 : 0.2);
  return income * (1 + response);
}

function calculateCell(settings: IncomeTaxSettings, cell: PopulationCell, modelLevel: ModelLevel) {
  const baselineTaxable = taxableAfterChildAllowance(cell.taxableIncomeBeforeChildren, cell.children, BASELINE_CHILD_ALLOWANCE);
  const reformTaxable = taxableAfterChildAllowance(cell.taxableIncomeBeforeChildren, cell.children, settings.childAllowance);
  const baselineTax = calculateStatutoryIncomeTax2026(baselineTaxable, cell.joint);
  const staticReformTax = calculateReformIncomeTax(settings, reformTaxable, cell.joint, cell.partnerShare);
  const rateIncome = cell.joint ? reformTaxable / 2 : reformTaxable;
  const adjustedIncome = behavioralIncome(
    reformTaxable,
    statutoryMarginalRate2026(cell.joint ? baselineTaxable / 2 : baselineTaxable),
    reformMarginalRate(settings, rateIncome),
    modelLevel,
  );
  const modeledReformTax = calculateReformIncomeTax(settings, adjustedIncome, cell.joint, cell.partnerShare);
  return { baselineTax, staticReformTax, modeledReformTax, monthlyChange: (baselineTax - staticReformTax) / 12 };
}

const HOUSEHOLD_DEFINITIONS = [
  { id: "single", name: "Single", description: "36.000 € zu versteuerndes Einkommen", income: 36_000, children: 0, joint: false },
  { id: "single-parent", name: "Alleinerziehend", description: "28.000 € zvE vor Kinderfreibetrag · 1 Kind", income: 28_000, children: 1, joint: false },
  { id: "family", name: "Paar mit zwei Kindern", description: "66.000 € gemeinsames zvE vor Kinderfreibetrag", income: 66_000, children: 2, joint: true },
  { id: "high-income", name: "Hoheinkommen", description: "180.000 € zu versteuerndes Einkommen", income: 180_000, children: 0, joint: false },
] as const;

function calculateHouseholds(settings: IncomeTaxSettings): IncomeTaxHouseholdResult[] {
  return HOUSEHOLD_DEFINITIONS.map((household) => {
    const baselineTaxable = taxableAfterChildAllowance(household.income, household.children, BASELINE_CHILD_ALLOWANCE);
    const reformTaxable = taxableAfterChildAllowance(household.income, household.children, settings.childAllowance);
    const baselineTax = calculateStatutoryIncomeTax2026(baselineTaxable, household.joint);
    const reformTax = calculateReformIncomeTax(settings, reformTaxable, household.joint);
    const annualChange = baselineTax - reformTax;
    return {
      id: household.id,
      name: household.name,
      description: household.description,
      taxableIncomeBeforeChildren: household.income,
      children: household.children,
      joint: household.joint,
      baselineTax,
      reformTax,
      annualChange,
      monthlyChange: annualChange / 12,
    };
  });
}

function calculateCurve(settings: IncomeTaxSettings): IncomeTaxCurvePoint[] {
  return Array.from({ length: 61 }, (_, index) => {
    const taxableIncome = index * 5_000;
    return {
      taxableIncome,
      baselineTax: calculateStatutoryIncomeTax2026(taxableIncome),
      reformTax: calculateReformIncomeTax(settings, taxableIncome),
      baselineMarginalRate: statutoryMarginalRate2026(taxableIncome),
      reformMarginalRate: reformMarginalRate(settings, taxableIncome),
    };
  });
}

export function estimateIncomeTaxRevenue(settings: IncomeTaxSettings, modelLevel: ModelLevel): IncomeTaxResult {
  const staticCells = REFERENCE_POPULATION.map((cell) => ({ cell, result: calculateCell(settings, cell, "statisch") }));
  const modeledCells = REFERENCE_POPULATION.map((cell) => ({ cell, result: calculateCell(settings, cell, modelLevel) }));
  const baselineRawBn = staticCells.reduce((sum, item) => sum + item.result.baselineTax * item.cell.unitsM / 1_000, 0);
  const calibrationFactor = BASELINE_INCOME_TAX_REVENUE_BN / baselineRawBn;
  const staticValue = staticCells.reduce((sum, item) => sum + item.result.staticReformTax * item.cell.unitsM / 1_000, 0) * calibrationFactor;
  const value = modeledCells.reduce((sum, item) => sum + item.result.modeledReformTax * item.cell.unitsM / 1_000, 0) * calibrationFactor;

  const winnersM = staticCells.reduce((sum, item) => sum + (item.result.monthlyChange > 1 ? item.cell.unitsM : 0), 0);
  const losersM = staticCells.reduce((sum, item) => sum + (item.result.monthlyChange < -1 ? item.cell.unitsM : 0), 0);
  const neutralM = Math.max(0, BASELINE_TAX_UNITS_M - winnersM - losersM);
  const medianMonthlyChange = weightedMedian(staticCells.map((item) => ({ value: item.result.monthlyChange, weight: item.cell.unitsM })));
  const averageMonthlyChange = staticCells.reduce((sum, item) => sum + item.result.monthlyChange * item.cell.unitsM, 0) / BASELINE_TAX_UNITS_M;

  const deciles = DECILE_PROFILES.map((profile, index) => {
    const items = staticCells.filter((item) => item.cell.decile === index + 1);
    const changes = items.map((item) => item.result.monthlyChange);
    return {
      id: `D${index + 1}`,
      label: `Dezil ${index + 1}`,
      representativeIncome: profile.income,
      monthlyChange: items.reduce((sum, item) => sum + item.result.monthlyChange * item.cell.unitsM, 0) / items.reduce((sum, item) => sum + item.cell.unitsM, 0),
      lowerMonthlyChange: Math.min(...changes),
      upperMonthlyChange: Math.max(...changes),
      winnersM: items.reduce((sum, item) => sum + (item.result.monthlyChange > 1 ? item.cell.unitsM : 0), 0),
      losersM: items.reduce((sum, item) => sum + (item.result.monthlyChange < -1 ? item.cell.unitsM : 0), 0),
    };
  });

  return {
    legalYear: 2026,
    modelLevel,
    baselineValue: BASELINE_INCOME_TAX_REVENUE_BN,
    value,
    delta: value - BASELINE_INCOME_TAX_REVENUE_BN,
    staticValue,
    staticDelta: staticValue - BASELINE_INCOME_TAX_REVENUE_BN,
    behavioralAdjustment: value - staticValue,
    winnersM,
    losersM,
    neutralM,
    medianMonthlyChange,
    averageMonthlyChange,
    taxUnitsM: BASELINE_TAX_UNITS_M,
    calibrationFactor,
    deciles,
    households: calculateHouseholds(settings),
    curve: calculateCurve(settings),
  };
}
