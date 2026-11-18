import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { ExplosionIcon } from "../icons/ExplosionIcon";
import { useDiceRollStore } from "../dice/store";
import { useDiceControlsStore } from "./store";

export function DiceExplode() {
  const explode = useDiceControlsStore((state) => state.diceExplode);
  const toggleDiceExplode = useDiceControlsStore(
    (state) => state.toggleDiceExplode
  );

  const clearRoll = useDiceRollStore((state) => state.clearRoll);
  const roll = useDiceRollStore((state) => state.roll);
  function clearRollIfNeeded() {
    if (roll) {
      clearRoll();
    }
  }

  const tooltipTitle =
    explode === "PRIMARY"
      ? "Exploding Die: Primary"
      : explode === "ALL"
        ? "Exploding Die: All"
        : "Exploding Die";

  return (
    <Tooltip title={tooltipTitle} placement="top" disableInteractive>
      <IconButton
        aria-label="exploding die"
        aria-pressed={Boolean(explode)}
        onClick={() => {
          toggleDiceExplode();
          clearRollIfNeeded();
        }}
      >
        <ExplosionIcon
          mode={explode}
          sx={explode ? { color: "#ff9800" } : undefined}
        />
      </IconButton>
    </Tooltip>
  );
}
