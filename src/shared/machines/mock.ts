import type {
  CommandResult,
  ConnectionState,
  CreateWorkspaceResult,
  DirectoryListing,
  Invitation,
  InvitationReading,
  MachineClient,
  MachinesSnapshot,
  NewTabResult,
  Pairing,
  PairingOutcome,
  Tab,
  Workspace,
  WorktreeContext,
  WorktreeCreation,
} from "./model";
import { invitationLinkIn } from "./invitation";

/**
 * A Machine as the mock client knows it: its directories by absolute path, the branch of each
 * repository, and its Workspaces. A directory the Machine cannot list is `"unavailable"`. A
 * directory its parent names but that has no entry of its own is empty.
 */
export type MockMachine = {
  id: string;
  name: string;
  connection: ConnectionState;
  home: string;
  directories: Readonly<Record<string, readonly string[] | "unavailable">>;
  branches?: Readonly<Record<string, string>>;
  workspaces: readonly Workspace[] | null;
  /** The branches of each repository by its Main Worktree, newest first. */
  git?: Readonly<Record<string, { local: readonly string[]; remote: readonly string[] }>>;
  /** Where a new Worktree goes, with `{repository}` and `{branch}`. */
  worktreeTemplate?: string;
};

/**
 * The pairing the mock client fakes. Every Invitation Link is for `machine`, at `address`. The
 * Machine shows `code`, and `wait` milliseconds later it gives its `answer`; with `unreachable` it
 * never answers, and with `unusable` no link can be used. With `full`, this device has no room
 * until its two unfinished pairings stop; the Machine then approves.
 */
export type MockPairing = {
  machine: MockMachine;
  address: string;
  code: string;
  answer: "approve" | "decline" | "unreachable" | "unusable" | "full";
  wait: number;
};

/**
 * A client that answers from memory, for building screens before any Machine can be reached.
 * Changes last until the app restarts. `latency` is how long each answer takes, in milliseconds.
 * With `refuse`, the Machine refuses the first attempt of each command and every other one after,
 * so the failure and its Try Again can both be seen. Without `pairing`, no Invitation Link can be
 * used.
 */
