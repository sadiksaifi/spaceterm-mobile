import type { JSX } from "react";

import type { PairingView } from "../use-pairing";

export type CodeStepProps = {
  machineName: string;
  pairing: PairingView;
  /** Android's Back: to the step before, which is the camera after a failed pairing. */
  onBack: () => void;
  onTryAgain: () => void;
  /** Stop Unfinished Pairings, once the person confirms it; then pairs again with the same link. */
  onStopUnfinished: () => void;
  /** Cancel, and Done once paired: back to the screen the flow was opened from. */
  onClose: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function CodeStepScreen(props: CodeStepProps): JSX.Element;
