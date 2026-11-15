import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./plugin/getPluginId";
import {
  EXTERNAL_ROLL_CHANNEL,
  EXTERNAL_ROLL_LAST_ID_KEY,
  EXTERNAL_ROLL_STORAGE_KEY,
  extractExternalRollFromMetadata,
  readStorageString,
  writeStorageString,
} from "./plugin/externalRoll";

let lastHandledId: string | null = readStorageString(EXTERNAL_ROLL_LAST_ID_KEY);

function handlePlayerMetadata(metadata: Record<string, unknown> | undefined) {
  const req = extractExternalRollFromMetadata(metadata);
  if (!req) return;
  const persistedLastId = readStorageString(EXTERNAL_ROLL_LAST_ID_KEY);
  if (req.id === lastHandledId || req.id === persistedLastId) return;

  lastHandledId = req.id;
  writeStorageString(EXTERNAL_ROLL_STORAGE_KEY, JSON.stringify(req));

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(EXTERNAL_ROLL_CHANNEL);
    channel.postMessage(req);
    channel.close();
  }

  OBR.action.open();
}

OBR.onReady(() => {
  OBR.popover.open({
    id: getPluginId("popover"),
    url: "/popover.html",
    width: 0,
    height: 0,
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    disableClickAway: true,
    hidePaper: true,
    marginThreshold: 0,
  });

  OBR.player.getMetadata().then(handlePlayerMetadata);
  OBR.player.onChange((player) => {
    handlePlayerMetadata(player.metadata);
  });
});
