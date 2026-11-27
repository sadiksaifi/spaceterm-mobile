import type { RunColor, ScreenRun } from "@/shared/machines/model";
import type { TerminalColors } from "@/shared/preferences/model";

/** A snapshot's text, as the mockups draw it on both platforms. */
export const SNAPSHOT_TEXT = { size: 5.5, lineHeight: 7.5, vertical: 12, horizontal: 10 };

/**
 * How `run` is colored on the Terminal Theme's `colors`. A platform that draws no `backgrounds`
 * colors a filled run's text with its fill, so a highlight stays visible on the card.
 */
export function runColors(
  run: ScreenRun,
  colors: Pick<TerminalColors, "foreground" | "background" | "normal" | "bright">,
  backgrounds: boolean,
): { foreground: string; background: string | null } {
  const color = (of: RunColor | null) => (of === null ? null : resolve(of, colors));
  const foreground = color(run.foreground) ?? colors.foreground;
  const background = color(run.background);
  const [text, fill] = run.inverse
    ? [background ?? colors.background, foreground]
    : [foreground, background];
  const shown = backgrounds ? text : (fill ?? text);
  // Faint text is drawn at half strength.
  return { foreground: run.faint ? `${shown}80` : shown, background: backgrounds ? fill : null };
}

/** The levels of each channel in xterm's 6×6×6 color cube, palette entries 16 to 231. */
const CUBE = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

/**
 * `color` as `#rrggbb`. The palette's first 16 entries are the Terminal Theme's normal and bright
 * colors; the rest are xterm's color cube and grays, which no Terminal Theme sets.
 */
function resolve(color: RunColor, colors: Pick<TerminalColors, "normal" | "bright">): string {
  if (typeof color === "string") return color;
  if (color < 8) return colors.normal[color];
  if (color < 16) return colors.bright[color - 8];
  if (color < 232) {
    const cube = color - 16;
    return hex(CUBE[Math.floor(cube / 36)], CUBE[Math.floor(cube / 6) % 6], CUBE[cube % 6]);
  }
  const gray = 8 + 10 * (color - 232);
  return hex(gray, gray, gray);
}

function hex(...channels: number[]): string {
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
