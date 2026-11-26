import type { Machine, MachineClient } from "./model";

/**
 * How long a refresh waits. A Machine still being reached then keeps trying, and shows as
 * reconnecting, but the refresh has ended.
 */
const REFRESH_WAIT = 10_000;

/**
 * Tries to reach every Machine in `machines` that is not connected and not already being reached.
 * Settles once each try ends, or after `REFRESH_WAIT` at most. A connected Machine sends each
 * change as it happens, so it needs none.
 */
export async function reachUnconnected(
  client: Pick<MachineClient, "connect">,
  machines: readonly Machine[],
): Promise<void> {
  const tries = Promise.all(
    machines
      .filter(
        (machine) =>
          machine.connection === "not-connected" || machine.connection === "still-not-connected",
      )
      .map((machine) => client.connect(machine.id)),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<void>((settle) => {
    timer = setTimeout(settle, REFRESH_WAIT);
  });
  try {
    await Promise.race([tries, waited]);
  } finally {
    clearTimeout(timer);
  }
}
