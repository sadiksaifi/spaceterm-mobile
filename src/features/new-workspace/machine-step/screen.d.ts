import type { JSX } from "react";

import type { Machine } from "@/shared/machines/model";

export type MachineStepProps = {
  machines: readonly Machine[];
  /** Opens the directories of a connected Machine. */
  onPick: (machineId: string) => void;
  onCancel: () => void;
  /** Pull to refresh. Settles once each Machine it tries to reach answers or fails. */
  onRefresh: () => Promise<void>;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function MachineStepScreen(props: MachineStepProps): JSX.Element;
