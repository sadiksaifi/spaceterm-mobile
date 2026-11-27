import type {
  LibspacetermModule,
  NativeJoinState,
  NativePairedMachine,
  NativeTab,
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
  PairingStart,
  Tab,
  Workspace,
} from "./model";
import { basename, display, expand, join, parent, resolve } from "./paths";

/** What the client asks of libspaceterm. */
export type NativeMachines = Pick<
  LibspacetermModule,
  | "allowLocalNetwork"
  | "readInvitation"
  | "join"
  | "joinState"
  | "retryJoin"
  | "cancelJoin"
  | "stopUnfinishedPairings"
  | "paired"
  | "connect"
  | "disconnect"
  | "unpair"
  | "renameWorkspace"
  | "killWorkspace"
  | "newTab"
  | "newPane"
  | "moveTab"
  | "close"
  | "panePreviews"
  | "worktreeContext"
  | "worktreeLocation"
  | "createWorktree"
  | "checkWorktreeRemoval"
  | "removeWorktree"
  | "directoryHome"
  | "listDirectory"
  | "createWorkspace"
> & {
  addListener: (event: "onChange", listener: () => void) => { remove: () => void };
};

/** How many times a pairing tries again when the Machine does not answer, and how long it waits. */
const PAIRING_RETRIES = 3;
const PAIRING_RETRY_WAIT = 2000;
/** How long a connected Machine has to send its Workspaces before it shows as not connected. */
const LIST_WAIT = 30_000;

/**
 * The client for the Machines this device has paired through libspaceterm. Pairing, Saved
 * Connections, connecting, the Workspace list with its Tabs and Worktrees, the commands on them,
 * and New Workspace are real. Restarting SpaceTerm Core fails until libspaceterm is wired for it.
 */
