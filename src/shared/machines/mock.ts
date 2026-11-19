import type {
  CommandResult,
  ConnectionState,
  CreateWorkspaceResult,
  DirectoryListing,
  MachineClient,
  MachinesSnapshot,
  Workspace,
} from "./model";

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
};

/**
 * A client that answers from memory, for building screens before any Machine can be reached.
 * Changes last until the app restarts. `latency` is how long each answer takes, in milliseconds.
 * With `refuse`, the Machine refuses the first attempt of each command and every other one after,
 * so the failure and its Try Again can both be seen.
 */
export function createMockClient(
  seed: readonly MockMachine[],
  { latency = 0, refuse = false }: { latency?: number; refuse?: boolean } = {},
): MachineClient {
  const machines = seed.map((machine) => ({
    ...machine,
    directories: withChildEntries(machine.directories),
    workspaces: machine.workspaces && [...machine.workspaces],
  }));
  type State = (typeof machines)[number];

  let snapshot = toSnapshot();
  const listeners = new Set<() => void>();
  let nextId = 1;

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

  const attempts = { create: 0, rename: 0, kill: 0, connect: 0, restart: 0 };
  /** Counts an attempt; true when the Machine refuses it. */
  const refuses = (command: keyof typeof attempts) => refuse && attempts[command]++ % 2 === 0;

  /** The paired Machine with `id`. A Machine that is not paired answers nothing. */
  const machine = (id: string): State | undefined =>
    machines.find((candidate) => candidate.id === id);
  const done = (apply: () => void) => answer<CommandResult>({ kind: "done" }, apply);
  const failed = () => answer<CommandResult>({ kind: "failed" });

  return {
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
      };
      return answer<CreateWorkspaceResult>({ kind: "created", workspace }, () => {
        if (children === undefined) makeDirectories(target, absolute);
        target.workspaces = [...(target.workspaces ?? []), workspace];
        changed();
      });
    },

    renameWorkspace: (machineId, workspaceId, name) => {
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

    killWorkspace: (machineId, workspaceId) => {
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

    disconnect: (machineId) => {
      const target = machine(machineId);
      if (target === undefined || target.connection === "not-connected") return;
      target.connection = "not-connected";
      changed();
    },

    connect: async (machineId) => {
      const target = machine(machineId);
      if (target === undefined || target.connection === "connected") return;
      if (target.connection === "reconnecting") return;
      target.connection = "reconnecting";
      changed();
      const reached = !refuses("connect");
      await answer(undefined, () => {
        // The Machine may have been unpaired while the try ran.
        if (!machines.includes(target)) return;
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
  };

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