export function createMockClient(
  seed: readonly MockMachine[],
  {
    latency = 0,
    refuse = false,
    pairing,
  }: { latency?: number; refuse?: boolean; pairing?: MockPairing } = {},
): MachineClient {
  const machines = seed.map((machine) => ({
    ...machine,
    directories: withChildEntries(machine.directories),
    workspaces: machine.workspaces && [...machine.workspaces],
    git: { ...machine.git },
    /** Counts Connect tries and Disconnects, so a late answer can tell it is no longer current. */
    connectTry: 0,
  }));
  type State = (typeof machines)[number];

  let snapshot = toSnapshot();
  const listeners = new Set<() => void>();
  let nextId = 1;
  /** The cancelled pairings whose Machine has not answered, as `full` fakes them. */
  let unfinished = pairing?.answer === "full" ? 2 : 0;

  function toSnapshot(): MachinesSnapshot {
    return {
      starting: false,
      machines: machines.map(({ id, name, connection, workspaces }) =>
        connection === "connected"
          ? { id, name, connection, workspaces: [...(workspaces ?? [])] }
          : { id, name, connection, workspaces: workspaces && [...workspaces] },
      ),
    };
  }

  function changed() {
    snapshot = toSnapshot();
    for (const listener of listeners) listener();
  }

  /** Answers `value` after the latency. `apply` makes the change the answer reports, just before. */
  const answer = <T>(value: T, apply?: () => void) =>
    new Promise<T>((resolve) =>
      setTimeout(() => {
        apply?.();
        resolve(value);
      }, latency),
    );

  const attempts = {
    create: 0,
    rename: 0,
    kill: 0,
    connect: 0,
    restart: 0,
    newTab: 0,
    newPane: 0,
    moveTab: 0,
    close: 0,
    branches: 0,
    worktree: 0,
  };
  /** Counts an attempt; true when the Machine refuses it. */
  const refuses = (command: keyof typeof attempts) => refuse && attempts[command]++ % 2 === 0;

  /** The paired Machine with `id`. A Machine that is not paired answers nothing. */
  const machine = (id: string): State | undefined =>
    machines.find((candidate) => candidate.id === id);
  const done = (apply: () => void) => answer<CommandResult>({ kind: "done" }, apply);

  /** A listed Workspace with its Machine, which must be connected to take a command. */
  const workspaceOf = (machineId: string, workspaceId: string) => {
    const target = machine(machineId);
    const workspace = target?.workspaces?.find((candidate) => candidate.id === workspaceId);
    if (target === undefined || workspace === undefined || target.connection !== "connected") {
      return undefined;
    }
    return { machine: target, workspace };
  };

  /**
   * Replaces a listed Workspace with `change`'s, counting one Terminal Session per Pane. A
   * Workspace left with no Tab ends, as on the Machine.
   */
  const update = (
    { machine: target, workspace }: { machine: State; workspace: Workspace },
    change: (workspace: Workspace) => Workspace,
  ) => {
    const current = target.workspaces?.find((candidate) => candidate.id === workspace.id);
    if (current === undefined) return;
    const next = change(current);
    const terminalSessions = next.tabs.reduce((sum, each) => sum + each.panes.length, 0);
    target.workspaces = (target.workspaces ?? []).flatMap((candidate) =>
      candidate.id !== workspace.id
        ? [candidate]
        : next.tabs.length === 0
          ? []
          : [{ ...next, terminalSessions }],
    );
    changed();
  };

  function shellPane(source: string | null) {
    return {
      id: `p-new-${nextId++}`,
      name: "zsh",
      source,
      side: "right" as const,
      running: false,
      controlledElsewhere: false,
    };
  }

  function shellTab(worktree: string | null): Tab {
    return { id: `t-new-${nextId++}`, name: "zsh", worktree, panes: [shellPane(null)] };
  }
  const failed = () => answer<CommandResult>({ kind: "failed" });

  const client: MachineClient = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    listDirectory: (machineId, path) => {
      const target = machine(machineId);
      if (target === undefined) {
        return answer<DirectoryListing>({ kind: "unavailable", path, parent: null });
      }
      const absolute = resolve(target.home, path);
      const parentPath = parent(absolute);
      const shown = {
        path: display(target.home, absolute, true),
        parent: parentPath === null ? null : display(target.home, parentPath, true),
      };
      const children = target.directories.get(absolute);
      if (children === undefined || children === "unavailable") {
        return answer<DirectoryListing>({ kind: "unavailable", ...shown });
      }
      return answer<DirectoryListing>({
        kind: "listed",
        ...shown,
        directories: children.map((name) => ({
          name,
          path: display(target.home, join(absolute, name), true),
        })),
      });
    },

    createWorkspace: (machineId, directory, { createDirectory = false } = {}) => {
      const target = machine(machineId);
      if (target === undefined || target.connection !== "connected") {
        return answer<CreateWorkspaceResult>({ kind: "failed" });
      }
      const absolute = resolve(target.home, directory);
      const children = target.directories.get(absolute);
      if (children === "unavailable") return answer<CreateWorkspaceResult>({ kind: "failed" });
      if (children === undefined && !createDirectory) {
        return answer<CreateWorkspaceResult>({
          kind: "missing-directory",
          directory: display(target.home, absolute, false),
        });
      }
      if (refuses("create")) return answer<CreateWorkspaceResult>({ kind: "failed" });
      const branch = target.branches?.[absolute];
      const workspace: Workspace = {
        id: `created-${nextId++}`,
        name: basename(absolute),
        directory: display(target.home, absolute, false),
        ...(branch === undefined ? {} : { branch }),
        // A new Workspace has one Tab, with a shell in its directory.
        terminalSessions: 1,
        tabs: [shellTab(null)],
        repository: null,
      };
      return answer<CreateWorkspaceResult>({ kind: "created", workspace }, () => {
        if (children === undefined) makeDirectories(target, absolute);
        target.workspaces = [...(target.workspaces ?? []), workspace];
        changed();
      });
    },

    renameWorkspace: (machineId, { id: workspaceId }, name) => {
      const target = machine(machineId);
      const workspaces = target?.workspaces;
      if (!target || !workspaces?.some((workspace) => workspace.id === workspaceId)) {
        return failed();
      }
      if (refuses("rename")) return failed();
      return done(() => {
        target.workspaces = (target.workspaces ?? []).map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, name } : workspace,
        );
        changed();
      });
    },

    killWorkspace: (machineId, { id: workspaceId }) => {
      const target = machine(machineId);
      const workspaces = target?.workspaces;
      if (!target || !workspaces?.some((workspace) => workspace.id === workspaceId)) {
        return failed();
      }
      if (refuses("kill")) return failed();
      return done(() => {
        target.workspaces = (target.workspaces ?? []).filter(
          (workspace) => workspace.id !== workspaceId,
        );
        changed();
      });
    },

    newTab: (machineId, { id: workspaceId }, worktree) => {
      const listed = workspaceOf(machineId, workspaceId);
      if (listed === undefined || refuses("newTab")) {
        return answer<NewTabResult>({ kind: "failed" });
      }
      const opened = shellTab(worktree?.path ?? listed.workspace.repository?.root ?? null);
      return answer<NewTabResult>({ kind: "done", tab: opened.id }, () =>
        update(listed, (workspace) => ({ ...workspace, tabs: [...workspace.tabs, opened] })),
      );
    },

    newPane: (machineId, { id: workspaceId }, { id: tabId }) => {
      const listed = workspaceOf(machineId, workspaceId);
      const target = listed?.workspace.tabs.find((candidate) => candidate.id === tabId);
      if (listed === undefined || target === undefined || refuses("newPane")) return failed();
      return done(() =>
        update(listed, (workspace) => ({
          ...workspace,
          tabs: workspace.tabs.map((each) =>
            each.id === tabId
              ? { ...each, panes: [...each.panes, shellPane(each.panes.at(-1)?.id ?? null)] }
              : each,
          ),
        })),
      );
    },

    moveTab: (machineId, { id: workspaceId }, { id: tabId }, { id: besideId }, side) => {
      const listed = workspaceOf(machineId, workspaceId);
      const tabs = listed?.workspace.tabs ?? [];
      const moving = tabs.find((each) => each.id === tabId);
      const beside = tabs.find((each) => each.id === besideId);
      if (
        !listed ||
        !moving ||
        !beside ||
        moving === beside ||
        moving.worktree !== beside.worktree ||
        refuses("moveTab")
      ) {
        return failed();
      }
      return done(() =>
        update(listed, (workspace) => {
          const moved = workspace.tabs.find((each) => each.id === tabId);
          const rest = workspace.tabs.filter((each) => each.id !== tabId);
          const at = rest.findIndex((each) => each.id === besideId);
          if (moved === undefined || at === -1) return workspace;
          const to = at + (side === "after" ? 1 : 0);
          return { ...workspace, tabs: [...rest.slice(0, to), moved, ...rest.slice(to)] };
        }),
      );
    },

    closeTab: (machineId, { id: workspaceId }, { id: tabId }) => {
      const listed = workspaceOf(machineId, workspaceId);
      if (!listed?.workspace.tabs.some((each) => each.id === tabId) || refuses("close")) {
        return failed();
      }
      return done(() =>
        update(listed, (workspace) => ({
          ...workspace,
          tabs: workspace.tabs.filter((each) => each.id !== tabId),
        })),
      );
    },

    closePane: (machineId, { id: workspaceId }, { id: tabId }, { id: paneId }) => {
      const listed = workspaceOf(machineId, workspaceId);
      const target = listed?.workspace.tabs.find((each) => each.id === tabId);
      if (!listed || !target?.panes.some((each) => each.id === paneId) || refuses("close")) {
        return failed();
      }
      return done(() =>
        update(listed, (workspace) => ({
          ...workspace,
          // Closing a Tab's last Pane closes the Tab.
          tabs: workspace.tabs.flatMap((each) => {
            if (each.id !== tabId) return [each];
            const panes = each.panes.filter((candidate) => candidate.id !== paneId);
            return panes.length === 0 ? [] : [{ ...each, name: panes[0].name, panes }];
          }),
        })),
      );
    },

    worktreeContext: (machineId, repository) => {
      const target = machine(machineId);
      const branches = target?.git[repository.root];
      if (target === undefined || branches === undefined || refuses("branches")) {
        return answer<WorktreeContext | null>(null);
      }
      const local = [...branches.local];
      return answer<WorktreeContext | null>({
        root: repository.root,
        local,
        remote: [...branches.remote],
        checkedOut: repository.worktrees.map((worktree) => worktree.name),
        startFrom: local.includes("main") ? "main" : (local[0] ?? null),
        template: target.worktreeTemplate ?? "~/.worktrees/{repository}/{branch}",
        home: target.home,
      });
    },

    worktreeLocation: ({ template, root }, branch) =>
      template
        .replaceAll("{repository}", basename(root))
        .replaceAll("{branch}", branch.replaceAll("/", "-")),

    createWorktree: (machineId, { id: workspaceId }, context, { branch, location }) => {
      const listed = workspaceOf(machineId, workspaceId);
      const branches = listed?.machine.git[context.root];
      if (listed === undefined || branches === undefined) {
        return answer<WorktreeCreation>({ kind: "failed" });
      }
      const { machine: target } = listed;
      const name = branch.name;
      // Git refuses names with spaces, `..`, or a trailing slash, among others.
      if (/\s|\.\.|\/$|^\/|^-/.test(name))
        return answer<WorktreeCreation>({ kind: "invalid-name" });
      if (branch.kind !== "existing" && branches.local.includes(name)) {
        return answer<WorktreeCreation>({ kind: "branch-exists" });
      }
      const path = resolve(target.home, location);
      const occupied = target.directories.get(path);
      if (Array.isArray(occupied) && occupied.length > 0) {
        return answer<WorktreeCreation>({ kind: "not-empty" });
      }
      if (refuses("worktree")) return answer<WorktreeCreation>({ kind: "failed" });
      const opened = shellTab(path);
      return answer<WorktreeCreation>({ kind: "created", tab: opened.id }, () => {
        target.git[context.root] = {
          ...branches,
          local: branches.local.includes(name) ? branches.local : [name, ...branches.local],
        };
        makeDirectories(target, path);
        update(listed, (workspace) => ({
          ...workspace,
          tabs: [...workspace.tabs, opened],
          repository: workspace.repository && {
            ...workspace.repository,
            worktrees: [...workspace.repository.worktrees, { path, name }],
          },
        }));
      });
    },

    disconnect: (machineId) => {
      const target = machine(machineId);
      if (target === undefined || target.connection === "not-connected") return;
      target.connectTry++;
      target.connection = "not-connected";
      changed();
    },

    connect: async (machineId) => {
      const target = machine(machineId);
      if (target === undefined || target.connection === "connected") return;
      if (target.connection === "reconnecting") return;
      // Numbered before subscribers hear of it, so a Disconnect from one of them ends this try.
      const connectTry = ++target.connectTry;
      target.connection = "reconnecting";
      changed();
      const reached = !refuses("connect");
      await answer(undefined, () => {
        // Disconnect, or Unpair, may have ended the try while it ran.
        if (!machines.includes(target) || target.connectTry !== connectTry) return;
        target.connection = reached ? "connected" : "still-not-connected";
        changed();
      });
    },

    restartCore: (machineId) => {
      const target = machine(machineId);
      if (target === undefined || target.connection !== "connected") return failed();
      if (refuses("restart")) return failed();
      return done(() => {
        target.workspaces = (target.workspaces ?? []).map((workspace) => ({
          ...workspace,
          terminalSessions: 0,
        }));
        changed();
      });
    },

    unpair: (machineId) => {
      const index = machines.findIndex((candidate) => candidate.id === machineId);
      if (index === -1) return;
      machines.splice(index, 1);
      changed();
    },

    readInvitation: (link) => {
      if (
        pairing === undefined ||
        pairing.answer === "unusable" ||
        invitationLinkIn(link) === null
      ) {
        return { kind: "unusable" };
      }
      const invitation: Invitation = {
        machineId: pairing.machine.id,
        machineName: pairing.machine.name,
        address: pairing.address,
      };
      return machine(invitation.machineId) === undefined
        ? { kind: "invitation", invitation }
        : { kind: "already-paired", invitation };
    },

    stopUnfinishedPairings: () => answer(true, () => (unfinished = 0)),
    pair: (link, _networkAddress, { signal } = {}) => {
      const reading: InvitationReading = client.readInvitation(link);
      if (
        pairing === undefined ||
        pairing.answer === "unreachable" ||
        reading.kind !== "invitation"
      ) {
        return answer({ kind: "unreachable" as const });
      }
      if (pairing.answer === "full" && unfinished > 0) {
        return answer({ kind: "full" as const, unfinished });
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = new Promise<PairingOutcome>((resolve) => {
        timer = setTimeout(() => {
          if (pairing.answer === "decline") return resolve({ kind: "declined" });
          const { id, name } = pairing.machine;
          if (machine(id) === undefined) {
            machines.push({
              ...pairing.machine,
              directories: withChildEntries(pairing.machine.directories),
              workspaces: pairing.machine.workspaces && [...pairing.machine.workspaces],
              git: { ...pairing.machine.git },
              connectTry: 0,
            });
            changed();
          }
          resolve({ kind: "paired", machine: { id, name } });
        }, pairing.wait);
      });
      const cancel = () => clearTimeout(timer);
      // Aborting ends the pairing even before the answer arrives with `cancel`.
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) cancel();
      return answer<Pairing>({ kind: "comparing", code: pairing.code, outcome, cancel });
    },
  };
  return client;

  /** Makes `absolute` and its missing ancestors, from the top down, so each parent lists them. */
  function makeDirectories(target: State, absolute: string) {
    const missing: string[] = [];
    for (let path: string | null = absolute; path !== null && !target.directories.has(path);) {
      missing.unshift(path);
      path = parent(path);
    }
    for (const path of missing) {
      target.directories.set(path, []);
      const up = parent(path);
      const siblings = up === null ? undefined : target.directories.get(up);
      if (up !== null && Array.isArray(siblings) && !siblings.includes(basename(path))) {
        target.directories.set(up, [...siblings, basename(path)].sort());
      }
    }
  }
}

