import type { IncomeTaxResult } from "./income-tax";
import {
  expenseModuleForLineId,
  expenseLineResultsById,
  expenseModuleDefinitions,
  expenseModuleIds,
  type ExpenseModuleId,
  type ExpenseModuleResult,
} from "./expense-modules";
import {
  revenueModuleDefinitions,
  revenueModuleIds,
  type RevenueModuleId,
  type RevenueModuleResult,
} from "./revenue-modules";
import { expenseItems, revenueItems } from "./sim-data";

export type BudgetRevenueLine = (typeof revenueItems)[number] & {
  value: number | null;
  delta: number | null;
  available: boolean;
};

export type BudgetExpenseLine = (typeof expenseItems)[number] & {
  value: number | null;
  delta: number | null;
  available: boolean;
};

export interface BudgetSummary {
  revenueLines: BudgetRevenueLine[];
  expenseLines: BudgetExpenseLine[];
  revenueBaseline: number;
  expenseBaseline: number;
  balanceBaseline: number;
  revenueTotal: number | null;
  expenseTotal: number | null;
  balance: number | null;
  revenueDelta: number | null;
  expenseDelta: number | null;
  balanceDelta: number | null;
  isComplete: boolean;
  missingRevenueModules: string[];
  missingExpenseModules: string[];
}

export function calculateBudgetSummary({
  incomeTaxResult,
  revenueModules,
  expenseModules,
}: {
  incomeTaxResult: IncomeTaxResult;
  revenueModules: RevenueModuleResult[];
  expenseModules: ExpenseModuleResult[];
}): BudgetSummary {
  const revenueById = new Map(revenueModules.map((result) => [result.id, result]));
  const expenseById = new Map(expenseModules.map((result) => [result.id, result]));
  const expenseLinesById = expenseLineResultsById(expenseModules);
  const missingRevenueModules = revenueModuleIds
    .filter((id) => {
      const result = revenueById.get(id);
      return !result || !Number.isFinite(result.value) || !Number.isFinite(result.delta);
    })
    .map((id) => revenueModuleDefinitions.find((item) => item.id === id)?.label ?? id);
  const missingExpenseIds = new Set<ExpenseModuleId>(expenseModuleIds.filter((id) => !expenseById.has(id)));

  const mappedExpenseLines = new Set(Object.keys(expenseModuleForLineId));
  const revenueLines: BudgetRevenueLine[] = revenueItems.map((item) => {
    if (item.id === "est") {
      return { ...item, value: incomeTaxResult.value, delta: incomeTaxResult.delta, available: true };
    }
    if ((revenueModuleIds as readonly string[]).includes(item.id)) {
      const result = revenueById.get(item.id as RevenueModuleId);
      const available = Boolean(result && Number.isFinite(result.value) && Number.isFinite(result.delta));
      return {
        ...item,
        value: available ? result?.value ?? null : null,
        delta: available ? result?.delta ?? null : null,
        available,
      };
    }
    return { ...item, value: item.statusQuo, delta: 0, available: true };
  });

  const expenseLines: BudgetExpenseLine[] = expenseItems.map((item) => {
    const mappedLine = expenseLinesById[item.id];
    const expectedModule = expenseModuleForLineId[item.id];
    const hasFiniteLine = Boolean(mappedLine && Number.isFinite(mappedLine.value) && Number.isFinite(mappedLine.delta));
    const available = !mappedExpenseLines.has(item.id) || Boolean(hasFiniteLine && (!expectedModule || mappedLine?.moduleId === expectedModule));
    if (!available && expectedModule) missingExpenseIds.add(expectedModule);
    return {
      ...item,
      value: available ? mappedLine?.value ?? item.statusQuo : null,
      delta: available ? mappedLine?.delta ?? 0 : null,
      available,
    };
  });
  const missingExpenseModules = Array.from(missingExpenseIds)
    .map((id) => expenseModuleDefinitions.find((item) => item.id === id)?.label ?? id);

  const isComplete = revenueLines.every((item) => item.available) && expenseLines.every((item) => item.available);
  const revenueBaseline = revenueItems.reduce((total, item) => total + item.statusQuo, 0);
  const expenseBaseline = expenseItems.reduce((total, item) => total + item.statusQuo, 0);
  const revenueTotal = revenueLines.every((item) => item.value !== null)
    ? revenueLines.reduce((total, item) => total + (item.value ?? 0), 0)
    : null;
  const expenseTotal = expenseLines.every((item) => item.value !== null)
    ? expenseLines.reduce((total, item) => total + (item.value ?? 0), 0)
    : null;
  const balance = revenueTotal !== null && expenseTotal !== null ? revenueTotal - expenseTotal : null;
  const balanceBaseline = revenueBaseline - expenseBaseline;

  return {
    revenueLines,
    expenseLines,
    revenueBaseline,
    expenseBaseline,
    balanceBaseline,
    revenueTotal,
    expenseTotal,
    balance,
    revenueDelta: revenueTotal === null ? null : revenueTotal - revenueBaseline,
    expenseDelta: expenseTotal === null ? null : expenseTotal - expenseBaseline,
    balanceDelta: balance === null ? null : balance - balanceBaseline,
    isComplete,
    missingRevenueModules,
    missingExpenseModules,
  };
}

