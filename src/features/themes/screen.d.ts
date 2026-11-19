import type { JSX } from "react";

import type { Appearance, TerminalTheme, ThemeAppearance } from "@/shared/preferences/model";

export type ThemesProps = {
  appearance: Appearance;
  /** The appearance the list chooses a theme for. */
  shown: ThemeAppearance;
  /** The theme chosen for each appearance. */
  chosen: Readonly<Record<ThemeAppearance, TerminalTheme>>;
  /** The themes for `shown` that match the search. */
  themes: readonly TerminalTheme[];
  query: string;
  /** The theme whose removal waits for the person to confirm it. */
  removing: TerminalTheme | null;
  onAppearance: (appearance: Appearance) => void;
  /** Under Automatic, picks the appearance the list chooses for. */
  onShow: (appearance: ThemeAppearance) => void;
  onChoose: (themeId: string) => void;
  onQuery: (query: string) => void;
  onAskRemove: (theme: TerminalTheme) => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onGetMore: () => void;
};

/** Implemented per platform in `screen.ios.tsx` and `screen.android.tsx`. */
export default function ThemesScreen(props: ThemesProps): JSX.Element;
