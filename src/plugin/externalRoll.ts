import type { Advantage } from "../controls/store";
import type { DiceType } from "../types/DiceType";

export const EXTERNAL_ROLL_METADATA_KEYS = [
  "rodeo.owlbear.dice/externalRollRequest",
  "com.dnd55.sheets/diceRequest",
] as const;

export const EXTERNAL_ROLL_STORAGE_KEY =
  "rodeo.owlbear.dice/pendingExternalRoll";
export const EXTERNAL_ROLL_LAST_ID_KEY =
  "rodeo.owlbear.dice/lastExternalRollId";
export const EXTERNAL_ROLL_CHANNEL = "rodeo.owlbear.dice/external-roll";

export interface ExternalRollRequest {
  id: string;
  dice?: Partial<Record<DiceType, number>>;
  notation?: string;
  bonus?: number;
  advantage?: Advantage | "NORMAL" | "advantage" | "disadvantage" | "normal";
  hidden?: boolean;
  autoRoll?: boolean;
  label?: string;
}

export interface NormalizedExternalRoll {
  id: string;
  countsByType: Partial<Record<DiceType, number>>;
  bonus: number;
  advantage: Advantage;
  hidden?: boolean;
  autoRoll: boolean;
  label?: string;
}

const VALID_DICE_TYPES = new Set<DiceType>([
  "D4",
  "D6",
  "D8",
  "D10",
  "D12",
  "D20",
  "D100",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDiceType(key: string): DiceType | null {
  const upper = key.trim().toUpperCase() as DiceType;
  return VALID_DICE_TYPES.has(upper) ? upper : null;
}

export function parseAdvantage(value: unknown): Advantage {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (upper === "ADVANTAGE") return "ADVANTAGE";
  if (upper === "DISADVANTAGE") return "DISADVANTAGE";
  return null;
}

export function parseDiceNotation(notation: string): {
  countsByType: Partial<Record<DiceType, number>>;
  bonus: number;
} {
  const countsByType: Partial<Record<DiceType, number>> = {};
  let bonus = 0;

  const compact = notation.replace(/\s+/g, "");
  if (!compact) return { countsByType, bonus };

  const tokens = compact.match(/[+-]?[^+-]+/g) ?? [];
  for (const token of tokens) {
    const dieMatch = token.match(/^([+-]?)(\d*)d(4|6|8|10|12|20|100)$/i);
    if (dieMatch) {
      if (dieMatch[1] === "-") continue;
      const rawCount = dieMatch[2] ? parseInt(dieMatch[2], 10) : 1;
      const count = Math.min(20, Math.max(0, rawCount));
      const type = normalizeDiceType(`D${dieMatch[3]}`);
      if (type && count > 0) {
        countsByType[type] = Math.min(20, (countsByType[type] ?? 0) + count);
      }
      continue;
    }

    if (/^[+-]?\d+$/.test(token)) {
      bonus += parseInt(token, 10);
    }
  }

  return { countsByType, bonus };
}

export function parseExternalRollRequest(
  raw: unknown
): NormalizedExternalRoll | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;

  const hasPayloadField =
    raw.dice !== undefined ||
    raw.notation !== undefined ||
    raw.bonus !== undefined ||
    raw.advantage !== undefined;
  if (!hasPayloadField) return null;

  const countsByType: Partial<Record<DiceType, number>> = {};
  let notationBonus = 0;

  if (typeof raw.notation === "string" && raw.notation.trim()) {
    const parsed = parseDiceNotation(raw.notation);
    for (const [type, count] of Object.entries(parsed.countsByType)) {
      if (count && count > 0) {
        countsByType[type as DiceType] = count;
      }
    }
    notationBonus = parsed.bonus;
  }

  if (isRecord(raw.dice)) {
    for (const [key, val] of Object.entries(raw.dice)) {
      const type = normalizeDiceType(key);
      if (type && typeof val === "number" && Number.isFinite(val) && val > 0) {
        countsByType[type] = Math.min(20, Math.floor(val));
      }
    }
  }

  if (Object.keys(countsByType).length === 0) {
    countsByType.D20 = 1;
  }

  const bonus =
    typeof raw.bonus === "number" && Number.isFinite(raw.bonus)
      ? Math.trunc(raw.bonus)
      : notationBonus;

  return {
    id,
    countsByType,
    bonus,
    advantage: parseAdvantage(raw.advantage),
    hidden: typeof raw.hidden === "boolean" ? raw.hidden : undefined,
    autoRoll: raw.autoRoll === true,
    label:
      typeof raw.label === "string" && raw.label.trim()
        ? raw.label.trim()
        : undefined,
  };
}

export function extractExternalRollFromMetadata(
  metadata: Record<string, unknown> | undefined
): NormalizedExternalRoll | null {
  if (!metadata) return null;
  for (const key of EXTERNAL_ROLL_METADATA_KEYS) {
    const parsed = parseExternalRollRequest(metadata[key]);
    if (parsed) return parsed;
  }
  return null;
}

export function readStorageJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readStorageString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage access restrictions in embedded contexts
  }
}

export function removeStorageItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access restrictions in embedded contexts
  }
}
