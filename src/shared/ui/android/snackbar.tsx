import { SnackbarHost, type SnackbarHostRef } from "@expo/ui/jetpack-compose";
import { align, padding } from "@expo/ui/jetpack-compose/modifiers";
import { useRef, type RefObject } from "react";

/**
 * The Material snackbar that reports a refused command, in the inverse colors Material gives it,
 * with one action and a close button. As Compose does for a snackbar with an action, it stays
 * until the person taps one of them.
 */
export function useSnackbar() {
  const host = useRef<SnackbarHostRef>(null);
  const show = (message: string, actionLabel: string, onAction: () => void) => {
    void host.current
      ?.showSnackbar({ message, actionLabel, withDismissAction: true, duration: "indefinite" })
      .then((result) => result === "actionPerformed" && onAction());
  };
  return { host, show };
}

/** Where the snackbar shows: at the bottom of its Box, `bottom` up from the bottom edge. */
export function SnackbarSlot({
  host,
  bottom,
}: {
  host: RefObject<SnackbarHostRef | null>;
  bottom: number;
}) {
  return (
    <SnackbarHost ref={host} modifiers={[align("bottomCenter"), padding(16, 0, 16, bottom)]} />
  );
}
