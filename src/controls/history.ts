import create from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  getCombinedDiceValue,
  getHighestDieValue,
} from "../helpers/getCombinedDiceValue";
import { getDieFromDice } from "../helpers/getDieFromDice";
import { Dice, isDice } from "../types/Dice";
import { DiceRoll } from "../types/DiceRoll";
import { DiceStyle } from "../types/DiceStyle";
import { DiceType } from "../types/DiceType";
import { Die, isDie } from "../types/Die";
import { Advantage, DiceCounts } from "./store";

export const ROLL_LOG_STORAGE_KEY = "rodeo.owlbear.dice/rollLog.v1";
export const ROLL_LOG_CHANNEL = "rodeo.owlbear.dice/roll-log";
const MAX_ROLL_LOG = 60;

export interface RecentRoll {
  counts: DiceCounts;
  bonus: number;
  advantage: Advantage;
  diceById: Record<string, Die>;
}

export interface RolledDieSummary {
  type: DiceType;
  style: DiceStyle;
  value: number;
  kept: boolean;
}

export interface RollLogEntry {
  id: string;
  timestamp: number;
  playerId: string;
  playerName: string;
  playerColor: string;
  label?: string;
  notation: string;
  advantage: Advantage;
  bonus: number;
  finalValue: number;
  highRoll?: boolean;
  highestDieValue?: number;
  hidden?: boolean;
  dice: RolledDieSummary[];
  countsByType?: Partial<Record<DiceType, number>>;
}

interface DiceHistoryState {
  recentRolls: RecentRoll[];
  rollLog: RollLogEntry[];
  pushRecentRoll: (roll: RecentRoll) => void;
  removeRecentRoll: (index: number) => void;
  setRollLog: (entries: RollLogEntry[]) => void;
  removeRollLogEntry: (id: string) => void;
  clearRollLog: () => void;
}

