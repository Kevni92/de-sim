import type { IncomeTaxSettings, ModelLevel } from "./types";

export const baselineIncomeTax: IncomeTaxSettings = {
  allowance: 11_784,
  entryRate: 14,
  topRate: 42,
  topThreshold: 66_761,
  richRate: 45,
  childAllowance: 6_384,
  spouseSplitting: true,
};

export const revenueItems = [
  { id: "est", label: "Einkommensteuer", statusQuo: 358.2, icon: "wallet", confidence: "mittel" as const, interactive: true },
  { id: "ust", label: "Umsatzsteuer", statusQuo: 291.4, icon: "shopping", confidence: "hoch" as const },
  { id: "kst", label: "Körperschaftsteuer", statusQuo: 46.1, icon: "building", confidence: "hoch" as const },
  { id: "gewst", label: "Gewerbesteuer", statusQuo: 75.3, icon: "factory", confidence: "hoch" as const },
  { id: "kap", label: "Kapitalerträge", statusQuo: 9.8, icon: "trending", confidence: "mittel" as const },
  { id: "erb", label: "Erbschaftsteuer", statusQuo: 11.8, icon: "scroll", confidence: "mittel" as const },
  { id: "verm", label: "Vermögensteuer", statusQuo: 0, icon: "gem", confidence: "niedrig" as const, note: "derzeit nicht erhoben" },
  { id: "grund", label: "Grundsteuer", statusQuo: 15.5, icon: "home", confidence: "hoch" as const },
  { id: "energie", label: "Energie- und Verbrauchsteuern", statusQuo: 63.2, icon: "fuel", confidence: "hoch" as const },
  { id: "sozb", label: "Sozialbeiträge", statusQuo: 620, icon: "coins", confidence: "hoch" as const },
  { id: "geb", label: "Gebühren und Sonstige", statusQuo: 42.6, icon: "receipt", confidence: "mittel" as const },
  { id: "kredit", label: "Nettokreditaufnahme", statusQuo: 39, icon: "landmark", confidence: "niedrig" as const },
];

export const expenseItems = [
  { id: "rente", label: "Rente", statusQuo: 128.4, icon: "armchair", confidence: "hoch" as const },
  { id: "gesundheit", label: "Gesundheit", statusQuo: 92.1, icon: "stethoscope", confidence: "hoch" as const },
  { id: "pflege", label: "Pflege", statusQuo: 61.7, icon: "heart", confidence: "hoch" as const },
  { id: "buerger", label: "Bürgergeld", statusQuo: 46.9, icon: "hand", confidence: "hoch" as const },
  { id: "familie", label: "Familienleistungen", statusQuo: 55.3, icon: "users", confidence: "hoch" as const },
  { id: "bildung", label: "Bildung", statusQuo: 22.6, icon: "graduation", confidence: "mittel" as const },
  { id: "kita", label: "Kitas", statusQuo: 8.4, icon: "baby", confidence: "mittel" as const },
  { id: "infra", label: "Infrastruktur", statusQuo: 34.1, icon: "train", confidence: "mittel" as const },
  { id: "vert", label: "Verteidigung", statusQuo: 71.8, icon: "shield", confidence: "hoch" as const },
  { id: "innsich", label: "Innere Sicherheit", statusQuo: 14.5, icon: "shieldcheck", confidence: "hoch" as const },
  { id: "wohnen", label: "Wohnen", statusQuo: 6.9, icon: "building", confidence: "mittel" as const },
  { id: "klima", label: "Klima und Energie", statusQuo: 27.4, icon: "leaf", confidence: "mittel" as const },
  { id: "wirt", label: "Wirtschaftsförderung", statusQuo: 11.2, icon: "briefcase", confidence: "mittel" as const },
  { id: "sub", label: "Subventionen", statusQuo: 41.7, icon: "percent", confidence: "niedrig" as const, note: "Steuervergünstigungen" },
  { id: "migration", label: "Migration und Asyl", statusQuo: 29.8, icon: "globe", confidence: "niedrig" as const },
  { id: "verw", label: "Verwaltung", statusQuo: 42, icon: "file", confidence: "hoch" as const },
  { id: "eu", label: "EU-Beitrag", statusQuo: 34.6, icon: "stars", confidence: "hoch" as const },
  { id: "zinsen", label: "Zinsen", statusQuo: 39.2, icon: "badgepercent", confidence: "hoch" as const },
];

export const households = [
  { name: "Single", income: "2.500 € brutto / Monat", delta: 18, reason: "vom höheren Grundfreibetrag profitiert" },
  { name: "Alleinerziehend", income: "1 Kind · 2.200 € brutto", delta: 31, reason: "Grund- und Kinderfreibetrag kombiniert wirken" },
  { name: "Paar mit zwei Kindern", income: "5.500 € brutto gemeinsam", delta: 56, reason: "Freibeträge und Splitting berücksichtigt werden" },
  { name: "Hoheinkommen", income: "12.000 € brutto / Monat", delta: -74, reason: "die höhere Tarifwirkung überwiegt" },
];

export const deciles = [
  { d: "D1", statusQuo: 0, reform: 4 },
  { d: "D2", statusQuo: 3, reform: 12 },
  { d: "D3", statusQuo: 8, reform: 22 },
  { d: "D4", statusQuo: 11, reform: 34 },
  { d: "D5", statusQuo: 14, reform: 49 },
  { d: "D6", statusQuo: 18, reform: 68 },
  { d: "D7", statusQuo: 22, reform: 91 },
  { d: "D8", statusQuo: 25, reform: 112 },
  { d: "D9", statusQuo: 28, reform: 74 },
  { d: "D10", statusQuo: 31, reform: -38 },
];

export function estimateIncomeTaxRevenue(settings: IncomeTaxSettings, model: ModelLevel) {
  const base = 358.2;
  const dAllowance = (settings.allowance - baselineIncomeTax.allowance) * -0.00035;
  const dEntry = (settings.entryRate - baselineIncomeTax.entryRate) * 3.1;
  const dTop = (settings.topRate - baselineIncomeTax.topRate) * 4.2;
  const dThreshold = (settings.topThreshold - baselineIncomeTax.topThreshold) * -0.00028;
  const dRich = (settings.richRate - baselineIncomeTax.richRate) * 0.9;
  const dSplitting = settings.spouseSplitting ? 0 : 18.6;
  const dChild = (settings.childAllowance - baselineIncomeTax.childAllowance) * -0.00021;
  let delta = dAllowance + dEntry + dTop + dThreshold + dRich + dSplitting + dChild;
  if (model === "verhalten") delta *= 0.9;
  if (model === "langfrist") delta *= 0.75;
  return { value: base + delta, delta };
}

export function fmtBn(value: number) {
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mrd. €`;
}

export function fmtDiff(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${Math.abs(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mrd. €`;
}
