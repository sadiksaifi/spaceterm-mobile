import type { JSX } from "react";

import type { InvitationReading } from "@/shared/machines/model";

export type LinkStepProps = {
  /** What the field starts with. A paste gives it a new `fieldVersion`, which redraws it. */
  link: string;
  fieldVersion: number;
  /** A new link from another app gives the form a new version, which empties Network Address. */
  formVersion: number;
  /** True once the person typed in the field. iOS then shows no alert, which would stop the typing. */
  typed: boolean;
  /** What the link says, or `null` while the field holds no Invitation Link. */
  reading: InvitationReading | null;
  onEditLink: (link: string) => void;
  onPaste: () => void;
  /** OK in the iOS alert: the link is cleared, so Paste can bring another. */
  onDismissProblem: () => void;
  onEditNetworkAddress: (address: string) => void;
  /** Starts pairing; `undefined` while the link cannot pair. */
  onJoin: (() => void) | undefined;
  /** Android's Back. iOS shows the system's own. */
  onBack: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function LinkStepScreen(props: LinkStepProps): JSX.Element;
