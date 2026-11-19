import { builtInThemes } from "./built-in-themes";
import type {
  Appearance,
  Preferences,
  PrivacySetting,
  TerminalTheme,
  ThemeAppearance,
} from "./model";

/** The device's key-value storage, read and written synchronously. */
export type KeyValueStorage = {
  getItemSync: (key: string) => string | null;
  setItemSync: (key: string, value: string) => void;
};

/** Terminal text size, in points. */
export const FONT_SIZE = { min: 9, max: 18, initial: 13 } as const;

/**
 * Whether a change was saved on the device. One that was not, such as on a full disk, shows
 * nowhere: a control set to it stays where it was.
 */
export type Saved = "saved" | "not-saved";

export type PreferencesStore = {
  getSnapshot: () => Preferences;
  subscribe: (listener: () => void) => () => void;
  setFontSize: (points: number) => Saved;
  setPrivacy: (setting: PrivacySetting, on: boolean) => Saved;
  setAppearance: (appearance: Appearance) => Saved;
  /** Makes a theme the chosen one for the appearance it is made for. */
  chooseTheme: (themeId: string) => Saved;
  /** Adds themes after the others. One with the id of a theme already here replaces it in place. */
  addThemes: (themes: readonly TerminalTheme[]) => Saved;
  /** Removes an added theme. A removed chosen theme gives way to SpaceTerm's own. */
  removeTheme: (themeId: string) => Saved;
  /** Removes every theme a Zed extension added. */
  removeExtension: (extensionId: string) => Saved;
};

/** What the store keeps under its key: the built-in themes are not kept. */
type Kept = Omit<Preferences, "themes"> & { added: readonly TerminalTheme[] };

const KEY = "preferences";

const initial: Kept = {
  fontSize: FONT_SIZE.initial,
  privacy: {
    notifications: true,
    terminalAttention: true,
    programsCopyText: true,
    // A program reads the clipboard only once the person allows it.
    programsReadClipboard: false,
  },
  appearance: "automatic",
  chosen: { light: builtInThemes.light.id, dark: builtInThemes.dark.id },
  added: [],
};

/** The preferences kept in `storage`, which every change is written back to. */
export function createPreferencesStore(storage: KeyValueStorage): PreferencesStore {
  let kept = read(storage.getItemSync(KEY));
  let snapshot = toSnapshot(kept);
  const listeners = new Set<() => void>();

  /** Saves first, so a change that could not be saved shows nowhere. */
  function change(next: Kept): Saved {
    const candidate = withChosenThemes(next);
    try {
      storage.setItemSync(KEY, JSON.stringify(candidate));
    } catch {
      return "not-saved";
    }
    kept = candidate;
    snapshot = toSnapshot(kept);
    for (const listener of listeners) listener();
    return "saved";
  }

  const withoutThemes = (removed: (theme: TerminalTheme) => boolean): Saved => {
    const added = kept.added.filter((theme) => !removed(theme));
    return added.length === kept.added.length ? "saved" : change({ ...kept, added });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setFontSize: (points) => {
      const fontSize = Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(points)));
      return fontSize === kept.fontSize ? "saved" : change({ ...kept, fontSize });
    },
    setPrivacy: (setting, on) => {
      return kept.privacy[setting] === on
        ? "saved"
        : change({ ...kept, privacy: { ...kept.privacy, [setting]: on } });
    },
    setAppearance: (appearance) => {
      return appearance === kept.appearance ? "saved" : change({ ...kept, appearance });
    },
    chooseTheme: (themeId) => {
      const theme = snapshot.themes.find((candidate) => candidate.id === themeId);
      // A theme that is not here cannot be chosen, so there is nothing to save.
      if (theme === undefined || kept.chosen[theme.appearance] === themeId) return "saved";
      return change({ ...kept, chosen: { ...kept.chosen, [theme.appearance]: themeId } });
    },
    addThemes: (themes) => {
      const incoming = new Map(themes.map((theme) => [theme.id, theme]));
      const replaced = kept.added.map((theme) => incoming.get(theme.id) ?? theme);
      const known = new Set(kept.added.map((theme) => theme.id));
      const fresh = [...incoming.values()].filter((theme) => !known.has(theme.id));
      return change({ ...kept, added: [...replaced, ...fresh] });
    },
    removeTheme: (themeId) => withoutThemes((theme) => theme.id === themeId),
    removeExtension: (extensionId) =>
      withoutThemes(
        (theme) => theme.source.kind === "extension" && theme.source.id === extensionId,
      ),
  };
}

function toSnapshot({ added, ...rest }: Kept): Preferences {
  return { ...rest, themes: [builtInThemes.light, builtInThemes.dark, ...added] };
}

/** A chosen theme that is no longer here gives way to the built-in theme of its appearance. */
function withChosenThemes(kept: Kept): Kept {
  const here = (appearance: ThemeAppearance) =>
    kept.added.some(
      (theme) => theme.id === kept.chosen[appearance] && theme.appearance === appearance,
    )
      ? kept.chosen[appearance]
      : builtInThemes[appearance].id;
  const chosen = { light: here("light"), dark: here("dark") };
  return chosen.light === kept.chosen.light && chosen.dark === kept.chosen.dark
    ? kept
    : { ...kept, chosen };
}

/** What `stored` holds, field by field: a field that cannot be read takes its initial value. */
function read(stored: string | null): Kept {
  let value: unknown;
  try {
    value = stored === null ? null : JSON.parse(stored);
  } catch {
    value = null;
  }
  if (!isRecord(value)) return initial;
  const privacy = isRecord(value.privacy) ? value.privacy : {};
  const chosen = isRecord(value.chosen) ? value.chosen : {};
  return withChosenThemes({
    fontSize:
      typeof value.fontSize === "number" &&
      value.fontSize >= FONT_SIZE.min &&
      value.fontSize <= FONT_SIZE.max
        ? value.fontSize
        : initial.fontSize,
    privacy: {
      notifications: boolean(privacy.notifications, initial.privacy.notifications),
      terminalAttention: boolean(privacy.terminalAttention, initial.privacy.terminalAttention),
      programsCopyText: boolean(privacy.programsCopyText, initial.privacy.programsCopyText),
      programsReadClipboard: boolean(
        privacy.programsReadClipboard,
        initial.privacy.programsReadClipboard,
      ),
    },
    appearance:
      value.appearance === "light" ||
      value.appearance === "dark" ||
      value.appearance === "automatic"
        ? value.appearance
        : initial.appearance,
    chosen: {
      light: typeof chosen.light === "string" ? chosen.light : initial.chosen.light,
      dark: typeof chosen.dark === "string" ? chosen.dark : initial.chosen.dark,
    },
    added: Array.isArray(value.added) ? value.added.filter(isTheme) : [],
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const isColor = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const isAnsi = (value: unknown) =>
  Array.isArray(value) && value.length === 8 && value.every(isColor);

function isTheme(value: unknown): value is TerminalTheme {
  if (!isRecord(value) || !isRecord(value.colors) || !isRecord(value.source)) return false;
  const { colors, source } = value;
  const sourceOk =
    (source.kind === "extension" &&
      typeof source.id === "string" &&
      typeof source.name === "string") ||
    (source.kind === "file" && typeof source.name === "string");
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.appearance === "light" || value.appearance === "dark") &&
    sourceOk &&
    isColor(colors.background) &&
    isColor(colors.foreground) &&
    isColor(colors.cursor) &&
    isAnsi(colors.normal) &&
    isAnsi(colors.bright)
  );
}
