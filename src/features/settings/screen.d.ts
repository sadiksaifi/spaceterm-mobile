import type { JSX } from "react";

import type { Machine } from "@/shared/machines/model";
import type { PrivacySetting } from "@/shared/preferences/model";

export type SettingsProps = {
  machines: readonly Machine[];
  /** The name of the Terminal Theme in use now. */
  themeName: string;
  fontSize: number;
  privacy: Readonly<Record<PrivacySetting, boolean>>;
  onOpenMachine: (machineId: string) => void;
  onAddMachine: () => void;
  onOpenThemes: () => void;
  onFontSize: (points: number) => void;
  onPrivacy: (setting: PrivacySetting, on: boolean) => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function SettingsScreen(props: SettingsProps): JSX.Element;
