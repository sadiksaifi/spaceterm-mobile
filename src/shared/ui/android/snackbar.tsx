import { SnackbarHost, type SnackbarHostRef } from "@expo/ui/jetpack-compose";
import { align, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

export type Snackbar = {
  host: RefObject<SnackbarHostRef | null>;
  /** Changes when the shown item goes away; a new host takes its snackbar with it. */
  generation: number;
};

/**
 * The Material snackbar that reports a refused command, in the inverse colors Material gives it,
 * with one action and a close button. It shows while `shown` is not null and leaves when `shown`
 * changes, so it never offers an action for something out of date. As Compose does for a
 * snackbar with an action, it stays until the person taps one of its buttons.
 */
export function useSnackbar<T extends object>(
  shown: T | null,
  content: (item: T) => { message: string; actionLabel: string },
  onAction: (item: T) => void,
  onDismiss: (item: T) => void,
): Snackbar {
  const host = useRef<SnackbarHostRef>(null);
  // Compose has no call to take a snackbar away; it ends one when its host leaves.
  const [last, setLast] = useState({ shown, generation: 0 });
  if (last.shown !== shown) {
    setLast({ shown, generation: last.shown === null ? last.generation : last.generation + 1 });
  }

  const show = useEffectEvent((item: T) => {
    const { message, actionLabel } = content(item);
    void host.current
      ?.showSnackbar({ message, actionLabel, withDismissAction: true, duration: "indefinite" })
      .then((result) => (result === "actionPerformed" ? onAction(item) : onDismiss(item)));
  });
  useEffect(() => {
    if (shown !== null) show(shown);
  }, [shown]);

  return { host, generation: last.generation };
}

/**
 * Where the snackbar shows: at the bottom of its Box, `bottom` up from the bottom edge. It takes
 * what `useSnackbar` returns, spread.
 */
export function SnackbarSlot({ host, generation, bottom }: Snackbar & { bottom: number }) {
  return (
    <SnackbarHost
      key={generation}
      ref={host}
      modifiers={[align("bottomCenter"), padding(16, 0, 16, bottom)]}
    />
  );
}
