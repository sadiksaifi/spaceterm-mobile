import { builtInThemes } from "@/shared/preferences/built-in-themes";
import type { AnsiColors, TerminalTheme, ThemeAppearance } from "@/shared/preferences/model";

/** Where a Zed theme file came from: an extension in Zed's store, or a file the person picked. */
export type ZedThemeOrigin =
  | { kind: "extension"; id: string; name: string }
  | { kind: "file"; fileName: string };

/**
 * The most themes one Get or file adds, so a file cannot fill the device's preferences. Zed's
 * largest theme extension, base16, holds 251.
 */
export const MAX_THEMES = 500;
/** The longest theme or family name read; a longer one is left out. */
const MAX_NAME = 200;

/** A name as a person would see it, or null when there is none worth showing. */
const toName = (value: unknown) => {
  const name = typeof value === "string" ? value.trim() : "";
  return name === "" || name.length > MAX_NAME ? null : name;
};

/** A name as one part of a theme id, its slashes escaped so no two names give the same id. */
const idPart = (name: string) => name.replaceAll("%", "%25").replaceAll("/", "%2F");

const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/**
 * The Terminal Themes in a Zed theme file: its terminal colors, with the editor's colors and then
 * SpaceTerm's own palette standing in for any it leaves out. A file that is not a Zed theme
 * holds none. It stops one theme past `room`, so a caller can tell a file with more than that
 * without building them all.
 */
export function readZedThemes(
  file: string,
  origin: ZedThemeOrigin,
  room: number = MAX_THEMES,
): TerminalTheme[] {
  const family = parseLenient(file);
  if (!isRecord(family) || !Array.isArray(family.themes)) return [];
  const familyName =
    toName(family.name) ??
    (origin.kind === "file" ? origin.fileName.replace(/\.json$/i, "") : origin.name);
  const source =
    origin.kind === "extension"
      ? ({ kind: "extension", id: origin.id, name: origin.name } as const)
      : ({ kind: "file", name: familyName } as const);
  const idPrefix = origin.kind === "extension" ? idPart(origin.id) : `file/${idPart(familyName)}`;

  const themes: TerminalTheme[] = [];
  for (const theme of family.themes) {
    if (themes.length > room) break;
    if (!isRecord(theme)) continue;
    const name = toName(theme.name);
    if (name === null) continue;
    if (theme.appearance !== "light" && theme.appearance !== "dark") continue;
    // A color theme has a style, though any color in it may be missing; an icon theme has none.
    if (!isRecord(theme.style)) continue;
    themes.push({
      id: `${idPrefix}/${idPart(name)}`,
      name,
      appearance: theme.appearance,
      source,
      colors: terminalColors(theme.style, theme.appearance),
    });
  }
  return themes;
}

function terminalColors(style: Record<string, unknown>, appearance: ThemeAppearance) {
  const fallback = builtInThemes[appearance].colors;
  // The first of `keys` that holds a color, laid over `under` if it is see-through.
  const first = (under: string, ...keys: string[]) => {
    for (const key of keys) {
      const color = toColor(style[key]);
      if (color !== null) return over(color, under);
    }
    return null;
  };
  // The keys and their order follow SpaceTerm Desktop, so a theme looks the same on both.
  const background =
    first(
      fallback.background,
      "terminal.background",
      "terminal.ansi.background",
      "editor.background",
      "background",
    ) ?? fallback.background;
  const foreground =
    first(background, "terminal.foreground", "editor.foreground", "text") ?? fallback.foreground;
  const players = Array.isArray(style.players) ? style.players : [];
  const player = isRecord(players[0]) ? players[0] : {};
  const playerCursor = toColor(player.cursor);
  const cursor =
    playerCursor === null
      ? (first(background, "editor.foreground") ?? foreground)
      : over(playerCursor, background);
  const ansi = (prefix: string, colors: AnsiColors) =>
    ANSI.map(
      (name, index) => first(background, `terminal.ansi.${prefix}${name}`) ?? colors[index],
    ) as unknown as AnsiColors;
  const normal = ansi("", fallback.normal);
  // A theme with its own normal colors keeps their hues where it leaves out a bright one.
  return { background, foreground, cursor, normal, bright: ansi("bright_", normal) };
}

type Color = { rgb: readonly [number, number, number]; alpha: number };

/** A CSS hex color, short forms included, or null for anything else. A fully clear one counts. */
function toColor(value: unknown): Color | null {
  if (typeof value !== "string") return null;
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (match === null) return null;
  const digits =
    match[1].length <= 4 ? Array.from(match[1], (digit) => digit + digit).join("") : match[1];
  const channel = (at: number) => Number.parseInt(digits.slice(at, at + 2), 16);
  const alpha = digits.length === 8 ? channel(6) / 255 : 1;
  return { rgb: [channel(0), channel(2), channel(4)], alpha };
}

/** `color` laid over the opaque `under`, as `#rrggbb`. */
function over({ rgb, alpha }: Color, under: string): string {
  const base = toColor(under)?.rgb ?? [0, 0, 0];
  return `#${rgb
    .map((value, index) => {
      const mixed = Math.round((base[index] ?? 0) + (value - (base[index] ?? 0)) * alpha);
      return mixed.toString(16).padStart(2, "0");
    })
    .join("")}`;
}

/** JSON as Zed reads it: comments and trailing commas allowed. Text that is not JSON is null. */
function parseLenient(text: string): unknown {
  try {
    // A file saved with a byte order mark keeps it when read as text on Android.
    return JSON.parse(withoutCommentsAndTrailingCommas(text.replace(/^\uFEFF/, "")));
  } catch {
    return null;
  }
}

function withoutCommentsAndTrailingCommas(text: string): string {
  return outsideStrings(outsideStrings(text, withoutComment), withoutTrailingComma);
}

/** Drops a comment at `index`, or returns null when none starts there. */
function withoutComment(text: string, index: number): { skip: number; keep: string } | null {
  if (text[index] !== "/") return null;
  if (text[index + 1] === "/") {
    const end = text.indexOf("\n", index);
    return { skip: end === -1 ? text.length : end, keep: "" };
  }
  if (text[index + 1] === "*") {
    const end = text.indexOf("*/", index + 2);
    return { skip: end === -1 ? text.length : end + 2, keep: " " };
  }
  return null;
}

/** Drops a comma at `index` that only whitespace separates from a closing bracket. */
function withoutTrailingComma(text: string, index: number): { skip: number; keep: string } | null {
  if (text[index] !== ",") return null;
  // Scanned in place: Hermes copies a slice, and a theme file holds a comma every few characters.
  let next = index + 1;
  while (/\s/.test(text[next] ?? "")) next++;
  return text[next] === "}" || text[next] === "]" ? { skip: index + 1, keep: "" } : null;
}

/** Copies `text`, letting `edit` change it anywhere outside a JSON string. */
function outsideStrings(
  text: string,
  edit: (text: string, index: number) => { skip: number; keep: string } | null,
): string {
  let out = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      out += text.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    const edited = edit(text, index);
    if (edited === null) {
      out += text[index];
      index++;
    } else {
      out += edited.keep;
      index = edited.skip;
    }
  }
  return out;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
