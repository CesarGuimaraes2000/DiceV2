import { useEffect, useRef } from "react";
import { DiceTransform } from "../types/DiceTransform";
import { DiceRoll } from "./DiceRoll";
import { InteractiveDice } from "./InteractiveDice";
import { useDiceRollStore } from "./store";

/** Dice roll based off of the values from the dice roll store */
export function InteractiveDiceRoll() {
  const roll = useDiceRollStore((state) => state.roll);
  const rollThrows = useDiceRollStore((state) => state.rollThrows);
  const finishDieRoll = useDiceRollStore((state) => state.finishDieRoll);
  const pendingExplosion = useDiceRollStore((state) => state.pendingExplosion);
  const spawnExplodingDice = useDiceRollStore(
    (state) => state.spawnExplodingDice
  );

  const finishedTransforms = useDiceRollStore((state) => {
    if (state.pendingExplosion) {
      return undefined;
    }
    const values = Object.values(state.rollTransforms);
    if (values.some((v) => v === null)) {
      return undefined;
    }
    return state.rollTransforms as Record<string, DiceTransform>;
  });

  useEffect(() => {
    if (!pendingExplosion) return;
    const timer = window.setTimeout(() => {
      spawnExplodingDice();
    }, 550);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pendingExplosion, spawnExplodingDice]);

  const transformsRef = useRef<Record<string, DiceTransform | null> | null>(
    null
  );
  useEffect(
    () =>
      useDiceRollStore.subscribe((state) => {
        transformsRef.current = state.rollTransforms;
      }),
    []
  );

  if (!roll) {
    return null;
  }

  return (
    <DiceRoll
      roll={roll}
      rollThrows={rollThrows}
      finishedTransforms={finishedTransforms}
      onRollFinished={finishDieRoll}
      Dice={InteractiveDice}
      transformsRef={transformsRef}
    />
  );
}
