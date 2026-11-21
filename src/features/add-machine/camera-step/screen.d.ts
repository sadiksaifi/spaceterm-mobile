import type { JSX } from "react";

import type { InvitationProblem } from "../flow";
import type { CameraAccess } from "./use-camera-access";

export type CameraStepProps = {
  access: CameraAccess;
  /** True while the step shows and the camera is allowed. */
  scanning: boolean;
  onScan: (data: string) => void;
  /** A tap on the preview scans a fake Invitation Link, where a development build fakes pairing. */
  onFakeScan: (() => void) | undefined;
  /** What a scanned code that cannot pair shows. Only iOS sets it: an alert over the camera. */
  problem: InvitationProblem | null;
  onDismissProblem: () => void;
  onOpenSettings: () => void;
  onPaste: () => void;
  /** Cancel (iOS) or Close (Android): back to the screen the flow was opened from. */
  onCancel: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function CameraStepScreen(props: CameraStepProps): JSX.Element;
