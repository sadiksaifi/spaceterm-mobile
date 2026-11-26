import type { Machine, MachineClient } from "./model";

/**
 * Tries to reach every Machine in `machines` that is not connected and not already being reached.
 * Settles once each try ends. A connected Machine sends each change as it happens, so it needs none.
 */
export async function reachUnconnected(
  client: Pick<MachineClient, "connect">,
  machines: readonly Machine[],
): Promise<void> {
  await Promise.all(
    machines
      .filter(
        (machine) =>
          machine.connection === "not-connected" || machine.connection === "still-not-connected",
      )
      .map((machine) => client.connect(machine.id)),
  );
}
