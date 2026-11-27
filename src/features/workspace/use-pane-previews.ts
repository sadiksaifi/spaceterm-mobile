import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { MachineClient, PaneScreen } from "@/shared/machines/model";

/** How long a card's screen stands before it is read again. */
export const PREVIEW_EVERY = 2000;

export type Screens = Readonly<Record<string, PaneScreen>>;

/** Panes of one Machine to read the screens of. */
export type PreviewTarget = { machineId: string; panes: readonly string[] };

const NONE: Screens = {};

/**
 * The last screens of the Panes of `targets`, by Machine and then by Pane, read again every
 * `PREVIEW_EVERY` while `reading` and the app is in front. A Pane keeps its screen while it stays
 * in `targets`, also when a read leaves it out, as one that did not arrive in time.
 */
export function usePanePreviews(
  client: Pick<MachineClient, "panePreviews">,
  targets: readonly PreviewTarget[],
  reading: boolean,
): Readonly<Record<string, Screens>> {
  const [screens, setScreens] = useState<Readonly<Record<string, Screens>>>({});
  const [inFront, setInFront] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setInFront(state !== "background"),
    );
    return () => subscription.remove();
  }, []);

  const { panePreviews } = client;
  // The read under way. A new one waits for it, so switching Workspaces never stacks reads.
  const under = useRef<Promise<void>>(Promise.resolve());
  const wanted = JSON.stringify(byMachine(targets));
  useEffect(() => {
    const groups: [string, string[]][] = JSON.parse(wanted);
    if (!reading || !inFront || groups.length === 0) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (answers: readonly Screens[]) =>
      setScreens((last) =>
        Object.fromEntries(
          groups.map(([machineId, ids], at) => [
            machineId,
            Object.fromEntries(
              ids.flatMap((id) => {
                const screen = answers[at]![id] ?? last[machineId]?.[id];
                return screen === undefined ? [] : [[id, screen]];
              }),
            ),
          ]),
        ),
      );
    const read = () => {
      under.current = under.current.then(async () => {
        if (stopped) return;
        const answers = await Promise.all(
          groups.map(([machineId, ids]) => panePreviews(machineId, ids).catch(() => NONE)),
        );
        if (stopped) return;
        apply(answers);
        timer = setTimeout(read, PREVIEW_EVERY);
      });
    };
    read();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [panePreviews, wanted, reading, inFront]);

  return screens;
}

/** Each Machine of `targets` with its Panes, both in first-seen order, leaving out empty ones. */
function byMachine(targets: readonly PreviewTarget[]): [string, string[]][] {
  const groups = new Map<string, Set<string>>();
  for (const { machineId, panes } of targets) {
    if (panes.length === 0) continue;
    const group = groups.get(machineId) ?? new Set();
    panes.forEach((pane) => group.add(pane));
    groups.set(machineId, group);
  }
  return [...groups].map(([machineId, panes]) => [machineId, [...panes]]);
}
