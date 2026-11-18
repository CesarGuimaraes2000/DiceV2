import create from "zustand";
import { immer } from "zustand/middleware/immer";
import { WritableDraft } from "immer/dist/types/types-external";

import { Dice } from "../types/Dice";
import {
  DiceRoll,
  ExplodeMode,
  normalizeExplodeMode,
} from "../types/DiceRoll";
import { DiceStyle } from "../types/DiceStyle";
import { DiceType } from "../types/DiceType";
import { isDie } from "../types/Die";
import { isDice } from "../types/Dice";
import { getCombinedDiceValue } from "../helpers/getCombinedDiceValue";
import { getDieFromDice } from "../helpers/getDieFromDice";
import { DiceTransform } from "../types/DiceTransform";
import { getRandomDiceThrow } from "../helpers/DiceThrower";
import { generateDiceId } from "../helpers/generateDiceId";
import { DiceThrow } from "../types/DiceThrow";

export function isMaxDieValue(type: DiceType, rawValue: number): boolean {
  switch (type) {
    case "D4":
      return rawValue === 4;
    case "D6":
      return rawValue === 6;
    case "D8":
      return rawValue === 8;
    case "D10":
      return rawValue === 0 || rawValue === 10;
    case "D12":
      return rawValue === 12;
    case "D20":
      return rawValue === 20;
    case "D100":
      return false;
  }
}

interface ExplodeTarget {
  triggerIds: string[];
  type: DiceType;
  style: DiceStyle;
}

function toNumericValues(
  rollValues: Record<string, number | null>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rollValues)) {
    if (typeof v === "number") {
      out[k] = v;
    }
  }
  return out;
}

function findNewExplodingTargets(
  node: Dice,
  rollValues: Record<string, number | null>,
  explodedDieIds: Record<string, boolean>,
  explodeMode: ExplodeMode = "ALL",
  parentKept = true
): ExplodeTarget[] {
  const targets: ExplodeTarget[] = [];
  if (!parentKept) return targets;

  // Handle standard D100 percentile pair as a single 1..100 die
  if (
    node.dice.length === 2 &&
    (node.combination === undefined || node.combination === "SUM") &&
    isDie(node.dice[0]) &&
    isDie(node.dice[1]) &&
    node.dice[0].type === "D100" &&
    node.dice[1].type === "D10"
  ) {
    const d100 = node.dice[0];
    const d10 = node.dice[1];
    const canPairExplode =
      explodeMode === "PRIMARY" ? Boolean(d100.primary || d100.exploded) : true;
    if (
      canPairExplode &&
      !explodedDieIds[d100.id] &&
      rollValues[d100.id] === 0 &&
      rollValues[d10.id] === 0
    ) {
      targets.push({
        triggerIds: [d100.id, d10.id],
        type: "D100",
        style: d100.style,
      });
    }
    return targets;
  }

  let winnerIndex = -1;
  if (
    (node.combination === "HIGHEST" || node.combination === "LOWEST") &&
    node.dice.length > 0
  ) {
    const numericValues = toNumericValues(rollValues);
    let bestVal: number | null = null;
    for (let i = 0; i < node.dice.length; i++) {
      const child = node.dice[i];
      let val: number | null = null;
      if (isDie(child)) {
        const raw = numericValues[child.id];
        if (raw !== undefined) {
          val = raw === 0 && child.type === "D10" ? 10 : raw;
        }
      } else if (isDice(child)) {
        val = getCombinedDiceValue(child, numericValues);
      }
      if (val === null) continue;
      if (
        bestVal === null ||
        (node.combination === "HIGHEST" ? val > bestVal : val < bestVal)
      ) {
        bestVal = val;
        winnerIndex = i;
      }
    }
  }

  for (let i = 0; i < node.dice.length; i++) {
    const child = node.dice[i];
    const childKept = winnerIndex >= 0 ? i === winnerIndex : true;
    if (!childKept) continue;

    if (isDie(child)) {
      const val = rollValues[child.id];
      const canDieExplode =
        explodeMode === "PRIMARY"
          ? Boolean(child.primary || child.exploded)
          : true;
      if (
        canDieExplode &&
        !explodedDieIds[child.id] &&
        typeof val === "number" &&
        isMaxDieValue(child.type, val)
      ) {
        targets.push({
          triggerIds: [child.id],
          type: child.type,
          style: child.style,
        });
      }
    } else if (isDice(child)) {
      targets.push(
        ...findNewExplodingTargets(
          child,
          rollValues,
          explodedDieIds,
          explodeMode,
          true
        )
      );
    }
  }

  return targets;
}

interface DiceRollState {
  roll: DiceRoll | null;
  /**
   * A mapping from the die ID to its roll result.
   * A value of `null` means the die hasn't finished rolling yet.
   */
  rollValues: Record<string, number | null>;
  /**
   * A mapping from the die ID to its final roll transform.
   * A value of `null` means the die hasn't finished rolling yet.
   */
  rollTransforms: Record<string, DiceTransform | null>;
  /**
   * A mapping from the die ID to its initial roll throw state.
   */
  rollThrows: Record<string, DiceThrow>;
  /** Die IDs that have already triggered an exploding re-roll. */
  explodedDieIds: Record<string, boolean>;
  /** True while waiting for the short delay before spawning exploding dice. */
  pendingExplosion: boolean;
  startRoll: (roll: DiceRoll, speedMultiplier?: number) => void;
  clearRoll: (ids?: string) => void;
  /** Reroll select ids of dice or reroll all dice by passing `undefined` */
  reroll: (ids?: string[], manualThrows?: Record<string, DiceThrow>) => void;
  finishDieRoll: (id: string, number: number, transform: DiceTransform) => void;
  spawnExplodingDice: () => void;
}

