import type { EffectCausality, EffectEvidenceStatus } from "./effect-contracts";
import type { Confidence } from "./types";

export const PERSONAL_EFFECT_CONTRACT_VERSION = "personal-effects-1.0.0";

export type PersonalEffectPerspective =
  | "persoenlicher-haushalt"
  | "aehnliche-kohorte"
  | "zielgruppe"
  | "staatshaushalt"
  | "kurzfristige-wirtschaft"
  | "langfristiger-pfad";

export type PersonalEffectDirection =
  | "entlastung"
  | "belastung"
  | "keine-direkte-wirkung"
  | "gemischt"
  | "unklar";

export type PersonalEffectAccuracy =
  | "persoenlich-berechnet"
  | "aehnliche-haushalte-modelliert"
  | "qualitativ-eingeordnet"
  | "nicht-bestimmbar";

export type PersonalEffectLayer =
  | "direkt"
  | "kurzfristige-reaktion"
  | "rueckkopplung"
  | "langfristig"
  | "nicht-monetaer";

export const personalEffectPerspectiveLabels: Record<PersonalEffectPerspective, string> = {
  "persoenlicher-haushalt": "Persönlicher Haushalt",
  "aehnliche-kohorte": "Ähnliche Haushalte/Kohorte",
  zielgruppe: "Betroffene Zielgruppe",
  staatshaushalt: "Staatshaushalt",
  "kurzfristige-wirtschaft": "Kurzfristige wirtschaftliche Reaktion",
  "langfristiger-pfad": "Langfristiger Pfad",
};

export const personalEffectDirectionLabels: Record<PersonalEffectDirection, string> = {
  entlastung: "Konkrete Entlastung",
  belastung: "Konkrete Belastung",
  "keine-direkte-wirkung": "Keine direkte Wirkung",
  gemischt: "Gemischte Wirkung",
  unklar: "Ungeklärt",
};

export const personalEffectAccuracyLabels: Record<PersonalEffectAccuracy, string> = {
  "persoenlich-berechnet": "Persönlich berechnet",
  "aehnliche-haushalte-modelliert": "Für ähnliche Haushalte modelliert",
  "qualitativ-eingeordnet": "Nur qualitativ eingeordnet",
  "nicht-bestimmbar": "Nicht bestimmbar",
};

export const personalEffectLayerLabels: Record<PersonalEffectLayer, string> = {
  direkt: "Direkte Wirkung",
  "kurzfristige-reaktion": "Kurzfristige Reaktion",
  rueckkopplung: "Rückkopplung",
  langfristig: "Langfristiger Pfad",
  "nicht-monetaer": "Nicht monetäre Wirkung",
};

export interface PersonalEffectPeriod {
  fromYear: number;
  toYear: number;
}

export interface PersonalEffectPointValue {
  kind: "punktwert";
  amount: number;
  unit: string;
  period: PersonalEffectPeriod;
}

export interface PersonalEffectRangeValue {
  kind: "bandbreite";
  lower: number;
  central?: number;
  upper: number;
  unit: string;
  period: PersonalEffectPeriod;
}

export interface PersonalEffectDirectionalValue {
  kind: "gerichtet";
  summary: string;
}

export interface PersonalEffectUndeterminedValue {
  kind: "nicht-bestimmbar";
  reason: string;
}

export type PersonalEffectValue =
  | PersonalEffectPointValue
  | PersonalEffectRangeValue
  | PersonalEffectDirectionalValue
  | PersonalEffectUndeterminedValue;

export type PersonalEffectPopulationSize =
  | { kind: "punktwert"; value: number; unit: string }
  | { kind: "bandbreite"; lower: number; upper: number; unit: string };

export interface PersonalEffectAffectedGroup {
  description: string;
  condition: string;
  size?: PersonalEffectPopulationSize;
}

export interface PersonalEffectEvidence {
  dataYear: number;
  legalYear: number;
  evidenceStatus: EffectEvidenceStatus;
  causality: EffectCausality;
  confidence: Confidence;
  uncertainty: string;
  sourceIds: string[];
}

