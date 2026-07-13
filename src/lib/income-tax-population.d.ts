import "./income-tax";

declare module "./income-tax" {
  interface IncomeTaxResult {
    populationRunId?: string;
    populationSampleSize?: number;
    weightedPopulation?: number;
    populationDataYear?: number;
    calibrationStatus?: "innerhalb-toleranz" | "warnung";
  }
}
