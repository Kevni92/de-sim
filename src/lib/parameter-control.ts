export interface FlexibleParameterSpec {
  key: string;
  label: string;
  baseline: number;
  sliderMin: number;
  sliderMax: number;
  validatedMin: number;
  validatedMax: number;
  hardMin: number;
  hardMax?: number;
  step: number;
  largeStep?: number;
  unit: string;
  description: string;
}

export interface ParameterRange {
  min: number;
  max: number;
}

export type ParameterValidation =
  | { valid: true; extrapolated: boolean; outsideStandardRange: boolean }
  | { valid: false; message: string };

export function parameterDecimalPlaces(step: number) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const [coefficient, exponentText] = step.toString().toLowerCase().split("e");
  const decimals = coefficient.includes(".") ? coefficient.length - coefficient.indexOf(".") - 1 : 0;
  return Math.min(10, Math.max(0, decimals - Number(exponentText ?? 0)));
}

/** Parse German grouped numbers and decimal commas without treating empty drafts as zero. */
export function parseLocalizedParameterValue(raw: string): number | null {
  const compact = raw.trim().replace(/[\s\u00a0\u202f]/g, "").replace(/[€%]/g, "");
  if (!compact || /^[+-]?$/.test(compact)) return null;

  const sign = compact.startsWith("-") ? -1 : 1;
  const unsigned = /^[+-]/.test(compact) ? compact.slice(1) : compact;
  if (!unsigned || !/^[\d.,]+$/.test(unsigned)) return null;

  let normalized: string;
  if (unsigned.includes(",")) {
    const commaParts = unsigned.split(",");
    if (commaParts.length !== 2 || !/^\d*$/.test(commaParts[1]) || commaParts[1].length === 0) return null;
    const integer = commaParts[0];
    if (integer.includes(".")) {
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(integer)) return null;
    } else if (!/^\d*$/.test(integer)) return null;
    normalized = `${integer.replace(/\./g, "") || "0"}.${commaParts[1]}`;
  } else if (unsigned.includes(".")) {
    const dotParts = unsigned.split(".");
    if (dotParts.length > 2) {
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(unsigned)) return null;
      normalized = unsigned.replace(/\./g, "");
    } else {
      const [integer, fraction] = dotParts;
      if (!fraction) return null;
      const looksLikeGermanGrouping = /^\d{1,3}$/.test(integer) && /^\d{3}$/.test(fraction);
      if (looksLikeGermanGrouping) normalized = `${integer}${fraction}`;
      else if (/^\d*$/.test(integer) && /^\d+$/.test(fraction)) normalized = `${integer || "0"}.${fraction}`;
      else return null;
    }
  } else {
    normalized = unsigned;
  }

  const value = sign * Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatParameterNumber(value: number, step: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: parameterDecimalPlaces(step),
  }).format(value);
}

export function formatParameterValue(value: number, spec: Pick<FlexibleParameterSpec, "step" | "unit">) {
  return `${formatParameterNumber(value, spec.step)} ${spec.unit}`;
}

export function validateParameterValue(value: number | null, spec: FlexibleParameterSpec): ParameterValidation {
  if (value === null || !Number.isFinite(value)) {
    return { valid: false, message: "Gib eine vollständige, endliche Zahl ein." };
  }
  if (value < spec.hardMin) {
    return { valid: false, message: `Der Wert muss mindestens ${formatParameterValue(spec.hardMin, spec)} betragen.` };
  }
  if (spec.hardMax !== undefined && value > spec.hardMax) {
    return { valid: false, message: `Der Wert darf höchstens ${formatParameterValue(spec.hardMax, spec)} betragen.` };
  }

  const precision = parameterDecimalPlaces(spec.step);
  const scale = 10 ** precision;
  if (Math.abs(value * scale - Math.round(value * scale)) > 1e-7) {
    const decimals = precision === 1 ? "eine Nachkommastelle" : `${precision} Nachkommastellen`;
    return { valid: false, message: `Verwende höchstens ${decimals}.` };
  }

  return {
    valid: true,
    extrapolated: value < spec.validatedMin || value > spec.validatedMax,
    outsideStandardRange: value < spec.sliderMin || value > spec.sliderMax,
  };
}

function nextNiceBoundary(value: number) {
  if (value < 0) return 0;
  if (value === 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const candidates = [1, 2, 5, 10].map((factor) => factor * magnitude);
  return candidates.find((candidate) => candidate > value + Math.max(1, value) * 1e-12) ?? magnitude * 10;
}

function previousNiceBoundary(value: number) {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const candidates = [1, 2, 5, 10].map((factor) => factor * magnitude);
  return [...candidates].reverse().find((candidate) => candidate <= value) ?? magnitude / 2;
}

export function expandRangeForValue(range: ParameterRange, value: number, spec: FlexibleParameterSpec): ParameterRange {
  let min = range.min;
  let max = range.max;
  if (value < min) min = Math.max(spec.hardMin, previousNiceBoundary(value));
  if (value > max) max = spec.hardMax === undefined ? nextNiceBoundary(value) : Math.min(spec.hardMax, nextNiceBoundary(value));
  return { min, max };
}

export function nextExpandedRange(range: ParameterRange, spec: FlexibleParameterSpec): ParameterRange {
  if (spec.hardMax !== undefined && range.max >= spec.hardMax) return range;
  const max = nextNiceBoundary(range.max);
  return { ...range, max: spec.hardMax === undefined ? max : Math.min(spec.hardMax, max) };
}

export function isStandardRange(range: ParameterRange, spec: FlexibleParameterSpec) {
  return range.min === spec.sliderMin && range.max === spec.sliderMax;
}

export function snapSliderValue(value: number, range: ParameterRange, spec: FlexibleParameterSpec) {
  const bounded = Math.min(spec.hardMax ?? Number.POSITIVE_INFINITY, Math.max(spec.hardMin, value));
  const snapped = range.min + Math.round((bounded - range.min) / spec.step) * spec.step;
  return Number(snapped.toFixed(parameterDecimalPlaces(spec.step)));
}
