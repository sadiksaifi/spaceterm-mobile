import { builtInThemes } from "@/shared/preferences/built-in-themes";
import type { AnsiColors, TerminalTheme, ThemeAppearance } from "@/shared/preferences/model";

/** Where a Zed theme file came from: an extension in Zed's store, or a file the person picked. */
export type ZedThemeOrigin =
  | { kind: "extension"; id: string; name: string }
  | { kind: "file"; fileName: string };

const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/**
 * The Terminal Themes in a Zed theme file: its terminal colors, with the editor's colors and then
 * SpaceTerm's own palette standing in for any it leaves out. A file that is not a Zed theme
 * holds none.
 */
export function readZedThemes(file: string, origin: ZedThemeOrigin): TerminalTheme[] {
  const family = parseLenient(file);
  if (!isRecord(family) || !Array.isArray(family.themes)) return [];
  const familyName =
    typeof family.name === "string" && family.name.trim() !== ""
      ? family.name.trim()
      : origin.kind === "file"
        ? origin.fileName.replace(/\.json$/i, "")
        : origin.name;
  const source =
    origin.kind === "extension"
      ? ({ kind: "extension", id: origin.id, name: origin.name } as const)
      : ({ kind: "file", name: familyName } as const);
  const idPrefix = origin.kind === "extension" ? origin.id : `file/${familyName}`;

  return family.themes.flatMap((theme): TerminalTheme[] => {
    if (!isRecord(theme) || typeof theme.name !== "string" || theme.name.trim() === "") return [];
    if (theme.appearance !== "light" && theme.appearance !== "dark") return [];
    const name = theme.name.trim();
    return [
      {
        id: `${idPrefix}/${name}`,
        name,
        appearance: theme.appearance,
        source,
        colors: terminalColors(isRecord(theme.style) ? theme.style : {}, theme.appearance),
      },
    ];
  });
}

function terminalColors(style: Record<string, unknown>, appearance: ThemeAppearance) {
  const fallback = builtInThemes[appearance].colors;
  const first = (...keys: string[]) => {
    for (const key of keys) {
      const color = toHex(style[key]);
      if (color !== null) return color;
    }
    return null;
  };
  const foreground =
    first("terminal.foreground", "text", "editor.foreground") ?? fallback.foreground;
  const players = Array.isArray(style.players) ? style.players : [];
  const player = isRecord(players[0]) ? players[0] : {};
  const ansi = (prefix: string, colors: AnsiColors) =>
    ANSI.map(
      (name, index) => first(`terminal.ansi.${prefix}${name}`) ?? colors[index],
    ) as unknown as AnsiColors;
  return {
    background:
      first("terminal.background", "editor.background", "background") ?? fallback.background,
    foreground,
    cursor: toHex(player.cursor) ?? foreground,
    normal: ansi("", fallback.normal),
    bright: ansi("bright_", fallback.bright),
  };
}

/** A CSS hex color as `#rrggbb`: short forms grow, alpha is dropped. Anything else is null. */
function toHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (match === null) return null;
  const digits = match[1].toLowerCase();
  if (digits.length <= 4) {
    return `#${Array.from(digits.slice(0, 3), (digit) => digit + digit).join("")}`;
  }
  return `#${digits.slice(0, 6)}`;
}

/** JSON as Zed reads it: comments and trailing commas allowed. Text that is not JSON is null. */
function parseLenient(text: string): unknown {
  try {
    return JSON.parse(withoutCommentsAndTrailingCommas(text));
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
  return text[index] === "," && /^\s*[}\]]/.test(text.slice(index + 1))
    ? { skip: index + 1, keep: "" }
    : null;
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