export interface PersonalEffectProfileBinding {
  used: string[];
  missing: string[];
}

interface PersonalEffectStatementBase {
  id: string;
  /** Stabile Regel-/Modul-ID; Aussagen mit demselben Schlüssel bilden eine fachliche Aussagegruppe. */
  claimKey: string;
  title: string;
  perspective: PersonalEffectPerspective;
  direction: PersonalEffectDirection;
  layer: PersonalEffectLayer;
  explanation: string;
  affectedGroup: PersonalEffectAffectedGroup;
  evidence: PersonalEffectEvidence;
  profile: PersonalEffectProfileBinding;
  /** IDs aus dem bestehenden Kontextwirkungsregister; Wirkungspfade werden nicht kopiert. */
  contextEffectIds: string[];
}

export type QuantifiedPersonalEffectStatement = PersonalEffectStatementBase & {
  accuracy: "persoenlich-berechnet" | "aehnliche-haushalte-modelliert";
  value: PersonalEffectPointValue | PersonalEffectRangeValue;
};

export type QualitativePersonalEffectStatement = PersonalEffectStatementBase & {
  accuracy: "qualitativ-eingeordnet";
  value: PersonalEffectDirectionalValue;
};

export type UndeterminedPersonalEffectStatement = PersonalEffectStatementBase & {
  accuracy: "nicht-bestimmbar";
  direction: "unklar";
  value: PersonalEffectUndeterminedValue;
};

export type PersonalEffectStatement =
  | QuantifiedPersonalEffectStatement
  | QualitativePersonalEffectStatement
  | UndeterminedPersonalEffectStatement;

export type PersonalEffectValidationCode =
  | "not-an-object"
  | "required-field-missing"
  | "invalid-enum"
  | "invalid-period"
  | "invalid-value"
  | "value-accuracy-mismatch"
  | "missing-evidence-source"
  | "profile-fields-overlap"
  | "normative-language"
  | "duplicate-statement"
  | "conflicting-statements";

export interface PersonalEffectValidationError {
  code: PersonalEffectValidationCode;
  message: string;
  statementIndex?: number;
}

export interface PersonalEffectNormalizationResult {
  statements: PersonalEffectStatement[];
  errors: PersonalEffectValidationError[];
}

const perspectives: readonly PersonalEffectPerspective[] = [
  "persoenlicher-haushalt",
  "aehnliche-kohorte",
  "zielgruppe",
  "staatshaushalt",
  "kurzfristige-wirtschaft",
  "langfristiger-pfad",
];
const directions: readonly PersonalEffectDirection[] = ["entlastung", "belastung", "keine-direkte-wirkung", "gemischt", "unklar"];
const accuracies: readonly PersonalEffectAccuracy[] = ["persoenlich-berechnet", "aehnliche-haushalte-modelliert", "qualitativ-eingeordnet", "nicht-bestimmbar"];
const layers: readonly PersonalEffectLayer[] = ["direkt", "kurzfristige-reaktion", "rueckkopplung", "langfristig", "nicht-monetaer"];
const evidenceStatuses: readonly EffectEvidenceStatus[] = ["amtlich-beobachtet", "modellrechnung", "szenarioannahme", "externe-evidenz", "nicht-berechnet", "nicht-ausreichend-belegt"];
const causalities: readonly EffectCausality[] = ["deskriptiv", "korrelativ", "kausal-geschaetzt", "modelliert", "hypothetisch"];
const confidences: readonly Confidence[] = ["hoch", "mittel", "niedrig"];

type RecordLike = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordLike => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T => typeof value === "string" && values.includes(value as T);
const uniqueStrings = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