/** The directories by path, with an empty entry for each one that only its parent names. */
function withChildEntries(directories: MockMachine["directories"]) {
  const all = new Map(Object.entries(directories));
  for (const [path, children] of Object.entries(directories)) {
    if (children === "unavailable") continue;
    for (const name of children) {
      const child = join(path, name);
      if (!all.has(child)) all.set(child, []);
    }
  }
  return all;
}

/** An absolute path without a trailing slash, `/` for the root. */
function resolve(home: string, path: string): string {
  const trimmed = path.trim();
  const expanded = trimmed === "~" || trimmed.startsWith("~/") ? home + trimmed.slice(1) : trimmed;
  const parts: string[] = [];
  for (const part of expanded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function parent(absolute: string): string | null {
  if (absolute === "/") return null;
  const cut = absolute.lastIndexOf("/");
  return cut === 0 ? "/" : absolute.slice(0, cut);
}

function join(absolute: string, name: string): string {
  return absolute === "/" ? `/${name}` : `${absolute}/${name}`;
}

function basename(absolute: string): string {
  return absolute === "/" ? "/" : absolute.slice(absolute.lastIndexOf("/") + 1);
}

/** The path as the Machine shows it: `~` for the home directory, a trailing slash for a listing. */
function display(home: string, absolute: string, trailingSlash: boolean): string {
  const shown =
    absolute === home
      ? "~"
      : absolute.startsWith(`${home}/`)
        ? `~${absolute.slice(home.length)}`
        : absolute;
  if (!trailingSlash || shown === "/") return shown;
  return `${shown}/`;
}
