import type { JSX } from "react";

import type { Machine } from "@/shared/machines/model";

import type { MachinePage } from "./use-machine-page";

export type MachinePageProps = {
  machine: Machine;
  /** The Terminal Sessions Restart SpaceTerm Core ends. */
  terminalSessions: number;
  page: MachinePage;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function MachinePageScreen(props: MachinePageProps): JSX.Element;
