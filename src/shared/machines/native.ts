import type {
  LibspacetermModule,
  NativeJoinState,
  NativePairedMachine,
  NativeWorkspace,
} from "@/modules/libspaceterm";

import type {
  CommandResult,
  Invitation,
  Machine,
  MachineClient,
  MachineRef,
  MachinesSnapshot,
  Pairing,
  PairingOutcome,
  Workspace,
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
  | "renameWorkspace"
  | "killWorkspace"
> & {
  addListener: (event: "onChange", listener: () => void) => { remove: () => void };
};

/** How many times a pairing tries again when the Machine does not answer, and how long it waits. */
const PAIRING_RETRIES = 3;
const PAIRING_RETRY_WAIT = 2000;

/**
 * The client for the Machines this device has paired through libspaceterm. Pairing, Saved
 * Connections, connecting, the Workspace list, Rename and Kill Workspace are real. Creating a
 * Workspace, listing directories, and restarting SpaceTerm Core fail until libspaceterm is wired
 * for them.
 */
export function createNativeClient(
  native: NativeMachines,
  { retryWait = PAIRING_RETRY_WAIT }: { retryWait?: number } = {},
): MachineClient {
  const listeners = new Set<() => void>();
  const changeWatchers = new Set<() => void>();
  /** Machines whose last Connect ended without a connection. */
  const stillNotConnected = new Set<string>();
  /** Each Machine's last Workspace list, kept while it is not connected. */
  const kept = new Map<string, readonly Workspace[]>();
  /** What each listed Workspace sends back with Rename and Kill, by the object Home was given. */
  const seen = new WeakMap<Workspace, string>();
  let starting = true;
  let snapshot = read();
  /** The snapshot with every `seen`, so a change to either lists the Workspaces anew. */
  let published = signature(snapshot);

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
      machines.some((machine) => machine.connection === "reconnecting") &&
      !machines.some((machine) => machine.connection === "connected");
    return { machines, starting };
  }

  /** A Machine counts as connected once it has sent its Workspaces, as Home needs them. */
  function toMachine({ id, name, connection, workspaces }: NativePairedMachine): Machine {
    if (answered({ connection, workspaces })) {
      stillNotConnected.delete(id);
      const listed = (workspaces ?? []).map(toWorkspace);
      kept.set(id, listed);
      return { id, name, connection: "connected", workspaces: listed };
    }
    const known = kept.get(id) ?? null;
    if (connection === "connected" || connection === "connecting")
      return { id, name, connection: "reconnecting", workspaces: known };
    const state = stillNotConnected.has(id) ? "still-not-connected" : "not-connected";
    return { id, name, connection: state, workspaces: known };
  }

  function toWorkspace({ branch, seen: sent, ...listed }: NativeWorkspace): Workspace {
    const workspace = branch === null ? listed : { ...listed, branch };
    seen.set(workspace, sent);
    return workspace;
  }

  function signature(of: MachinesSnapshot): string {
    const sent = of.machines.flatMap((machine) =>
      (machine.workspaces ?? []).map((workspace) => seen.get(workspace)),
    );
    return JSON.stringify([of, sent]);
  }

  function refresh() {
    const next = read();
    const nextSignature = signature(next);
    if (nextSignature === published) return;
    snapshot = next;
    published = nextSignature;
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
    renameWorkspace: async (machineId, workspace, name) => {
      const sent = seen.get(workspace);
      if (sent === undefined) return { kind: "failed" };
      return done(await native.renameWorkspace(machineId, workspace.id, sent, name));
    },
    killWorkspace: async (machineId, workspace) => {
      const sent = seen.get(workspace);
      if (sent === undefined) return { kind: "failed" };
      return done(await native.killWorkspace(machineId, workspace.id, sent));
    },
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
          // Connected counts once the Workspaces arrive, as the snapshot shows it.
          if (machine?.connection === "connected" && machine.workspaces === null) return false;
          if (machine !== undefined && !answered(machine)) stillNotConnected.add(machineId);
          settle();
          return true;
        });
      });
      refresh();
    },
    unpair: (machineId) => {
      stillNotConnected.delete(machineId);
      kept.delete(machineId);
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

/** Whether a Machine is connected and has sent its Workspaces. */
function answered({
  connection,
  workspaces,
}: Pick<NativePairedMachine, "connection" | "workspaces">): boolean {
  return connection === "connected" && workspaces !== null;
}

function done(changed: boolean): CommandResult {
  return changed ? { kind: "done" } : { kind: "failed" };
}

/** The six digits as the Machine shows them, in two groups of three. */
function spaced(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