function validatePeriod(value: unknown, errors: PersonalEffectValidationError[], field: string): void {
  const period = isRecord(value) ? value : null;
  const fromYear = period?.fromYear;
  const toYear = period?.toYear;
  if (!period || !Number.isInteger(fromYear) || !Number.isInteger(toYear) || (fromYear as number) < 1900 || (toYear as number) < (fromYear as number)) {
    errors.push({ code: "invalid-period", message: `${field} benötigt einen gültigen Zeitraum.` });
  }
}

function validateValue(value: unknown, errors: PersonalEffectValidationError[], accuracy: unknown): void {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) {
    errors.push({ code: "invalid-value", message: "Der Werttyp der Aussage fehlt." });
    return;
  }

  if (value.kind === "punktwert") {
    if (!isFiniteNumber(value.amount) || !isNonEmptyString(value.unit)) errors.push({ code: "invalid-value", message: "Ein Punktwert benötigt Betrag und Einheit." });
    validatePeriod(value.period, errors, "Punktwert");
  } else if (value.kind === "bandbreite") {
    if (!isFiniteNumber(value.lower) || !isFiniteNumber(value.upper) || value.lower > value.upper || !isNonEmptyString(value.unit)) {
      errors.push({ code: "invalid-value", message: "Eine Bandbreite benötigt Untergrenze, Obergrenze und Einheit." });
    }
    if (value.central !== undefined && (!isFiniteNumber(value.central) || (value.central as number) < (value.lower as number) || (value.central as number) > (value.upper as number))) {
      errors.push({ code: "invalid-value", message: "Der Zentralwert einer Bandbreite muss innerhalb ihrer Grenzen liegen." });
    }
    validatePeriod(value.period, errors, "Bandbreite");
  } else if (value.kind === "gerichtet") {
    if (!isNonEmptyString(value.summary)) errors.push({ code: "invalid-value", message: "Eine gerichtete Aussage benötigt eine verständliche Kurzbeschreibung." });
  } else if (value.kind === "nicht-bestimmbar") {
    if (!isNonEmptyString(value.reason)) errors.push({ code: "invalid-value", message: "Eine nicht bestimmbare Aussage benötigt eine Begründung." });
  } else {
    errors.push({ code: "invalid-value", message: "Unbekannter Werttyp der persönlichen Wirkungsaussage." });
  }

  const quantified = accuracy === "persoenlich-berechnet" || accuracy === "aehnliche-haushalte-modelliert";
  const qualitative = accuracy === "qualitativ-eingeordnet";
  const undetermined = accuracy === "nicht-bestimmbar";
  const kind = value.kind;
  if ((quantified && kind !== "punktwert" && kind !== "bandbreite") || (qualitative && kind !== "gerichtet") || (undetermined && kind !== "nicht-bestimmbar")) {
    errors.push({ code: "value-accuracy-mismatch", message: "Genauigkeitsstufe und Werttyp der Aussage passen nicht zusammen." });
  }
}

