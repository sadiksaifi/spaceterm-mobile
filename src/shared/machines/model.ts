export type ConnectionState =
  | "connected"
  | "reconnecting"
  | "still-not-connected"
  | "not-connected";

export type UnreachableState = Exclude<ConnectionState, "connected">;

export type Workspace = {
  id: string;
  name: string;
  directory: string;
  /** Absent when the directory is in no repository. */
  branch?: string;
  /** The Terminal Sessions that Kill Workspace ends, across every Worktree. */
  terminalSessions: number;
};

/** What a view needs to name a Machine and open its settings. */
export type MachineRef = { id: string; name: string };

/**
 * A paired Machine as this device sees it. A connected Machine has answered, so its list is
 * known. Any other Machine has the list kept from an earlier run, or `null` when none was kept.
 */
export type Machine = MachineRef &
  (
    | { connection: "connected"; workspaces: readonly Workspace[] }
    | {
        connection: UnreachableState;
        workspaces: readonly Workspace[] | null;
      }
  );

export type MachinesSnapshot = {
  /** Paired Machines, in the order they were paired. */
  machines: readonly Machine[];
  /** True from app start until a Machine answers or every Machine's first tries fail. */
  starting: boolean;
};

export type DirectoryEntry = { name: string; path: string };

/**
 * One directory of a Machine, as the Machine lists it. Paths are as the Machine shows them, with
 * `~` for the home directory and a trailing slash. `parent` is `null` at the root.
 */
export type DirectoryListing =
  | {
      kind: "listed";
      path: string;
      parent: string | null;
      directories: readonly DirectoryEntry[];
    }
  /** The Machine cannot list the directory, for example without permission. */
  | { kind: "unavailable"; path: string; parent: string | null };

export type CreateWorkspaceResult =
  | { kind: "created"; workspace: Workspace }
  /** The directory does not exist. Asking again with `createDirectory` creates it first. */
  | { kind: "missing-directory"; directory: string }
  | { kind: "failed" };

/** What a command that changes a Workspace comes to. `failed` covers a Machine that did not answer. */
export type CommandResult = { kind: "done" } | { kind: "failed" };

/**
 * What this device can ask of its Machines. Members are functions, not methods, so a screen can
 * pass one on without binding it. A recoverable failure is a result, never a rejection.
 */
export type MachineClient = {
  getSnapshot: () => MachinesSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Lists `path`, or the home directory when `path` is absent. */
  listDirectory: (machineId: string, path?: string) => Promise<DirectoryListing>;
  createWorkspace: (
    machineId: string,
    directory: string,
    options?: { createDirectory?: boolean },
  ) => Promise<CreateWorkspaceResult>;
  renameWorkspace: (machineId: string, workspaceId: string, name: string) => Promise<CommandResult>;
  killWorkspace: (machineId: string, workspaceId: string) => Promise<CommandResult>;
};
