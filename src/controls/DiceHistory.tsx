import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import CloseIcon from "@mui/icons-material/CloseRounded";
import ClearAllIcon from "@mui/icons-material/DeleteSweepRounded";
import HighRollIcon from "@mui/icons-material/EmojiEventsRounded";
import NoHistoryIcon from "@mui/icons-material/ManageSearchRounded";
import HistoryIcon from "@mui/icons-material/SavedSearchRounded";
import HiddenIcon from "@mui/icons-material/VisibilityOffRounded";

import { ExplosionIcon } from "../icons/ExplosionIcon";
import { useDiceRollStore } from "../dice/store";
import { normalizeExplodeMode } from "../types/DiceRoll";
import {
  RollLogEntry,
  initRollLogSync,
  useDiceHistoryStore,
} from "./history";
import { DiceCounts, getDiceToRoll, useDiceControlsStore } from "./store";

export function DiceHistory() {
  const startRoll = useDiceRollStore((state) => state.startRoll);

  const hidden = useDiceControlsStore((state) => state.diceHidden);
  const highRoll = useDiceControlsStore((state) => state.diceHighRoll);
  const explode = useDiceControlsStore((state) => state.diceExplode);
  const diceSet = useDiceControlsStore((state) => state.diceSet);
  const diceById = useDiceControlsStore((state) => state.diceById);
  const setBonus = useDiceControlsStore((state) => state.setDiceBonus);
  const setAdvantage = useDiceControlsStore((state) => state.setDiceAdvantage);
  const setLabel = useDiceControlsStore((state) => state.setDiceLabel);
  const resetDiceCounts = useDiceControlsStore(
    (state) => state.resetDiceCounts
  );

  useEffect(() => initRollLogSync(), []);

  const rollLog = useDiceHistoryStore((state) => state.rollLog);
  const removeRollLogEntry = useDiceHistoryStore(
    (state) => state.removeRollLogEntry
  );
  const clearRollLog = useDiceHistoryStore((state) => state.clearRollLog);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    setAnchorEl(event.currentTarget);
  }
  function handleClose() {
    setAnchorEl(null);
  }

  function handleRerollEntry(entry: RollLogEntry) {
    if (!entry.countsByType) return;
    const mappedCounts: DiceCounts = {};
    for (const die of diceSet.dice) {
      mappedCounts[die.id] = 0;
    }
    for (const [type, count] of Object.entries(entry.countsByType)) {
      if (!count || count <= 0) continue;
      const match = diceSet.dice.find((d) => d.type === type);
      if (match) {
        mappedCounts[match.id] = count;
      }
    }
    const effectiveExplode =
      entry.explode !== undefined
        ? normalizeExplodeMode(entry.explode)
        : explode;
    const dice = getDiceToRoll(
      mappedCounts,
      entry.advantage,
      diceById,
      effectiveExplode
    );
    if (dice.length === 0) return;

    startRoll(
      {
        dice,
        bonus: entry.bonus,
        hidden,
        highRoll: entry.highRoll ?? highRoll,
        explode: effectiveExplode,
        label: entry.label,
      },
      1
    );
    resetDiceCounts();
    setBonus(0);
    setAdvantage(null);
    setLabel(null);
    handleClose();
  }

  return (
    <>
      <Tooltip title="History" placement="top" disableInteractive>
        <IconButton
          id="history-button"
          aria-controls={open ? "history-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={handleClick}
        >
          <HistoryIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="history-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "history-button",
          sx: { py: 0.5 },
        }}
        anchorOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
      >
        <Stack width="310px" maxHeight="440px">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            px={1.5}
            py={0.75}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              Roll History ({rollLog.length})
            </Typography>
            {rollLog.length > 0 && (
              <Tooltip title="Clear history">
                <IconButton
                  size="small"
                  onClick={() => clearRollLog()}
                  aria-label="Clear history"
                >
                  <ClearAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Divider />
          <Stack
            px={1}
            py={1}
            gap={0.75}
            sx={{ overflowY: "auto", maxHeight: "380px" }}
          >
            {rollLog.map((entry) => (
              <RollLogCard
                key={entry.id}
                entry={entry}
                onReroll={() => handleRerollEntry(entry)}
                onDelete={() => removeRollLogEntry(entry.id)}
              />
            ))}
            {rollLog.length === 0 && <EmptyMessage />}
          </Stack>
        </Stack>
      </Menu>
    </>
  );
}