export function createNativeClient(
  native: NativeMachines,
  { retryWait = PAIRING_RETRY_WAIT }: { retryWait?: number } = {},
): MachineClient {
  const listeners = new Set<() => void>();
  const changeWatchers = new Set<() => void>();
  /** Machines whose last Connect ended without a connection. */
  const stillNotConnected = new Set<string>();
  /** Each connected Machine's wait for its first Workspace list, however it connected. */
  const listWaits = new Map<string, ReturnType<typeof setTimeout>>();
  /** Connected Machines whose list did not arrive in time; Try Again starts them over. */
  const unlisted = new Set<string>();
  /** Each Machine's last Workspace list, kept while it is not connected. */
  const kept = new Map<string, readonly Workspace[]>();
  /** Each Machine's home directory, once it has answered. */
  const homes = new Map<string, string>();
  async function homeOf(machineId: string): Promise<string | null> {
    const known = homes.get(machineId);
    if (known !== undefined) return known;
    const home = await native.directoryHome(machineId);
    if (home !== null) homes.set(machineId, home);
    return home;
  }
  let starting = true;
  let snapshot = read();
  let published = JSON.stringify(snapshot);

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
      forgetList(id);
      const listed = (workspaces ?? []).map(toWorkspace);
      kept.set(id, listed);
      return { id, name, connection: "connected", workspaces: listed };
    }
    const known = kept.get(id) ?? null;
    const waiting = connection === "connected";
    if (waiting) awaitList(id);
    else forgetList(id);
    // A link that never listed shows as not connected, so Try Again shows.
    if (waiting && unlisted.has(id))
      return { id, name, connection: "still-not-connected", workspaces: known };
    if (connection === "connected" || connection === "connecting")
      return { id, name, connection: "reconnecting", workspaces: known };
    const state = stillNotConnected.has(id) ? "still-not-connected" : "not-connected";
    return { id, name, connection: state, workspaces: known };
  }

  function awaitList(id: string) {
    if (listWaits.has(id) || unlisted.has(id)) return;
    const wait = setTimeout(() => {
      listWaits.delete(id);
      unlisted.add(id);
      refresh();
    }, LIST_WAIT);
    listWaits.set(id, wait);
  }

  function forgetList(id: string) {
    clearTimeout(listWaits.get(id));
    listWaits.delete(id);
    unlisted.delete(id);
  }

  function toWorkspace({
    branch,
    seen,
    tabs,
    fixedTabOrder,
    ...listed
  }: NativeWorkspace): Workspace {
    const workspace: Workspace = { ...listed, revision: seen, tabs: tabs.map(toTab) };
    if (fixedTabOrder) workspace.fixedTabOrder = true;
    return branch === null ? workspace : { ...workspace, branch };
  }

  function toTab({ seen, panes, ...tab }: NativeTab): Tab {
    return {
      ...tab,
      revision: seen,
      panes: panes.map(({ seen: paneSeen, ...pane }) => ({ ...pane, revision: paneSeen })),
    };
  }

  function refresh() {
    const next = read();
    const nextSignature = JSON.stringify(next);
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

  /** The Main Worktree of a listed Workspace's repository, `null` outside one. */
  function rootOf(machineId: string, workspaceId: string): string | null {
    const machine = native.paired().find(({ id }) => id === machineId);
    const workspace = machine?.workspaces?.find(({ id }) => id === workspaceId);
    return workspace?.repository?.root ?? null;
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
    listDirectory: async (machineId, path) => {
      const home = await homeOf(machineId);
      if (home === null) return { kind: "unavailable", path, parent: null };
      const absolute = expand(home, path);
      const up = parent(absolute);
      const shown = {
        path: display(home, absolute, true),
        parent: up === null ? null : display(home, up, true),
      };
      const names = await native.listDirectory(machineId, absolute);
      if (names === null) return { kind: "unavailable", ...shown };
      return {
        kind: "listed",
        ...shown,
        // A hidden directory still opens when the person types its path.
        directories: names
          .filter((name) => !name.startsWith("."))
          .sort((a, b) => a.localeCompare(b))
          .map((name) => ({ name, path: display(home, join(absolute, name), true) })),
      };
    },
    createWorkspace: async (
      machineId,
      directory,
      { createDirectory = false, again = false } = {},
    ) => {
      const home = await homeOf(machineId);
      if (home === null) return { kind: "failed" };
      const absolute = expand(home, directory);
      const created = await native.createWorkspace(
        machineId,
        absolute,
        basename(resolve(home, directory)),
        createDirectory,
        again,
      );
      switch (created.kind) {
        case "created":
          return { kind: "created", workspaceId: created.workspaceId };
        case "missing-directory":
          return { kind: "missing-directory", directory: display(home, absolute, false) };
        case "failed":
          return created;
      }
    },
    renameWorkspace: async (machineId, { id, revision }, name) => {
      if (revision === undefined) return { kind: "failed" };
      return done(await native.renameWorkspace(machineId, id, revision, name));
    },
    killWorkspace: async (machineId, { id, revision }) => {
      if (revision === undefined) return { kind: "failed" };
      return done(await native.killWorkspace(machineId, id, revision));
    },
    newTab: async (machineId, { id }, worktree, again) => {
      const root = worktree === null ? null : rootOf(machineId, id);
      if (worktree !== null && root === null) return { kind: "failed" };
      const tab = await native.newTab(machineId, id, root, worktree?.path ?? null, again);
      return tab === null ? { kind: "failed" } : { kind: "done", tab };
    },
    newPane: async (machineId, { id }, tab, source, again) =>
      done(await native.newPane(machineId, id, tab.id, source.id, again)),
    moveTab: async (machineId, { id }, tab, beside, side) =>
      done(await native.moveTab(machineId, id, tab.id, beside.id, side === "after")),
    closeTab: async (machineId, { id }, tab, asked) => {
      if (tab.revision === undefined) return { kind: "failed" };
      return done(await native.close(machineId, id, tab.id, null, tab.revision, asked));
    },
    closePane: async (machineId, { id }, tab, pane, asked) => {
      if (pane.revision === undefined) return { kind: "failed" };
      return done(await native.close(machineId, id, tab.id, pane.id, pane.revision, asked));
    },
    panePreviews: async (machineId, panes) => {
      const screens = await native.panePreviews(machineId, [...panes]).catch(() => []);
      return Object.fromEntries(screens.map(({ pane, rows }) => [pane, { rows }]));
    },
    worktreeContext: (machineId, repository) => native.worktreeContext(machineId, repository.root),
    worktreeLocation: ({ template, home, root }, branch) =>
      native.worktreeLocation(template, home, root, branch),
    createWorktree: (machineId, { id }, { root, home }, { branch, location }) => {
      const [kind, name, base] =
        branch.kind === "new"
          ? ([branch.baseIsRemote ? "new-from-remote" : "new", branch.name, branch.base] as const)
          : branch.kind === "existing"
            ? (["existing", branch.name, ""] as const)
            : (["remote", branch.name, branch.remote] as const);
      return native.createWorktree(machineId, id, root, home, location, kind, name, base);
    },
    checkWorktreeRemoval: async (machineId, { root }, worktree) => {
      const check = await native.checkWorktreeRemoval(machineId, root, worktree.path);
      if (check.kind !== "review") return check;
      const { boot, confirmation, changes, submodules, tabs, sessions } = check;
      return {
        kind: "review",
        review: {
          worktree,
          changes,
          submodules,
          tabs,
          sessions,
          confirmation: `${boot}/${confirmation}`,
        },
      };
    },
    removeWorktree: (machineId, { root }, { worktree, confirmation }) => {
      const [boot = "", check = ""] = confirmation.split("/");
      return native.removeWorktree(machineId, root, worktree.path, boot, check);
    },
    restartCore: async () => ({ kind: "failed" }),
    disconnect: (machineId) => {
      stillNotConnected.delete(machineId);
      void native.disconnect(machineId).then(refresh);
    },
    connect: async (machineId) => {
      stillNotConnected.delete(machineId);
      forgetList(machineId);
      refresh();
      // A Machine at a public address needs no local network access, so a refusal still tries.
      await native.allowLocalNetwork();
      // A Machine reached meanwhile, by a retry or another Connect, keeps its connection: a second
      // Connect would drop it and start over. A link that never listed is started over.
      const now = native.paired().find(({ id }) => id === machineId);
      const reached = now !== undefined && (answered(now) || now.connection === "connecting");
      if (!reached && !(await native.connect(machineId))) {
        stillNotConnected.add(machineId);
        refresh();
        return;
      }
      await new Promise<void>((settle) => {
        const giveUp = setTimeout(() => {
          stop();
          stillNotConnected.add(machineId);
          settle();
        }, LIST_WAIT);
        const stop = watch(() => {
          const machine = native.paired().find(({ id }) => id === machineId);
          if (machine?.connection === "connecting") return false;
          // Connected counts once the Workspaces arrive, as the snapshot shows it.
          if (machine?.connection === "connected" && machine.workspaces === null) return false;
          if (machine !== undefined && !answered(machine)) stillNotConnected.add(machineId);
          clearTimeout(giveUp);
          settle();
          return true;
        });
      });
      refresh();
    },
    unpair: (machineId) => {
      stillNotConnected.delete(machineId);
      forgetList(machineId);
      kept.delete(machineId);
      void native.unpair(machineId).then(refresh);
    },
    stopUnfinishedPairings: () => native.stopUnfinishedPairings(),
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

      return new Promise<PairingStart>((started) => {
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
            // libspaceterm looks for room before it reaches the Machine, so no code showed.
            case "full":
              stop();
              if (comparing) settleOutcome?.({ kind: "unreachable" });
              started({ kind: "full", unfinished: state.unfinished });
              refresh();
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