/** Validiert auch untrusted JSON, bevor es aus Worker- oder Persistenzgrenzen dargestellt wird. */
export function validatePersonalEffectStatement(input: unknown): PersonalEffectValidationError[] {
  if (!isRecord(input)) return [{ code: "not-an-object", message: "Eine persönliche Wirkungsaussage muss ein Objekt sein." }];

  const errors: PersonalEffectValidationError[] = [];
  for (const field of ["id", "claimKey", "title", "explanation"] as const) {
    if (!isNonEmptyString(input[field])) errors.push({ code: "required-field-missing", message: `${field} der persönlichen Wirkungsaussage fehlt.` });
  }
  if (!isOneOf(input.perspective, perspectives) || !isOneOf(input.direction, directions) || !isOneOf(input.accuracy, accuracies) || !isOneOf(input.layer, layers)) {
    errors.push({ code: "invalid-enum", message: "Perspektive, Richtung, Genauigkeitsstufe oder Wirkungsebene ist unzulässig." });
  }

  if (!isRecord(input.affectedGroup) || !isNonEmptyString(input.affectedGroup.description) || !isNonEmptyString(input.affectedGroup.condition)) {
    errors.push({ code: "required-field-missing", message: "Betroffene Gruppe und Voraussetzung müssen beschrieben sein." });
  }
  if (!isRecord(input.evidence) || !Number.isInteger(input.evidence.dataYear) || !Number.isInteger(input.evidence.legalYear) || !isOneOf(input.evidence.evidenceStatus, evidenceStatuses) || !isOneOf(input.evidence.causality, causalities) || !isOneOf(input.evidence.confidence, confidences) || !isNonEmptyString(input.evidence.uncertainty) || !Array.isArray(input.evidence.sourceIds) || !input.evidence.sourceIds.every(isNonEmptyString)) {
    errors.push({ code: "required-field-missing", message: "Evidenz, Daten-/Rechtsstand, Unsicherheit und Quellen müssen vollständig sein." });
  } else if (input.evidence.sourceIds.length === 0) {
    errors.push({ code: "missing-evidence-source", message: "Eine sichtbare Wirkungsaussage benötigt mindestens eine Quellen-ID." });
  }
  const profile = isRecord(input.profile) ? input.profile : null;
  if (!profile || !Array.isArray(profile.used) || !profile.used.every(isNonEmptyString) || !Array.isArray(profile.missing) || !profile.missing.every(isNonEmptyString)) {
    errors.push({ code: "required-field-missing", message: "Verwendete und fehlende Profilangaben müssen als Listen vorliegen." });
  } else if ((profile.used as string[]).some((field) => (profile.missing as string[]).includes(field))) {
    errors.push({ code: "profile-fields-overlap", message: "Eine Profilangabe darf nicht zugleich verwendet und als fehlend markiert sein." });
  }
  if (!Array.isArray(input.contextEffectIds) || !input.contextEffectIds.every(isNonEmptyString)) {
    errors.push({ code: "required-field-missing", message: "Referenzen auf Kontextwirkungen müssen als ID-Liste vorliegen." });
  }

  if (isOneOf(input.accuracy, accuracies)) validateValue(input.value, errors, input.accuracy);
  if (input.accuracy === "nicht-bestimmbar" && input.direction !== "unklar") errors.push({ code: "value-accuracy-mismatch", message: "Nicht bestimmbare Aussagen müssen die Richtung 'unklar' tragen." });
  const text = [input.title, input.explanation, isRecord(input.value) ? input.value.summary : undefined].filter(isNonEmptyString).join(" ");
  if (/\b(?:gute?|schlechte?|faire?|unfaire?)\s+reform\b|\b(?:insgesamt|politisch)\s+(?:gut|schlecht|fair|unfair)\b/i.test(text)) {
    errors.push({ code: "normative-language", message: "Persönliche Wirkungsaussagen dürfen keine normative Gesamtbewertung enthalten." });
  }
  return errors;
}

function normalizeValue(value: RecordLike): PersonalEffectValue {
  if (value.kind === "punktwert") return { kind: "punktwert", amount: value.amount as number, unit: (value.unit as string).trim(), period: { fromYear: value.period && isRecord(value.period) ? value.period.fromYear as number : 0, toYear: value.period && isRecord(value.period) ? value.period.toYear as number : 0 } };
  if (value.kind === "bandbreite") return { kind: "bandbreite", lower: value.lower as number, central: value.central as number | undefined, upper: value.upper as number, unit: (value.unit as string).trim(), period: { fromYear: value.period && isRecord(value.period) ? value.period.fromYear as number : 0, toYear: value.period && isRecord(value.period) ? value.period.toYear as number : 0 } };
  if (value.kind === "gerichtet") return { kind: "gerichtet", summary: (value.summary as string).trim() };
  return { kind: "nicht-bestimmbar", reason: (value.reason as string).trim() };
}

