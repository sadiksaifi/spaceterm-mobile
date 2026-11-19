import { createContext, use, useState, useSyncExternalStore, type ReactNode } from "react";

import { createMockClient } from "./mock";
import type { MachineClient, MachinesSnapshot } from "./model";
import { scenarios, type Scenario } from "./seed";

/** How long a mock answer takes, so loading states show. */
const MOCK_LATENCY = 600;

/**
 * The client this build talks to. Until pairing exists, a development build can pair the mock
 * Machines of a scenario: set `EXPO_PUBLIC_MOCK_DATA` to a name from `seed.ts`, or `off` for
 * none. `EXPO_PUBLIC_MOCK_FAILURES=on` makes those Machines refuse every other command. A release
 * build always starts with no Machines (DESIGN.md, "Real data only").
 */
function defaultClient(): MachineClient {
  const scenario = process.env.EXPO_PUBLIC_MOCK_DATA;
  if (__DEV__ && scenario !== undefined && scenario in scenarios) {
    return createMockClient(scenarios[scenario as Scenario], {
      latency: MOCK_LATENCY,
      refuse: process.env.EXPO_PUBLIC_MOCK_FAILURES === "on",
    });
  }
  return createMockClient([]);
}

const MachineClientContext = createContext<MachineClient | null>(null);

/** Supplies the client to the screens inside. One client serves the app for as long as it runs. */
export function MachinesProvider({
  client,
  children,
}: {
  client?: MachineClient;
  children: ReactNode;
}) {
  const [value] = useState(() => client ?? defaultClient());
  return <MachineClientContext value={value}>{children}</MachineClientContext>;
}

export function useMachineClient(): MachineClient {
  const client = use(MachineClientContext);
  if (client === null) throw new Error("useMachineClient needs a MachinesProvider");
  return client;
}

/** What this device knows about its Machines, updated as it changes. */
export function useMachines(): MachinesSnapshot {
  const client = useMachineClient();
  return useSyncExternalStore(client.subscribe, client.getSnapshot);
}
