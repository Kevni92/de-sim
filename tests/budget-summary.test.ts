import assert from "node:assert/strict";
import test from "node:test";
import { calculateBudgetSummary } from "../src/lib/budget-summary";
import { calculateExpenseModules, expenseParameterKey } from "../src/lib/expense-modules";
import { estimateIncomeTaxRevenue } from "../src/lib/income-tax";
import { calculateRevenueModules, revenueParameterKey } from "../src/lib/revenue-modules";
import { defaultScenarioDraft } from "../src/lib/scenario-state";
import { expenseItems, revenueItems } from "../src/lib/sim-data";

const incomeTaxResult = estimateIncomeTaxRevenue(defaultScenarioDraft.incomeTax, defaultScenarioDraft.modelLevel);

function summary(revenueChanges: Record<string, number> = {}, expenseChanges: Record<string, number> = {}) {
  return calculateBudgetSummary({
    incomeTaxResult,
    revenueModules: calculateRevenueModules(revenueChanges, defaultScenarioDraft.modelLevel),
    expenseModules: calculateExpenseModules(expenseChanges, defaultScenarioDraft.modelLevel),
  });
}

test("uses the displayed income and expense rows as the shared overview/comparison basis", () => {
  const totals = summary();
  assert.equal(totals.isComplete, true);
  assert.equal(totals.revenueBaseline, revenueItems.reduce((sum, item) => sum + item.statusQuo, 0));
  assert.equal(totals.expenseBaseline, expenseItems.reduce((sum, item) => sum + item.statusQuo, 0));
  assert.equal(totals.revenueTotal, totals.revenueLines.reduce((sum, item) => sum + (item.value ?? 0), 0));
  assert.equal(totals.expenseTotal, totals.expenseLines.reduce((sum, item) => sum + (item.value ?? 0), 0));
  assert.equal(totals.balance, (totals.revenueTotal ?? 0) - (totals.expenseTotal ?? 0));
});

test("includes a changed revenue module in the shared total without changing expenses", () => {
  const before = summary();
  const after = summary({ [revenueParameterKey("ust", "standardRate")]: 20 });
  assert.notEqual(after.revenueTotal, before.revenueTotal);
  assert.equal(after.expenseTotal, before.expenseTotal);
  assert.equal(after.balance, (after.revenueTotal ?? 0) - (after.expenseTotal ?? 0));
});

test("includes a changed expense module in the shared total without changing revenue", () => {
  const before = summary();
  const after = summary({}, { [expenseParameterKey("pension", "pensionValueIndex")]: 105 });
  assert.equal(after.revenueTotal, before.revenueTotal);
  assert.notEqual(after.expenseTotal, before.expenseTotal);
  assert.equal(after.balance, (after.revenueTotal ?? 0) - (after.expenseTotal ?? 0));
});

test("marks the aggregate unavailable when an active module result is missing", () => {
  const fullRevenueModules = calculateRevenueModules({}, defaultScenarioDraft.modelLevel);
  const fullExpenseModules = calculateExpenseModules({}, defaultScenarioDraft.modelLevel);
  const missingRevenue = calculateBudgetSummary({ incomeTaxResult, revenueModules: fullRevenueModules.filter((item) => item.id !== "ust"), expenseModules: fullExpenseModules });
  const missingExpense = calculateBudgetSummary({ incomeTaxResult, revenueModules: fullRevenueModules, expenseModules: fullExpenseModules.filter((item) => item.id !== "migration") });

  assert.equal(missingRevenue.revenueTotal, null);
  assert.equal(missingRevenue.balance, null);
  assert.equal(missingRevenue.isComplete, false);
  assert.equal(missingRevenue.revenueLines.find((item) => item.id === "ust")?.available, false);
  assert.ok(missingRevenue.missingRevenueModules.includes("Umsatzsteuer"));
  assert.equal(missingExpense.expenseTotal, null);
  assert.equal(missingExpense.balance, null);
  assert.equal(missingExpense.isComplete, false);
  assert.equal(missingExpense.expenseLines.find((item) => item.id === "migration")?.available, false);
  assert.ok(missingExpense.missingExpenseModules.includes("Migration und Asyl"));
});
