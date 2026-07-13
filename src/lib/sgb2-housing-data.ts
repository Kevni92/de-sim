import type {
  HousingAllowanceDataset,
  HousingHeatingLimitRule,
  Sgb2HeatingEnergySource,
  Sgb2Parameter,
  Sgb2ParameterUnit,
} from "./sgb2-contracts";
import { SGB2_HOUSING_SCHEMA_VERSION, SGB2_SOURCE_IDS } from "./sgb2-contracts";

export const BERLIN_2026_HOUSING_DATASET_ID = "sgb2-kdu-berlin-2026";

const VALID_FROM = "2026-01-01";
const PUBLICATION_DATE = "2025-12-10";
const PREFIX = "sgb2.housing.berlin-2026";

type OfficialEnergySource = Exclude<Sgb2HeatingEnergySource, "unknown">;
type HeatingValues = readonly [number, number, number, number, number, number];

interface HeatingBand {
  id: string;
  min: number;
  max?: number;
  values: HeatingValues;
}

function parameter(id: string, value: number, unit: Sgb2ParameterUnit): Sgb2Parameter<number> {
  return {
    id,
    value,
    unit,
    validFrom: VALID_FROM,
    validTo: null,
    legalStatusDate: VALID_FROM,
    dataStatusDate: PUBLICATION_DATE,
    sourceId: SGB2_SOURCE_IDS.housingBerlin2026,
    evidenceClass: "gesetz",
    uncertaintyClass: "niedrig",
    roundingRule: unit === "cent-pro-monat" ? "keine" : "kaufmaennisch-cent",
    notes: "Amtlicher Richt- beziehungsweise Grenzwert der Berliner AV-Wohnen, gültig ab 01.01.2026.",
    constraints: { min: 0, max: unit === "quadratmeter" ? 5_000 : 1_000_000, integer: true },
  };
}

const floorAreaValues = [50, 65, 80, 90, 102] as const;
const grossColdRentValues = [44_900, 54_340, 66_880, 75_240, 90_372] as const;
const additionalFloorArea = 12;
const additionalGrossColdRent = 10_632;

const heatingTable: Record<OfficialEnergySource, HeatingBand[]> = {
  "heating-oil": [
    { id: "100-250", min: 100, max: 250, values: [10_900, 14_170, 17_440, 19_620, 22_236, 2_616] },
    { id: "251-500", min: 251, max: 500, values: [10_150, 13_195, 16_240, 18_270, 20_706, 2_436] },
    { id: "501-1000", min: 501, max: 1_000, values: [9_450, 12_285, 15_120, 17_010, 19_278, 2_268] },
    { id: "over-1000", min: 1_001, values: [9_050, 11_765, 14_480, 16_290, 18_462, 2_172] },
  ],
  "natural-gas": [
    { id: "100-250", min: 100, max: 250, values: [13_300, 17_290, 21_280, 23_940, 27_132, 3_192] },
    { id: "251-500", min: 251, max: 500, values: [12_350, 16_055, 19_760, 22_230, 25_194, 2_964] },
    { id: "501-1000", min: 501, max: 1_000, values: [11_500, 14_950, 18_400, 20_700, 23_460, 2_760] },
    { id: "over-1000", min: 1_001, values: [11_000, 14_300, 17_600, 19_800, 22_440, 2_640] },
  ],
  "district-heating": [
    { id: "100-250", min: 100, max: 250, values: [10_200, 13_260, 16_320, 18_360, 20_808, 2_448] },
    { id: "251-500", min: 251, max: 500, values: [9_950, 12_935, 15_920, 17_910, 20_298, 2_388] },
    { id: "501-1000", min: 501, max: 1_000, values: [9_800, 12_740, 15_680, 17_640, 19_992, 2_352] },
    { id: "over-1000", min: 1_001, values: [9_650, 12_545, 15_440, 17_370, 19_686, 2_316] },
  ],
  "heat-pump": [
    { id: "100-250", min: 100, max: 250, values: [12_100, 15_730, 19_360, 21_780, 24_684, 2_904] },
    { id: "251-500", min: 251, max: 500, values: [12_450, 16_185, 19_920, 22_410, 25_398, 2_988] },
    { id: "501-1000", min: 501, max: 1_000, values: [11_750, 15_275, 18_800, 21_150, 23_970, 2_820] },
    { id: "over-1000", min: 1_001, values: [11_550, 15_015, 18_480, 20_790, 23_562, 2_772] },
  ],
};

