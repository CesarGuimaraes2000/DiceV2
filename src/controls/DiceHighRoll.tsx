import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import HighRollIcon from "@mui/icons-material/EmojiEventsRounded";

import { useDiceRollStore } from "../dice/store";
import { useDiceControlsStore } from "./store";

export function DiceHighRoll() {
  const highRoll = useDiceControlsStore((state) => state.diceHighRoll);
  const toggleDiceHighRoll = useDiceControlsStore(
    (state) => state.toggleDiceHighRoll
  );

  const clearRoll = useDiceRollStore((state) => state.clearRoll);
  const roll = useDiceRollStore((state) => state.roll);
  function clearRollIfNeeded() {
    if (roll) {
      clearRoll();
    }
  }

  return (
    <Tooltip
      title={highRoll ? "Disable High Roll" : "High Roll (Highest Die)"}
      placement="top"
      disableInteractive
    >
      <IconButton
        aria-label="high roll"
        aria-pressed={highRoll}
        onClick={() => {
          toggleDiceHighRoll();
          clearRollIfNeeded();
        }}
      >
        <HighRollIcon sx={highRoll ? { color: "#f0bf55" } : undefined} />
      </IconButton>
    </Tooltip>
  );
}
