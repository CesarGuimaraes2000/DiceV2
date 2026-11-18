import { Dice } from "./Dice";

export type ExplodeMode = false | "PRIMARY" | "ALL";

export function normalizeExplodeMode(
  mode?: ExplodeMode | boolean | null
): ExplodeMode {
  if (mode === "PRIMARY") return "PRIMARY";
  if (mode === "ALL" || mode === true) return "ALL";
  return false;
}

/**
 * The roll of a set of dice.
 * See `Dice` type for examples of usage
 */
export interface DiceRoll extends Dice {
  hidden?: boolean;
  label?: string;
  highRoll?: boolean;
  explode?: ExplodeMode | boolean;
}
