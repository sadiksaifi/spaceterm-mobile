import type { ScreenRun } from "@/shared/machines/model";
import type { TerminalColors } from "@/shared/preferences/model";

/** A snapshot's text, as the mockups draw it on both platforms. */
export const SNAPSHOT_TEXT = { size: 5.5, lineHeight: 7.5, vertical: 12, horizontal: 10 };

/**
 * How `run` is colored on the Terminal Theme's `colors`. A platform that draws no `backgrounds`
 * keeps an inverse run's own foreground, so its text stays readable.
 */
export function runColors(
  run: ScreenRun,
  colors: Pick<TerminalColors, "foreground" | "background">,
  backgrounds: boolean,
): { foreground: string; background: string | null } {
  const foreground = run.foreground ?? colors.foreground;
  const [text, fill] =
    run.inverse && backgrounds
      ? [run.background ?? colors.background, foreground]
      : [foreground, backgrounds ? run.background : null];
  // Faint text is drawn at half strength.
  return { foreground: run.faint ? `${text}80` : text, background: fill };
}
