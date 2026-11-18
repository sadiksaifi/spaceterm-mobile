import { SnackbarHost, type SnackbarHostRef } from "@expo/ui/jetpack-compose";
import { align, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useEffectEvent, useState } from "react";

export type Snackbar = {
  /** The ref of the one `SnackbarSlot` that shows now. */
  attach: (host: SnackbarHostRef | null) => void;
  /** Changes when the shown item goes away; a new host takes its snackbar with it. */
  generation: number;
};

/**
 * A host Compose has not drawn yet refuses to show. It is usually ready within a few frames; past
 * those, it is asked again less often until it is.
 */
const READY_FRAMES = 30;
const SLOW_RETRY_MS = 500;
/** Material's snackbar keeps this margin inside its host, on every side. */
const OWN_MARGIN = 12;
/** The snackbar's margin from the sides of the screen, as the design draws it. */
const SIDE_MARGIN = 16;

/**
 * The Material snackbar that reports a refused command, in the inverse colors Material gives it,
 * with one action and a close button. It shows while `shown` is not null and leaves when `shown`
 * changes, so it never offers an action for something out of date. As Compose does for a
 * snackbar with an action, it stays until the person taps one of its buttons.
 *
 * Its slot can move, for example into a full-screen search while that is open; the snackbar
 * moves with it and stays.
 */
export function useSnackbar<T extends object>(
  shown: T | null,
  content: (item: T) => { message: string; actionLabel: string },
  onAction: (item: T) => void,
  onDismiss: (item: T) => void,
): Snackbar {
  const [host, attach] = useState<SnackbarHostRef | null>(null);
  // Compose has no call to take a snackbar away; it ends one when its host leaves.
  const [last, setLast] = useState({ shown, generation: 0 });
  if (last.shown !== shown) {
    setLast({ shown, generation: last.shown === null ? last.generation : last.generation + 1 });
  }

  const describe = useEffectEvent((item: T) => content(item));
  const answer = useEffectEvent((item: T, result: "actionPerformed" | "dismissed") =>
    result === "actionPerformed" ? onAction(item) : onDismiss(item),
  );

  useEffect(() => {
    if (shown === null || host === null) return;
    const { message, actionLabel } = describe(shown);
    // A host that is replaced ends its snackbar as dismissed; only the person's answer counts.
    let current = true;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (attempt: number) =>
      host
        .showSnackbar({ message, actionLabel, withDismissAction: true, duration: "indefinite" })
        .then(
          (result) => current && answer(shown, result),
          () => {
            if (!current) return;
            const next = () => show(attempt + 1);
            if (attempt < READY_FRAMES) frame = requestAnimationFrame(next);
            else timer = setTimeout(next, SLOW_RETRY_MS);
          },
        );
    void show(0);
    return () => {
      current = false;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [shown, host]);

  return { attach, generation: last.generation };
}

/**
 * Where the snackbar shows: at the bottom of its Box, its own bottom `bottom` up from the Box's
 * bottom edge. It takes
 * what `useSnackbar` returns, spread. Only one slot of a snackbar renders at a time.
 */
export function SnackbarSlot({ attach, generation, bottom }: Snackbar & { bottom: number }) {
  return (
    <SnackbarHost
      key={generation}
      ref={attach}
      modifiers={[
        align("bottomCenter"),
        padding(SIDE_MARGIN - OWN_MARGIN, 0, SIDE_MARGIN - OWN_MARGIN, bottom - OWN_MARGIN),
      ]}
    />
  );
}