function floorAreaParameterId(size: number | "additional") {
  return `${PREFIX}.floor-area.${size === "additional" ? "additional-person" : `hh${size}`}`;
}

function grossColdRentParameterId(size: number | "additional") {
  return `${PREFIX}.gross-cold-rent.${size === "additional" ? "additional-person" : `hh${size}`}`;
}

function heatingParameterId(energy: OfficialEnergySource, band: string, size: number | "additional") {
  return `${PREFIX}.heating.${energy}.${band}.${size === "additional" ? "additional-person" : `hh${size}`}`;
}

const heatingRules: HousingHeatingLimitRule[] = Object.entries(heatingTable).flatMap(([energy, bands]) =>
  bands.map((band) => ({
    id: `berlin-heating-${energy}-${band.id}`,
    energySource: energy as OfficialEnergySource,
    buildingAreaMin: band.min,
    buildingAreaMax: band.max,
    monthlyLimitParameterIds: [1, 2, 3, 4, 5].map((size) => heatingParameterId(energy as OfficialEnergySource, band.id, size)) as [string, string, string, string, string],
    additionalPersonLimitParameterId: heatingParameterId(energy as OfficialEnergySource, band.id, "additional"),
  })),
);

export const berlin2026HousingParameters: Sgb2Parameter[] = [
  ...floorAreaValues.map((value, index) => parameter(floorAreaParameterId(index + 1), value, "quadratmeter")),
  parameter(floorAreaParameterId("additional"), additionalFloorArea, "quadratmeter"),
  ...grossColdRentValues.map((value, index) => parameter(grossColdRentParameterId(index + 1), value, "cent-pro-monat")),
  parameter(grossColdRentParameterId("additional"), additionalGrossColdRent, "cent-pro-monat"),
  ...Object.entries(heatingTable).flatMap(([energy, bands]) => bands.flatMap((band) => [
    ...band.values.slice(0, 5).map((value, index) => parameter(heatingParameterId(energy as OfficialEnergySource, band.id, index + 1), value, "cent-pro-monat")),
    parameter(heatingParameterId(energy as OfficialEnergySource, band.id, "additional"), band.values[5], "cent-pro-monat"),
  ])),
];

export const berlin2026HousingDataset: HousingAllowanceDataset = {
  id: BERLIN_2026_HOUSING_DATASET_ID,
  schemaVersion: SGB2_HOUSING_SCHEMA_VERSION,
  regionId: "berlin",
  providerId: "berlin",
  validFrom: VALID_FROM,
  validTo: null,
  publicationDate: PUBLICATION_DATE,
  method: "Berliner AV-Wohnen 2026: Richtwerte der Bruttokaltmiete und getrennte Heizkostengrenzen nach Bedarfsgemeinschaftsgröße, Energieträger und beheizter Gebäudefläche.",
  sourceId: SGB2_SOURCE_IDS.housingBerlin2026,
  evidenceClass: "gesetz",
  uncertaintyClass: "niedrig",
  status: "active",
  rules: [
    ...[1, 2, 3, 4].map((size) => ({
      id: `berlin-hh${size}`,
      householdSizeMin: size,
      householdSizeMax: size,
      adequateFloorAreaParameterId: floorAreaParameterId(size),
      grossColdRentLimitParameterId: grossColdRentParameterId(size),
      hardshipRuleIds: [],
    })),
    {
      id: "berlin-hh5plus",
      householdSizeMin: 5,
      adequateFloorAreaParameterId: floorAreaParameterId(5),
      grossColdRentLimitParameterId: grossColdRentParameterId(5),
      additionalPersonFromHouseholdSize: 5,
      additionalPersonAdequateFloorAreaParameterId: floorAreaParameterId("additional"),
      additionalPersonGrossColdRentLimitParameterId: grossColdRentParameterId("additional"),
      hardshipRuleIds: [],
    },
  ],
  heatingRules,
};
