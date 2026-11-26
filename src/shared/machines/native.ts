import type {
  LibspacetermModule,
  NativeJoinState,
  NativePairedMachine,
} from "@/modules/libspaceterm";

import type {
  Invitation,
  Machine,
  MachineClient,
  MachineRef,
  MachinesSnapshot,
  Pairing,
  PairingOutcome,
} from "./model";

/** What the client asks of libspaceterm. */
export type NativeMachines = Pick<
  LibspacetermModule,
  | "allowLocalNetwork"
  | "readInvitation"
  | "join"
  | "joinState"
  | "retryJoin"
  | "cancelJoin"
  | "paired"
  | "connect"
  | "disconnect"
  | "unpair"
> & {
  addListener: (event: "onChange", listener: () => void) => { remove: () => void };
};

/** How many times a pairing tries again when the Machine does not answer, and how long it waits. */
const PAIRING_RETRIES = 3;
const PAIRING_RETRY_WAIT = 2000;

/**
 * The client for the Machines this device has paired through libspaceterm. Pairing, Saved
 * Connections, and connecting are real. Workspaces are not read yet: a connected Machine lists
 * none, and every Workspace command fails.
 */
export function createNativeClient(
  native: NativeMachines,
  { retryWait = PAIRING_RETRY_WAIT }: { retryWait?: number } = {},
): MachineClient {
  const listeners = new Set<() => void>();
  const changeWatchers = new Set<() => void>();
  /** Machines whose last Connect ended without a connection. */
  const stillNotConnected = new Set<string>();
  let starting = true;
  let snapshot = read();

  native.addListener("onChange", () => {
    for (const watcher of changeWatchers) watcher();
    refresh();
  });
  // A change between the first read and the listener reaches no one otherwise.
  refresh();

  function read(): MachinesSnapshot {
    const paired = native.paired();
    const machines = paired.map(toMachine);
    starting &&=
      paired.some((machine) => machine.connection === "connecting") &&
      !paired.some((machine) => machine.connection === "connected");
    return { machines, starting };
  }

  function toMachine({ id, name, connection }: NativePairedMachine): Machine {
    if (connection === "connected") {
      stillNotConnected.delete(id);
      return { id, name, connection, workspaces: [] };
    }
    if (connection === "connecting")
      return { id, name, connection: "reconnecting", workspaces: null };
    const state = stillNotConnected.has(id) ? "still-not-connected" : "not-connected";
    return { id, name, connection: state, workspaces: null };
  }

  function refresh() {
    const next = read();
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  /** Calls `check` now and after each change until it returns `true`. */
  function watch(check: () => boolean): () => void {
    const watcher = () => {
      if (check()) changeWatchers.delete(watcher);
    };
    changeWatchers.add(watcher);
    watcher();
    return () => changeWatchers.delete(watcher);
  }

  function nameOf(machineId: string): string | undefined {
    return native.paired().find((machine) => machine.id === machineId)?.name;
  }

  const client: MachineClient = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listDirectory: async (_machineId, path) => ({ kind: "unavailable", path, parent: null }),
    createWorkspace: async () => ({ kind: "failed" }),
    renameWorkspace: async () => ({ kind: "failed" }),
    killWorkspace: async () => ({ kind: "failed" }),
    restartCore: async () => ({ kind: "failed" }),
    disconnect: (machineId) => {
      stillNotConnected.delete(machineId);
      void native.disconnect(machineId).then(refresh);
    },
    connect: async (machineId) => {
      stillNotConnected.delete(machineId);
      // A Machine at a public address needs no local network access, so a refusal still tries.
      await native.allowLocalNetwork();
      if (!(await native.connect(machineId))) {
        stillNotConnected.add(machineId);
        refresh();
        return;
      }
      await new Promise<void>((settle) => {
        watch(() => {
          const machine = native.paired().find(({ id }) => id === machineId);
          if (machine?.connection === "connecting") return false;
          if (machine !== undefined && machine.connection !== "connected") {
            stillNotConnected.add(machineId);
          }
          settle();
          return true;
        });
      });
      refresh();
    },
    unpair: (machineId) => {
      stillNotConnected.delete(machineId);
      void native.unpair(machineId).then(refresh);
    },
    readInvitation: (link) => {
      const reading = native.readInvitation(link);
      if (reading.kind === "unusable") return reading;
      const { kind, ...invitation } = reading;
      return { kind, invitation };
    },
    pair: async (link, networkAddress, { signal } = {}) => {
      const reading = native.readInvitation(link);
      const invited: Invitation | undefined = reading.kind === "unusable" ? undefined : reading;
      // A Machine at a public address needs no local network access, so a refusal still tries;
      // one on the local network then cannot answer, as when it is off.
      await native.allowLocalNetwork();
      if (signal?.aborted) return { kind: "unreachable" };
      const start = native.join(link, networkAddress);
      if (start.kind !== "joining") return { kind: "unreachable" };
      const { join } = start;

      return new Promise<Pairing | { kind: "unreachable" }>((started) => {
        let retries = 0;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let comparing = false;
        let settleOutcome: ((outcome: PairingOutcome) => void) | undefined;
        let stopWatching = () => {};
        const stop = () => {
          stopWatching();
          if (retry !== undefined) clearTimeout(retry);
          signal?.removeEventListener("abort", cancel);
        };
        /** Ends the join on this device and the Machine. Nothing settles after. */
        const cancel = () => {
          settleOutcome = undefined;
          stop();
          void native.cancelJoin(join);
        };
        const end = (outcome: PairingOutcome) => {
          stop();
          if (outcome.kind === "unreachable") void native.cancelJoin(join);
          if (comparing) settleOutcome?.(outcome);
          // Changes arrive coalesced, so an approval can be the first state read. The person saw
          // the code here or the Machine could not have approved, so it pairs all the same.
          else if (outcome.kind === "paired") {
            started({ kind: "comparing", code: "", outcome: Promise.resolve(outcome), cancel });
          }
          // Before the Machine shows a code, any other ending is one the person cannot act on.
          else started({ kind: "unreachable" });
          refresh();
        };
        const step = (state: NativeJoinState): boolean => {
          switch (state.kind) {
            case "reaching":
              return false;
            case "paused":
              if (retry !== undefined) return false;
              if (retries === PAIRING_RETRIES) {
                end({ kind: "unreachable" });
                return true;
              }
              retries += 1;
              retry = setTimeout(() => {
                retry = undefined;
                if (!native.retryJoin(join)) step(native.joinState(join));
              }, retryWait);
              return false;
            case "comparing": {
              if (comparing) return false;
              comparing = true;
              const pairing: Pairing = {
                kind: "comparing",
                code: spaced(state.code),
                outcome: new Promise((settle) => (settleOutcome = settle)),
                cancel,
              };
              started(pairing);
              return false;
            }
            case "paired": {
              const machine: MachineRef = {
                id: state.machineId,
                name: nameOf(state.machineId) ?? invited?.machineName ?? "",
              };
              end({ kind: "paired", machine });
              return true;
            }
            case "declined":
            case "unreachable":
              end(state);
              return true;
          }
        };
        signal?.addEventListener("abort", cancel);
        stopWatching = watch(() => step(native.joinState(join)));
      });
    },
  };
  return client;
}

/** The six digits as the Machine shows them, in two groups of three. */
function spaced(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
