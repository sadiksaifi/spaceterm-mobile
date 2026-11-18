import type { JSX } from "react";

import type { DirectoryPicker } from "../use-directory-picker";

export type DirectoryStepProps = {
  machineName: string;
  picker: DirectoryPicker;
  /**
   * Back returns to the Machine step. Where the flow opened on this step, Cancel (iOS) or Close
   * (Android) takes its place and returns to the screen the flow was opened from.
   */
  leading: "back" | "cancel";
  onLeave: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function DirectoryStepScreen(props: DirectoryStepProps): JSX.Element;
