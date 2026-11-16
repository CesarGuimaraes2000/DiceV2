import create from "zustand";
import { immer } from "zustand/middleware/immer";
import { diceSets } from "../sets/diceSets";
import { Dice } from "../types/Dice";
import { DiceSet } from "../types/DiceSet";
import { DiceType } from "../types/DiceType";
import { Die } from "../types/Die";
import { generateDiceId } from "../helpers/generateDiceId";

export type Advantage = "ADVANTAGE" | "DISADVANTAGE" | null;
export type DiceCounts = Record<string, number>;

interface DiceControlsState {
  diceSet: DiceSet;
  diceById: Record<string, Die>;
  defaultDiceCounts: DiceCounts;
  diceCounts: DiceCounts;
  diceBonus: number;
  diceAdvantage: Advantage;
  diceHidden: boolean;
  diceHighRoll: boolean;
  diceLabel: string | null;
  diceRollPressTime: number | null;
  fairnessTesterOpen: boolean;
  changeDiceSet: (diceSet: DiceSet) => void;
  resetDiceCounts: () => void;
  changeDieCount: (id: string, count: number) => void;
  incrementDieCount: (id: string) => void;
  decrementDieCount: (id: string) => void;
  setDiceAdvantage: (advantage: Advantage) => void;
  setDiceBonus: (bonus: number) => void;
  setDiceLabel: (label: string | null) => void;
  toggleDiceHidden: () => void;
  toggleDiceHighRoll: () => void;
  setDiceRollPressTime: (time: number | null) => void;
  toggleFairnessTester: () => void;
  applyExternalRoll: (params: {
    countsByType: Partial<Record<DiceType, number>>;
    bonus: number;
    advantage: Advantage;
    hidden?: boolean;
    label?: string;
  }) => void;
}

const initialSet = diceSets[0];
const initialDiceCounts = getDiceCountsFromSet(initialSet);
const initialDiceById = getDiceByIdFromSet(initialSet);

export const useDiceControlsStore = create<DiceControlsState>()(
  immer((set) => ({
    diceSet: initialSet,
    diceById: initialDiceById,
    defaultDiceCounts: initialDiceCounts,
    diceCounts: initialDiceCounts,
    diceBonus: 0,
    diceAdvantage: null,
    diceHidden: false,
    diceHighRoll: false,
    diceLabel: null,
    diceRollPressTime: null,
    fairnessTesterOpen: false,
    changeDiceSet(diceSet) {
      set((state) => {
        const counts: DiceCounts = {};
        const prevCounts = state.diceCounts;
        const prevDice = state.diceSet.dice;
        for (let i = 0; i < diceSet.dice.length; i++) {
          const die = diceSet.dice[i];
          const prevDie = prevDice[i];
          // Carry over count if the index and die type match
          if (prevDie && prevDie.type === die.type) {
            counts[die.id] = prevCounts[prevDie.id] || 0;
          } else {
            counts[die.id] = 0;
          }
        }
        state.diceCounts = counts;
        state.diceSet = diceSet;
        state.defaultDiceCounts = getDiceCountsFromSet(diceSet);
        state.diceById = getDiceByIdFromSet(diceSet);
      });
    },
    resetDiceCounts() {
      set((state) => {
        state.diceCounts = state.defaultDiceCounts;
        state.diceLabel = null;
      });
    },
    changeDieCount(id, count) {
      set((state) => {
        if (id in state.diceCounts) {
          state.diceCounts[id] = count;
        }
      });
    },
    incrementDieCount(id) {
      set((state) => {
        if (id in state.diceCounts) {
          state.diceCounts[id] += 1;
        }
      });
    },
    decrementDieCount(id) {
      set((state) => {
        if (id in state.diceCounts) {
          state.diceCounts[id] -= 1;
        }
      });
    },
    setDiceBonus(bonus) {
      set((state) => {
        state.diceBonus = bonus;
      });
    },
    setDiceAdvantage(advantage) {
      set((state) => {
        state.diceAdvantage = advantage;
      });
    },
    setDiceLabel(label) {
      set((state) => {
        state.diceLabel = label;
      });
    },
    toggleDiceHidden() {
      set((state) => {
        state.diceHidden = !state.diceHidden;
      });
    },
    toggleDiceHighRoll() {
      set((state) => {
        state.diceHighRoll = !state.diceHighRoll;
      });
    },
    setDiceRollPressTime(time) {
      set((state) => {
        state.diceRollPressTime = time;
      });
    },
    toggleFairnessTester() {
      set((state) => {
        state.fairnessTesterOpen = !state.fairnessTesterOpen;
      });
    },
    applyExternalRoll({ countsByType, bonus, advantage, hidden, label }) {
      set((state) => {
        state.diceCounts = { ...state.defaultDiceCounts };
        for (const [type, count] of Object.entries(countsByType)) {
          if (!count || count <= 0) continue;
          const matchingDie = state.diceSet.dice.find(
            (die) => die.type === type
          );
          if (matchingDie) {
            state.diceCounts[matchingDie.id] = count;
          }
        }
        state.diceBonus = bonus;
        state.diceAdvantage = advantage;
        state.diceLabel = label ?? null;
        if (typeof hidden === "boolean") {
          state.diceHidden = hidden;
        }
        state.fairnessTesterOpen = false;
        state.diceRollPressTime = null;
      });
    },
  }))
);

function getDiceCountsFromSet(diceSet: DiceSet) {
  const counts: Record<string, number> = {};
  for (const die of diceSet.dice) {
    counts[die.id] = 0;
  }
  return counts;
}

function getDiceByIdFromSet(diceSet: DiceSet) {
  const byId: Record<string, Die> = {};
  for (const die of diceSet.dice) {
    byId[die.id] = die;
  }
  return byId;
}

/** Generate new dice based off of a set of counts, advantage and die */
export function getDiceToRoll(
  counts: DiceCounts,
  advantage: Advantage,
  diceById: Record<string, Die>
) {
  const dice: (Die | Dice)[] = [];
  const countEntries = Object.entries(counts);
  for (const [id, count] of countEntries) {
    const die = diceById[id];
    if (!die) {
      continue;
    }
    const { style, type } = die;
    for (let i = 0; i < count; i++) {
      if (advantage === null) {
        if (type === "D100") {
          // Push a d100 and d10 when rolling a d100
          dice.push({
            dice: [
              { id: generateDiceId(), style, type: "D100" },
              { id: generateDiceId(), style, type: "D10" },
            ],
          });
        } else {
          dice.push({ id: generateDiceId(), style, type });
        }
      } else {
        // Rolling with advantage or disadvantage
        const combination = advantage === "ADVANTAGE" ? "HIGHEST" : "LOWEST";
        if (type === "D100") {
          // Push 2 d100s and d10s
          dice.push({
            dice: [
              {
                dice: [
                  { id: generateDiceId(), style, type: "D100" },
                  { id: generateDiceId(), style, type: "D10" },
                ],
              },
              {
                dice: [
                  { id: generateDiceId(), style, type: "D100" },
                  { id: generateDiceId(), style, type: "D10" },
                ],
              },
            ],
            combination,
          });
        } else {
          dice.push({
            dice: [
              { id: generateDiceId(), style, type },
              { id: generateDiceId(), style, type },
            ],
            combination,
          });
        }
      }
    }
  }
  return dice;
}