export const useDiceRollStore = create<DiceRollState>()(
  immer((set) => ({
    roll: null,
    rollValues: {},
    rollTransforms: {},
    rollThrows: {},
    explodedDieIds: {},
    pendingExplosion: false,
    startRoll: (roll, speedMultiplier?: number) =>
      set((state) => {
        state.roll = roll;
        state.rollValues = {};
        state.rollTransforms = {};
        state.rollThrows = {};
        state.explodedDieIds = {};
        state.pendingExplosion = false;
        // Set all values to null
        const dice = getDieFromDice(roll);
        for (const die of dice) {
          state.rollValues[die.id] = null;
          state.rollTransforms[die.id] = null;
          state.rollThrows[die.id] = getRandomDiceThrow(speedMultiplier);
        }
      }),
    clearRoll: () =>
      set((state) => {
        state.roll = null;
        state.rollValues = {};
        state.rollTransforms = {};
        state.rollThrows = {};
        state.explodedDieIds = {};
        state.pendingExplosion = false;
      }),
    reroll: (ids, manualThrows) => {
      set((state) => {
        if (state.roll) {
          if (!ids) {
            state.roll.dice = state.roll.dice.filter((item) => {
              if (isDie(item)) return !item.exploded;
              if (isDice(item)) {
                return !(
                  item.dice.length > 0 &&
                  item.dice.every((child) => isDie(child) && child.exploded)
                );
              }
              return true;
            });
            const activeIds = new Set(
              getDieFromDice(state.roll).map((d) => d.id)
            );
            for (const key of Object.keys(state.rollValues)) {
              if (!activeIds.has(key)) {
                delete state.rollValues[key];
                delete state.rollTransforms[key];
                delete state.rollThrows[key];
              }
            }
            state.explodedDieIds = {};
          } else {
            for (const id of ids) {
              delete state.explodedDieIds[id];
            }
          }
          state.pendingExplosion = false;
          rerollDraft(
            state.roll,
            ids,
            manualThrows,
            state.rollValues,
            state.rollTransforms,
            state.rollThrows
          );
        }
      });
    },
    finishDieRoll: (id, number, transform) => {
      set((state) => {
        state.rollValues[id] = number;
        state.rollTransforms[id] = transform;

        const explodeMode = normalizeExplodeMode(state.roll?.explode);
        if (
          explodeMode &&
          state.roll &&
          Object.values(state.rollValues).every((value) => value !== null)
        ) {
          const targets = findNewExplodingTargets(
            state.roll,
            state.rollValues,
            state.explodedDieIds,
            explodeMode
          );
          if (targets.length > 0) {
            state.pendingExplosion = true;
          }
        }
      });
    },
    spawnExplodingDice: () => {
      set((state) => {
        const explodeMode = normalizeExplodeMode(state.roll?.explode);
        if (!state.roll || !explodeMode) {
          state.pendingExplosion = false;
          return;
        }
        const targets = findNewExplodingTargets(
          state.roll,
          state.rollValues,
          state.explodedDieIds,
          explodeMode
        );
        for (const target of targets) {
          for (const tid of target.triggerIds) {
            state.explodedDieIds[tid] = true;
          }
          if (target.type === "D100") {
            const d100Id = generateDiceId();
            const d10Id = generateDiceId();
            state.roll.dice.push({
              dice: [
                { id: d100Id, style: target.style, type: "D100", exploded: true },
                { id: d10Id, style: target.style, type: "D10", exploded: true },
              ],
            });
            state.rollValues[d100Id] = null;
            state.rollTransforms[d100Id] = null;
            state.rollThrows[d100Id] = getRandomDiceThrow();
            state.rollValues[d10Id] = null;
            state.rollTransforms[d10Id] = null;
            state.rollThrows[d10Id] = getRandomDiceThrow();
          } else {
            const newId = generateDiceId();
            state.roll.dice.push({
              id: newId,
              style: target.style,
              type: target.type,
              exploded: true,
            });
            state.rollValues[newId] = null;
            state.rollTransforms[newId] = null;
            state.rollThrows[newId] = getRandomDiceThrow();
          }
        }
        state.pendingExplosion = false;
      });
    },
  }))
);

/** Recursively update the ids of a draft to reroll dice */
function rerollDraft(
  diceRoll: WritableDraft<DiceRoll>,
  ids: string[] | undefined,
  manualThrows: Record<string, DiceThrow> | undefined,
  rollValues: WritableDraft<Record<string, number | null>>,
  rollTransforms: WritableDraft<Record<string, DiceTransform | null>>,
  rollThrows: WritableDraft<Record<string, DiceThrow>>
) {
  for (let dieOrDice of diceRoll.dice) {
    if (isDie(dieOrDice)) {
      if (!ids || ids.includes(dieOrDice.id)) {
        delete rollValues[dieOrDice.id];
        delete rollTransforms[dieOrDice.id];
        delete rollThrows[dieOrDice.id];
        const manualThrow = manualThrows?.[dieOrDice.id];
        const id = generateDiceId();
        dieOrDice.id = id;
        rollValues[id] = null;
        rollTransforms[id] = null;
        if (manualThrow) {
          rollThrows[id] = manualThrow;
        } else {
          rollThrows[id] = getRandomDiceThrow();
        }
      }
    } else if (isDice(dieOrDice)) {
      rerollDraft(
        dieOrDice,
        ids,
        manualThrows,
        rollValues,
        rollTransforms,
        rollThrows
      );
    }
  }
}