/** Gibt nur vollständig validierte Aussagen zurück; fehlerhafte Daten werden nicht still dargestellt. */
export function normalizePersonalEffectStatement(input: unknown): PersonalEffectStatement | null {
  if (validatePersonalEffectStatement(input).length > 0 || !isRecord(input) || !isRecord(input.value)) return null;
  const evidence = input.evidence as RecordLike;
  const profile = input.profile as RecordLike;
  return {
    id: (input.id as string).trim(),
    claimKey: (input.claimKey as string).trim(),
    title: (input.title as string).trim(),
    perspective: input.perspective as PersonalEffectPerspective,
    direction: input.direction as PersonalEffectDirection,
    accuracy: input.accuracy as PersonalEffectAccuracy,
    layer: input.layer as PersonalEffectLayer,
    value: normalizeValue(input.value),
    explanation: (input.explanation as string).trim(),
    affectedGroup: {
      description: ((input.affectedGroup as RecordLike).description as string).trim(),
      condition: ((input.affectedGroup as RecordLike).condition as string).trim(),
    },
    evidence: {
      dataYear: evidence.dataYear as number,
      legalYear: evidence.legalYear as number,
      evidenceStatus: evidence.evidenceStatus as EffectEvidenceStatus,
      causality: evidence.causality as EffectCausality,
      confidence: evidence.confidence as Confidence,
      uncertainty: (evidence.uncertainty as string).trim(),
      sourceIds: uniqueStrings(evidence.sourceIds as string[]),
    },
    profile: {
      used: uniqueStrings(profile.used as string[]),
      missing: uniqueStrings(profile.missing as string[]),
    },
    contextEffectIds: uniqueStrings(input.contextEffectIds as string[]),
  } as PersonalEffectStatement;
}

/** Normalisiert eine Aussage-Menge und verwirft Dubletten oder widersprüchliche Claims gemeinsam. */
export function normalizePersonalEffectStatements(input: readonly unknown[]): PersonalEffectNormalizationResult {
  const errors: PersonalEffectValidationError[] = [];
  const candidates: Array<{ index: number; statement: PersonalEffectStatement }> = [];
  input.forEach((item, index) => {
    const itemErrors = validatePersonalEffectStatement(item).map((error) => ({ ...error, statementIndex: index }));
    if (itemErrors.length > 0) errors.push(...itemErrors);
    else {
      const statement = normalizePersonalEffectStatement(item);
      if (statement) candidates.push({ index, statement });
    }
  });

  const byId = new Map<string, { index: number; statement: PersonalEffectStatement }>();
  const unique: Array<{ index: number; statement: PersonalEffectStatement }> = [];
  for (const candidate of candidates) {
    if (byId.has(candidate.statement.id)) {
      errors.push({ code: "duplicate-statement", message: `Die Aussage-ID '${candidate.statement.id}' ist doppelt vorhanden.`, statementIndex: candidate.index });
      continue;
    }
    byId.set(candidate.statement.id, candidate);
    unique.push(candidate);
  }

  const byClaim = new Map<string, Array<{ index: number; statement: PersonalEffectStatement }>>();
  for (const candidate of unique) {
    const key = `${candidate.statement.claimKey}|${candidate.statement.perspective}|${candidate.statement.layer}`;
    byClaim.set(key, [...(byClaim.get(key) ?? []), candidate]);
  }
  const rejected = new Set<number>();
  for (const [key, claims] of byClaim) {
    const directions = new Set(claims.map(({ statement }) => statement.direction));
    const concreteDirections = [...directions].filter((direction) => direction !== "gemischt" && direction !== "unklar");
    if (claims.length > 1 && (concreteDirections.length > 1 || directions.size > 1)) {
      for (const claim of claims) {
        rejected.add(claim.index);
        errors.push({ code: "conflicting-statements", message: `Widersprüchliche Aussagen für '${key}' werden nicht dargestellt.`, statementIndex: claim.index });
      }
    }
  }

  return { statements: unique.filter(({ index }) => !rejected.has(index)).map(({ statement }) => statement), errors };
}

export function validatePersonalEffectStatements(statements: readonly PersonalEffectStatement[]): PersonalEffectValidationError[] {
  return normalizePersonalEffectStatements(statements).errors;
}
