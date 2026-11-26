import { createContext, use, useState, useSyncExternalStore, type ReactNode } from "react";

import { createMockClient, type MockPairing } from "./mock";
import type { MachineClient, MachinesSnapshot } from "./model";
import { createNativeClient } from "./native";
import { macbook, macMini, scenarios, type Scenario } from "./seed";

/** How long a mock answer takes, so loading states show. */
const MOCK_LATENCY = 600;
/** How long the mock Machine takes to approve or decline a pairing. */
const MOCK_APPROVAL_WAIT = 3000;

const mockPairing = __DEV__ ? pairingToFake(process.env.EXPO_PUBLIC_MOCK_PAIRING) : undefined;

/**
 * An Invitation Link a camera can stand in for, where a development build fakes pairing: a
 * simulator has no camera to read the QR code. `null` everywhere else.
 */
export const FAKE_SCAN = mockPairing === undefined ? null : "spaceterm://pair/mock-invitation";

/**
 * The client this build talks to. A release build pairs real Machines. A development build pairs
 * real Machines too, unless it fakes them: `EXPO_PUBLIC_MOCK_DATA` names a scenario from
 * `seed.ts` to start with its mock Machines paired, and `EXPO_PUBLIC_MOCK_PAIRING` fakes how Add
 * Machine goes. `EXPO_PUBLIC_MOCK_FAILURES=on` makes the mock Machines refuse every other command.
 */
function defaultClient(): MachineClient {
  const scenario = __DEV__ ? process.env.EXPO_PUBLIC_MOCK_DATA : undefined;
  const seed =
    scenario !== undefined && scenario in scenarios ? scenarios[scenario as Scenario] : undefined;
  if (seed === undefined && mockPairing === undefined) {
    // Required here, so a test that supplies its own client never loads the native module.
    const { default: native } =
      require("@/modules/libspaceterm") as typeof import("@/modules/libspaceterm");
    return createNativeClient(native);
  }
  return createMockClient(seed ?? [], {
    latency: MOCK_LATENCY,
    refuse: process.env.EXPO_PUBLIC_MOCK_FAILURES === "on",
    pairing: mockPairing,
  });
}

/**
 * The pairing a flag value fakes: Mac mini approves, declines, or never answers; no link can be
 * used; or every link is for MacBook Pro, which the `machines` scenario has paired already.
 */
function pairingToFake(flag: string | undefined): MockPairing | undefined {
  const mini = {
    machine: macMini,
    address: "mac-mini.local",
    code: "482 915",
    wait: MOCK_APPROVAL_WAIT,
  };
  switch (flag) {
    case "approve":
    case "decline":
    case "unreachable":
    case "unusable":
      return { ...mini, answer: flag };
    case "already-paired":
      return { ...mini, machine: macbook, address: "macbook-pro.local", answer: "approve" };
    default:
      return undefined;
  }
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
