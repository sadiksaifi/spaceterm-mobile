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

/** What an Invitation Link says about the Machine it pairs with. */
export type Invitation = { machineId: string; machineName: string; address: string };

/** What this device makes of an Invitation Link before it pairs. */
export type InvitationReading =
  | { kind: "invitation"; invitation: Invitation }
  /** The link is not an Invitation Link, or it was used or expired. */
  | { kind: "unusable" }
  /** The link is for a Machine this device has paired already. */
  | { kind: "already-paired"; invitation: Invitation };

/** How a pairing ends. A Machine that stops answering while it waits is `unreachable`. */
export type PairingOutcome =
  | { kind: "paired"; machine: MachineRef }
  /** The Machine declined, or the Comparison Code expired. */
  | { kind: "declined" }
  | { kind: "unreachable" };

/**
 * A pairing the Machine has started. The person compares `code` with the one the Machine shows and
 * approves it there. `cancel` ends the pairing; `outcome` then never settles.
 */
export type Pairing = {
  kind: "comparing";
  code: string;
  outcome: Promise<PairingOutcome>;
  cancel: () => void;
};

/** What a command that changes a Workspace comes to. `failed` covers a Machine that did not answer. */
export type CommandResult = { kind: "done" } | { kind: "failed" };

/**
 * What this device can ask of its Machines. Members are functions, not methods, so a screen can
 * pass one on without binding it. A recoverable failure is a result, never a rejection.
 */
export type MachineClient = {
  getSnapshot: () => MachinesSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Lists `path`, which can start with `~` for the home directory. */
  listDirectory: (machineId: string, path: string) => Promise<DirectoryListing>;
  createWorkspace: (
    machineId: string,
    directory: string,
    options?: { createDirectory?: boolean },
  ) => Promise<CreateWorkspaceResult>;
  /**
   * `workspace` is as the person saw it, from a snapshot. The Machine refuses a Rename when the
   * Workspace was renamed since, and a Kill when it gained or lost a Terminal Session since, so
   * nothing changes that the person did not see.
   */
  renameWorkspace: (
    machineId: string,
    workspace: Workspace,
    name: string,
  ) => Promise<CommandResult>;
  killWorkspace: (machineId: string, workspace: Workspace) => Promise<CommandResult>;
  /** Closes this device's connection to a Machine. Nothing on the Machine changes. */
  disconnect: (machineId: string) => void;
  /**
   * Tries to reach a Machine that is not connected. It is reconnecting until the try ends, then
   * connected or still not connected; the promise settles then.
   */
  connect: (machineId: string) => Promise<void>;
  /** Stops and starts SpaceTerm Core, which ends its Terminal Sessions and keeps its Workspaces. */
  restartCore: (machineId: string) => Promise<CommandResult>;
  /**
   * Removes the Machine from this device, connected or not. Connecting to it again needs a new
   * Invitation Link.
   */
  unpair: (machineId: string) => void;
  /** Reads an Invitation Link on this device, without asking the Machine. */
  readInvitation: (link: string) => InvitationReading;
  /**
   * Asks the Machine of an Invitation Link to pair with this device, at `networkAddress` when it is
   * given and at the link's address otherwise. Aborting `signal` ends the pairing at any point, as
   * `Pairing.cancel` does; nothing settles after.
   */
  pair: (
    link: string,
    networkAddress: string | null,
    options?: { signal?: AbortSignal },
  ) => Promise<Pairing | { kind: "unreachable" }>;
};