function RollLogCard({
  entry,
  onReroll,
  onDelete,
}: {
  entry: RollLogEntry;
  onReroll: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const canReroll = Boolean(
    entry.countsByType && Object.keys(entry.countsByType).length > 0
  );
  const isHighRoll = entry.highRoll === true;
  const explodeMode = normalizeExplodeMode(entry.explode);
  const isExplode = Boolean(explodeMode);
  const highestVal =
    entry.highestDieValue !== undefined
      ? entry.highestDieValue
      : entry.dice.length > 0
        ? Math.max(...entry.dice.map((d) => d.value))
        : null;

  return (
    <Paper
      variant="outlined"
      onClick={canReroll ? onReroll : undefined}
      sx={{
        p: 1,
        borderRadius: 1.5,
        cursor: canReroll ? "pointer" : "default",
        bgcolor:
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.04)"
            : "rgba(0, 0, 0, 0.03)",
        "&:hover": canReroll
          ? {
              borderColor: theme.palette.primary.main,
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.06)",
            }
          : undefined,
      }}
    >
      <Stack gap={0.5}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: entry.playerColor,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" fontWeight={700} noWrap>
              {entry.playerName}
            </Typography>
            {isHighRoll && (
              <Tooltip title="High Roll">
                <HighRollIcon sx={{ fontSize: 13, color: "#f0bf55" }} />
              </Tooltip>
            )}
            {isExplode && (
              <Tooltip
                title={
                  explodeMode === "PRIMARY"
                    ? "Exploding Die: Primary"
                    : "Exploding Die: All"
                }
              >
                <ExplosionIcon
                  mode={explodeMode}
                  sx={{ fontSize: 13, color: "#ff9800" }}
                />
              </Tooltip>
            )}
            {entry.hidden && (
              <Tooltip title="Hidden Roll">
                <HiddenIcon sx={{ fontSize: 13, opacity: 0.7 }} />
              </Tooltip>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.25} flexShrink={0}>
            <Typography variant="caption" color="text.secondary" fontSize={10}>
              {timeStr}
            </Typography>
            <IconButton
              size="small"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Remove entry"
              sx={{ p: 0.25, opacity: 0.6, "&:hover": { opacity: 1 } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        </Stack>

        {entry.label && (
          <Typography
            variant="caption"
            fontWeight={600}
            color="primary.main"
            noWrap
          >
            {entry.label}
          </Typography>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            gap={0.5}
            minWidth={0}
          >
            <Typography variant="caption" color="text.secondary">
              {entry.notation}
            </Typography>
            {entry.advantage && (
              <Chip
                size="small"
                label={entry.advantage === "ADVANTAGE" ? "Adv" : "Dis"}
                sx={{
                  height: 16,
                  fontSize: 10,
                  ".MuiChip-label": { px: 0.75 },
                }}
              />
            )}
            {entry.dice.map((d, i) => {
              const isNat20 = d.kept && d.type === "D20" && d.value === 20;
              const isNat1 = d.kept && d.type === "D20" && d.value === 1;
              const isHighestGold =
                isHighRoll && highestVal !== null && d.value === highestVal;
              const isPrimaryDie =
                explodeMode === "PRIMARY" && Boolean(d.primary);
              const canDieExplode =
                explodeMode === "ALL" || Boolean(d.primary || d.exploded);
              const isExplodedOrange =
                isExplode &&
                !isHighestGold &&
                canDieExplode &&
                Boolean(d.exploded || (d.kept && d.maxRoll));
              return (
                <Box
                  key={i}
                  component="span"
                  title={isPrimaryDie ? "Primary Exploding Die" : undefined}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.25,
                    px: isPrimaryDie ? 0.7 : 0.6,
                    py: 0.1,
                    borderRadius: isPrimaryDie ? "999px" : 0.75,
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    opacity: d.kept ? 1 : 0.45,
                    textDecoration: d.kept ? "none" : "line-through",
                    border: isHighestGold
                      ? isPrimaryDie
                        ? "1.5px solid #f0bf55"
                        : "1px solid rgba(240, 191, 85, 0.7)"
                      : isExplodedOrange
                        ? isPrimaryDie
                          ? "1.5px solid #ff9800"
                          : "1px solid rgba(255, 152, 0, 0.7)"
                        : isPrimaryDie
                          ? "1px dashed rgba(255, 152, 0, 0.8)"
                          : undefined,
                    bgcolor: isHighestGold
                      ? "rgba(240, 191, 85, 0.25)"
                      : isExplodedOrange
                        ? "rgba(255, 152, 0, 0.22)"
                        : isNat20
                          ? "rgba(79, 209, 139, 0.2)"
                          : isNat1
                            ? "rgba(240, 100, 110, 0.2)"
                            : isPrimaryDie
                              ? "rgba(255, 152, 0, 0.12)"
                              : theme.palette.mode === "dark"
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.08)",
                    color: isHighestGold
                      ? "#f0bf55"
                      : isExplodedOrange
                        ? "#ff9800"
                        : isNat20
                          ? "#4fd18b"
                          : isNat1
                            ? "#f0646e"
                            : isPrimaryDie
                              ? "#ffb74d"
                              : "text.primary",
                  }}
                >
                  {isPrimaryDie && (
                    <ExplosionIcon
                      mode="PRIMARY"
                      sx={{
                        fontSize: 10,
                        color: isHighestGold ? "#f0bf55" : "#ff9800",
                      }}
                    />
                  )}
                  {d.value}
                </Box>
              );
            })}
            {entry.bonus !== 0 && (
              <Typography variant="caption" color="text.secondary">
                {entry.bonus > 0 ? `+${entry.bonus}` : entry.bonus}
              </Typography>
            )}
          </Stack>

          <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              sx={{ lineHeight: 1 }}
            >
              {entry.finalValue}
            </Typography>
            {isHighRoll && highestVal !== null && (
              <Typography
                variant="caption"
                sx={{
                  color: "#f0bf55",
                  fontWeight: 800,
                  fontSize: 11,
                  lineHeight: 1.15,
                  mt: 0.25,
                }}
              >
                {highestVal}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

function EmptyMessage() {
  const theme = useTheme();

  return (
    <Stack
      sx={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 0.5,
        py: 2,
      }}
    >
      <Box
        component="div"
        sx={{
          fontSize: "2rem",
          color:
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.46)"
              : "rgba(0, 0, 0, 0.46)",
          display: "flex",
          p: 1,
        }}
      >
        <NoHistoryIcon />
      </Box>
      <Typography variant="h6">No History</Typography>
      <Typography variant="caption" textAlign="center">
        Roll dice to add to the roll history.
      </Typography>
    </Stack>
  );
}