function readPersistedRollLog(): RollLogEntry[] {
  try {
    const raw = window.localStorage.getItem(ROLL_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RollLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writePersistedRollLog(entries: RollLogEntry[]): void {
  try {
    window.localStorage.setItem(ROLL_LOG_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage access restrictions
  }
}

function broadcastRollLog(entries: RollLogEntry[]): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(ROLL_LOG_CHANNEL);
      channel.postMessage(entries);
      channel.close();
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }
}

export const useDiceHistoryStore = create<DiceHistoryState>()(
  immer((set) => ({
    recentRolls: [],
    rollLog: readPersistedRollLog(),
    pushRecentRoll(roll) {
      set((state) => {
        if (state.recentRolls.length > 5) {
          state.recentRolls.splice(0, 1);
        }
        state.recentRolls.push(roll);
      });
    },
    removeRecentRoll(index) {
      set((state) => {
        state.recentRolls.splice(index, 1);
      });
    },
    setRollLog(entries) {
      set((state) => {
        state.rollLog = entries;
      });
    },
    removeRollLogEntry(id) {
      set((state) => {
        state.rollLog = state.rollLog.filter((item) => item.id !== id);
        writePersistedRollLog(state.rollLog);
        broadcastRollLog(state.rollLog);
      });
    },
    clearRollLog() {
      set((state) => {
        state.rollLog = [];
        writePersistedRollLog([]);
        broadcastRollLog([]);
      });
    },
  }))
);

/** Syncs roll log changes pushed by background.ts or other tabs into Zustand state. */
export function initRollLogSync(): () => void {
  useDiceHistoryStore.getState().setRollLog(readPersistedRollLog());

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(ROLL_LOG_CHANNEL);
    channel.onmessage = (event) => {
      if (Array.isArray(event.data)) {
        useDiceHistoryStore.getState().setRollLog(event.data as RollLogEntry[]);
      }
    };
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === ROLL_LOG_STORAGE_KEY) {
      useDiceHistoryStore.getState().setRollLog(readPersistedRollLog());
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}

const DICE_NOTATION_ORDER: DiceType[] = [
  "D100",
  "D20",
  "D12",
  "D10",
  "D8",
  "D6",
  "D4",
];

function isD100PairNode(node: Dice): boolean {
  return (
    node.dice.length === 2 &&
    isDie(node.dice[0]) &&
    isDie(node.dice[1]) &&
    node.dice[0].type === "D100" &&
    node.dice[1].type === "D10" &&
    (node.combination === undefined || node.combination === "SUM")
  );
}

function getChildCombinedValue(
  item: Die | Dice,
  values: Record<string, number>
): number | null {
  if (isDie(item)) {
    const val = values[item.id];
    if (val === undefined) return null;
    return val === 0 && item.type === "D10" ? 10 : val;
  }
  return getCombinedDiceValue(item, values);
}

interface ExtractedRollDetails {
  dice: RolledDieSummary[];
  advantage: Advantage;
  countsByType: Partial<Record<DiceType, number>>;
}

function extractRollDetails(
  node: Dice,
  values: Record<string, number>,
  parentKept = true,
  countForNotation = true
): ExtractedRollDetails {
  const dice: RolledDieSummary[] = [];
  const countsByType: Partial<Record<DiceType, number>> = {};
  let advantage: Advantage = null;

  const mergeCounts = (other: Partial<Record<DiceType, number>>) => {
    for (const [k, v] of Object.entries(other)) {
      const type = k as DiceType;
      if (v && v > 0) {
        countsByType[type] = (countsByType[type] ?? 0) + v;
      }
    }
  };

  if (isD100PairNode(node)) {
    const d100 = node.dice[0] as Die;
    const d10 = node.dice[1] as Die;
    const v1 = values[d100.id] ?? 0;
    const v2 = values[d10.id] ?? 0;
    const pairTotal = v1 === 0 && v2 === 0 ? 100 : v1 + v2;
    dice.push({
      type: "D100",
      style: d100.style,
      value: pairTotal,
      kept: parentKept,
    });
    if (countForNotation) {
      countsByType.D100 = (countsByType.D100 ?? 0) + 1;
    }
    return { dice, advantage, countsByType };
  }

  let winnerIndex = -1;
  if (
    (node.combination === "HIGHEST" || node.combination === "LOWEST") &&
    node.dice.length > 0
  ) {
    advantage = node.combination === "HIGHEST" ? "ADVANTAGE" : "DISADVANTAGE";
    let bestVal: number | null = null;
    for (let i = 0; i < node.dice.length; i++) {
      const val = getChildCombinedValue(node.dice[i], values);
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
    const childKept =
      winnerIndex >= 0 ? parentKept && i === winnerIndex : parentKept;
    const shouldCountChild =
      countForNotation && (winnerIndex >= 0 ? i === 0 : true);

    if (isDie(child)) {
      const raw = values[child.id] ?? 0;
      const value = raw === 0 && child.type === "D10" ? 10 : raw;
      dice.push({
        type: child.type,
        style: child.style,
        value,
        kept: childKept,
      });
      if (shouldCountChild) {
        countsByType[child.type] = (countsByType[child.type] ?? 0) + 1;
      }
    } else if (isDice(child)) {
      const sub = extractRollDetails(
        child,
        values,
        childKept,
        shouldCountChild
      );
      dice.push(...sub.dice);
      if (sub.advantage && !advantage) {
        advantage = sub.advantage;
      }
      mergeCounts(sub.countsByType);
    }
  }

  return { dice, advantage, countsByType };
}

function formatRollNotation(
  countsByType: Partial<Record<DiceType, number>>,
  bonus: number
): string {
  const parts: string[] = [];
  for (const type of DICE_NOTATION_ORDER) {
    const count = countsByType[type];
    if (count && count > 0) {
      parts.push(`${count}${type.toLowerCase()}`);
    }
  }
  const base = parts.join("+") || "dice";
  if (bonus > 0) return `${base}+${bonus}`;
  if (bonus < 0) return `${base}${bonus}`;
  return base;
}

/** Builds a completed RollLogEntry if all dice have finished rolling, otherwise returns null. */
export function buildRollLogEntry(params: {
  playerId: string;
  playerName: string;
  playerColor: string;
  roll: DiceRoll;
  rollValues: Record<string, number | null>;
}): RollLogEntry | null {
  const { playerId, playerName, playerColor, roll, rollValues } = params;
  const allDice = getDieFromDice(roll);
  if (allDice.length === 0) return null;

  const finishedValues: Record<string, number> = {};
  for (const d of allDice) {
    const val = rollValues[d.id];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return null;
    }
    finishedValues[d.id] = val;
  }

  const finalValue = getCombinedDiceValue(roll, finishedValues);
  if (finalValue === null) return null;

  const signature = allDice
    .map((d) => `${d.id}:${finishedValues[d.id]}`)
    .sort()
    .join("|");

  const bonus =
    typeof roll.bonus === "number" && Number.isFinite(roll.bonus)
      ? roll.bonus
      : 0;
  const details = extractRollDetails(roll, finishedValues);
  const highestDieValue = getHighestDieValue(roll, finishedValues);

  return {
    id: `${playerId}::${signature}`,
    timestamp: Date.now(),
    playerId,
    playerName: playerName || "Player",
    playerColor: playerColor || "#e2a336",
    label:
      typeof roll.label === "string" && roll.label.trim()
        ? roll.label.trim()
        : undefined,
    notation: formatRollNotation(details.countsByType, bonus),
    advantage: details.advantage,
    bonus,
    finalValue,
    highRoll: roll.highRoll === true,
    highestDieValue: highestDieValue ?? undefined,
    hidden: roll.hidden,
    dice: details.dice,
    countsByType: details.countsByType,
  };
}

/** Deduplicates by roll signature ID and persists to localStorage + Zustand + BroadcastChannel. */
export function recordRollLogEntry(entry: RollLogEntry): void {
  const current = readPersistedRollLog();
  if (current.some((item) => item.id === entry.id)) {
    return;
  }
  const next = [entry, ...current].slice(0, MAX_ROLL_LOG);
  writePersistedRollLog(next);
  useDiceHistoryStore.getState().setRollLog(next);
  broadcastRollLog(next);
}
