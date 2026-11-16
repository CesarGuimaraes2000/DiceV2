import OBR from "@owlbear-rodeo/sdk";
import { useEffect, useRef } from "react";
import { useDiceHistoryStore } from "../controls/history";
import { getDiceToRoll, useDiceControlsStore } from "../controls/store";
import { useDiceRollStore } from "../dice/store";
import { Die } from "../types/Die";
import {
  EXTERNAL_ROLL_CHANNEL,
  EXTERNAL_ROLL_LAST_ID_KEY,
  EXTERNAL_ROLL_METADATA_KEYS,
  EXTERNAL_ROLL_STORAGE_KEY,
  NormalizedExternalRoll,
  extractExternalRollFromMetadata,
  parseExternalRollRequest,
  readStorageJson,
  readStorageString,
  removeStorageItem,
  writeStorageString,
} from "./externalRoll";

function clearMetadataKeysIfPresent(
  metadata: Record<string, unknown> | undefined
) {
  if (!metadata || !OBR.isAvailable || !OBR.isReady) return;
  const update: Record<string, undefined> = {};
  let hasKey = false;
  for (const key of EXTERNAL_ROLL_METADATA_KEYS) {
    if (metadata[key] !== undefined) {
      update[key] = undefined;
      hasKey = true;
    }
  }
  if (hasKey) {
    OBR.player.setMetadata(update);
  }
}

function parseUrlRollRequest(): unknown {
  const params = new URLSearchParams(window.location.search);
  const diceParam = params.get("dice");
  const notationParam = params.get("notation");
  const bonusParam = params.get("bonus");
  const advantageParam = params.get("advantage");
  const hiddenParam = params.get("hidden");
  const autoRollParam = params.get("autoRoll");
  const labelParam = params.get("label");

  if (!diceParam && !notationParam && !bonusParam && !advantageParam) {
    return null;
  }

  let parsedDice: unknown = undefined;
  let notation = notationParam ?? undefined;
  if (diceParam) {
    const trimmed = diceParam.trim();
    if (trimmed.startsWith("{")) {
      try {
        parsedDice = JSON.parse(trimmed);
      } catch {
        notation = notation ?? trimmed;
      }
    } else if (!notation) {
      notation = trimmed;
    }
  }

  const parsedBonus =
    bonusParam !== null && bonusParam.trim() !== ""
      ? Number(bonusParam)
      : undefined;

  return {
    id: params.get("id") || `url:${window.location.search}`,
    dice: parsedDice,
    notation,
    bonus:
      parsedBonus !== undefined && Number.isFinite(parsedBonus)
        ? parsedBonus
        : undefined,
    advantage: advantageParam ?? undefined,
    hidden: hiddenParam === "true" ? true : undefined,
    autoRoll: autoRollParam === "true",
    label: labelParam ?? undefined,
  };
}

function unwrapWindowMessage(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const obj = data as Record<string, unknown>;
  if (obj.type === EXTERNAL_ROLL_CHANNEL && obj.payload !== undefined) {
    return obj.payload;
  }
  if (
    obj.type === EXTERNAL_ROLL_CHANNEL ||
    obj.dice !== undefined ||
    typeof obj.notation === "string"
  ) {
    return obj;
  }
  return null;
}

/**
 * Listens for roll requests sent by companion extensions (e.g. 5eSheets)
 * via OBR player metadata, localStorage, BroadcastChannel, postMessage or URL params.
 */
export function ExternalRollSync() {
  const handledIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let disposed = false;
    let unsubOBR: (() => void) | undefined;

    const triggerImmediateRoll = () => {
      const controls = useDiceControlsStore.getState();
      const dice = getDiceToRoll(
        controls.diceCounts,
        controls.diceAdvantage,
        controls.diceById
      );
      if (dice.length === 0) return;

      useDiceRollStore.getState().startRoll(
        {
          dice,
          bonus: controls.diceBonus,
          hidden: controls.diceHidden,
          highRoll: controls.diceHighRoll,
          label: controls.diceLabel ?? undefined,
        },
        1
      );

      const rolledDiceById: Record<string, Die> = {};
      for (const id of Object.keys(controls.diceCounts)) {
        if (controls.diceById[id]) {
          rolledDiceById[id] = controls.diceById[id];
        }
      }

      useDiceHistoryStore.getState().pushRecentRoll({
        advantage: controls.diceAdvantage,
        counts: controls.diceCounts,
        bonus: controls.diceBonus,
        diceById: rolledDiceById,
      });

      controls.resetDiceCounts();
      controls.setDiceBonus(0);
      controls.setDiceAdvantage(null);
    };

    const applyNormalized = (
      req: NormalizedExternalRoll,
      metadata?: Record<string, unknown>
    ) => {
      if (disposed) return;
      const lastPersisted = readStorageString(EXTERNAL_ROLL_LAST_ID_KEY);
      if (handledIdsRef.current.has(req.id) || req.id === lastPersisted) {
        removeStorageItem(EXTERNAL_ROLL_STORAGE_KEY);
        clearMetadataKeysIfPresent(metadata);
        return;
      }

      handledIdsRef.current.add(req.id);
      writeStorageString(EXTERNAL_ROLL_LAST_ID_KEY, req.id);
      removeStorageItem(EXTERNAL_ROLL_STORAGE_KEY);
      clearMetadataKeysIfPresent(metadata);

      useDiceRollStore.getState().clearRoll();
      useDiceControlsStore.getState().applyExternalRoll({
        countsByType: req.countsByType,
        bonus: req.bonus,
        advantage: req.advantage,
        hidden: req.hidden,
        label: req.label,
      });

      if (req.autoRoll) {
        triggerImmediateRoll();
      }
    };

    const handleRaw = (raw: unknown) => {
      const req = parseExternalRollRequest(raw);
      if (req) applyNormalized(req);
    };

    const handleMetadata = (metadata: Record<string, unknown> | undefined) => {
      const req = extractExternalRollFromMetadata(metadata);
      if (req) applyNormalized(req, metadata);
    };

    // 1. Pending request queued by background.ts in localStorage
    handleRaw(readStorageJson(EXTERNAL_ROLL_STORAGE_KEY));

    // 2. URL search params (?dice=1d20&bonus=5&advantage=ADVANTAGE) for local/standalone testing
    handleRaw(parseUrlRollRequest());

    // 3. BroadcastChannel from background.ts (same origin)
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(EXTERNAL_ROLL_CHANNEL);
      channel.onmessage = (event) => {
        handleRaw(event.data);
      };
    }

    // 4. window.postMessage fallback
    const handleWindowMessage = (event: MessageEvent) => {
      handleRaw(unwrapWindowMessage(event.data));
    };
    window.addEventListener("message", handleWindowMessage);

    // 5. Owlbear Rodeo player metadata
    if (OBR.isAvailable) {
      const initOBR = () => {
        if (disposed) return;
        OBR.player.getMetadata().then((md) => {
          if (!disposed) handleMetadata(md);
        });
        unsubOBR = OBR.player.onChange((player) => {
          if (!disposed) handleMetadata(player.metadata);
        });
      };
      if (OBR.isReady) {
        initOBR();
      } else {
        OBR.onReady(initOBR);
      }
    }

    return () => {
      disposed = true;
      channel?.close();
      window.removeEventListener("message", handleWindowMessage);
      unsubOBR?.();
    };
  }, []);

  return null;
}
