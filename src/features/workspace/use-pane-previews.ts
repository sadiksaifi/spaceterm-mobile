import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { MachineClient, PaneScreen } from "@/shared/machines/model";

/** How long a card's screen stands before it is read again. */
export const PREVIEW_EVERY = 2000;

export type Screens = Readonly<Record<string, PaneScreen>>;

const NONE: Screens = {};

/**
 * The last screens of `panes`, read again every `PREVIEW_EVERY` while `reading` and the app is in
 * front. A Pane keeps its screen while a read leaves it out, as one that did not arrive in time.
 */
export function usePanePreviews(
  client: Pick<MachineClient, "panePreviews">,
  machineId: string,
  panes: readonly string[],
  reading: boolean,
): Screens {
  const [screens, setScreens] = useState<Screens>(NONE);
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
  const wanted = panes.join(" ");
  useEffect(() => {
    if (!reading || !inFront || wanted === "") return;
    const ids = wanted.split(" ");
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (answer: Screens) =>
      setScreens((last) =>
        Object.fromEntries(
          ids.flatMap((id) => {
            const screen = answer[id] ?? last[id];
            return screen === undefined ? [] : [[id, screen]];
          }),
        ),
      );
    const read = () => {
      under.current = under.current.then(async () => {
        if (stopped) return;
        const answer = await panePreviews(machineId, ids).catch(() => NONE);
        if (stopped) return;
        apply(answer);
        timer = setTimeout(read, PREVIEW_EVERY);
      });
    };
    read();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [panePreviews, machineId, wanted, reading, inFront]);

  return screens;
}
