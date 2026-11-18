import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useRef } from "react";
import { buildRollLogEntry, recordRollLogEntry } from "../controls/history";
import { useDiceRollStore } from "../dice/store";
import { getDieFromDice } from "../helpers/getDieFromDice";
import { getPluginId } from "./getPluginId";

/** Syncs the current dice roll to OBR metadata and records completed local rolls in the roll log. */
export function DiceRollSync() {
  const prevIds = useRef<string[]>([]);
  const localPlayerRef = useRef({
    id: "local-player",
    name: "Player",
    color: "#e2a336",
  });

  useEffect(() => {
    let active = true;
    localPlayerRef.current.id = OBR.player.id;
    Promise.all([OBR.player.getName(), OBR.player.getColor()]).then(
      ([name, color]) => {
        if (!active) return;
        localPlayerRef.current = {
          id: OBR.player.id,
          name: name || "Player",
          color: color || "#e2a336",
        };
      }
    );
    const unsubPlayer = OBR.player.onChange((p) => {
      localPlayerRef.current = {
        id: p.id,
        name: p.name || "Player",
        color: p.color || "#e2a336",
      };
    });
    return () => {
      active = false;
      unsubPlayer();
    };
  }, []);

  useEffect(
    () =>
      useDiceRollStore.subscribe((state) => {
        let changed = false;
        let finishedNow = false;
        if (!state.roll) {
          changed = true;
          prevIds.current = [];
        } else {
          const ids = getDieFromDice(state.roll).map((die) => die.id);
          const allRolled =
            ids.length > 0 &&
            !state.pendingExplosion &&
            Object.values(state.rollValues).every((value) => value !== null);

          if (prevIds.current.length !== ids.length) {
            changed = true;
          } else if (
            !ids.every((id, index) => id === prevIds.current[index])
          ) {
            changed = true;
          } else if (allRolled) {
            changed = true;
            finishedNow = true;
          }
          prevIds.current = ids;
        }

        if (changed) {
          // Hide values if needed
          const throws = state.roll?.hidden ? undefined : state.rollThrows;
          const values = state.roll?.hidden ? undefined : state.rollValues;
          const transforms = state.roll?.hidden
            ? undefined
            : state.rollTransforms;
          OBR.player.setMetadata({
            [getPluginId("roll")]: state.roll,
            [getPluginId("rollThrows")]: throws,
            [getPluginId("rollValues")]: values,
            [getPluginId("rollTransforms")]: transforms,
          });
        }

        if (finishedNow && state.roll) {
          const entry = buildRollLogEntry({
            playerId: localPlayerRef.current.id,
            playerName: localPlayerRef.current.name,
            playerColor: localPlayerRef.current.color,
            roll: state.roll,
            rollValues: state.rollValues,
          });
          if (entry) {
            recordRollLogEntry(entry);
          }
        }
      }),
    []
  );

  return null;
}
