import { forwardRef } from "react";
import SvgIcon, { SvgIconProps } from "@mui/material/SvgIcon";

import { ExplodeMode, normalizeExplodeMode } from "../types/DiceRoll";

const CLOUD_CAP_PATH =
  "M12 2C7.3 2 3.5 4.6 3.5 8c0 2.05 1.4 3.8 3.5 4.65.45.18.95.15 1.38-.05.75-.36 2.1-.6 3.62-.6s2.87.24 3.62.6c.43.2.93.23 1.38.05 2.1-.85 3.5-2.6 3.5-4.65 0-3.4-3.8-6-8.5-6z";
const PRIMARY_CUTOUT_PATH =
  "M10.2 5.2L11.7 3.8H13.2V9.1H14.4V10.4H9.8V9.1H11.3V5.5L10.2 6.3Z";
const ALL_CUTOUT_PATH =
  "M11.1 3.8H12.9L15.2 10.4H13.5L13.05 9.0H10.95L10.5 10.4H8.8ZM12 5.4L11.3 7.7H12.7Z";

export interface ExplosionIconProps extends Omit<SvgIconProps, "mode"> {
  mode?: ExplodeMode | boolean;
}

export const ExplosionIcon = forwardRef<SVGSVGElement, ExplosionIconProps>(
  function ExplosionIcon({ mode, ...props }, ref) {
    const normalizedMode = normalizeExplodeMode(mode);
    const cutoutPath =
      normalizedMode === "PRIMARY"
        ? PRIMARY_CUTOUT_PATH
        : normalizedMode === "ALL"
          ? ALL_CUTOUT_PATH
          : "";

    return (
      <SvgIcon ref={ref} {...props}>
        <path d={`${CLOUD_CAP_PATH}${cutoutPath}`} fillRule="evenodd" />
        <path d="M10 12.3h4V14h-4z" />
        <path d="M7.75 14.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5z" />
        <path d="M10 17h4c.15 1.35 1.05 2.35 2.5 2.85V20h-9v-.15C8.95 19.35 9.85 18.35 10 17z" />
        <path d="M4.75 20.75h14.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5z" />
      </SvgIcon>
    );
  }
);
