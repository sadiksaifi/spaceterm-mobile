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
  /**
   * Opaque. Changes whenever what Rename or Kill acts on changes: the name, or the Panes and
   * Terminal Sessions Kill ends. Absent where the Machine client keeps none, as in the mock.
   */
  revision?: string;
  /** Every Tab of every Worktree, in the order the Machine keeps them. */
  tabs: readonly Tab[];
  /** The repository the Workspace is in, `null` outside one. */
  repository: Repository | null;
  /** The Machine keeps the Tabs in a fixed order, so no Tab moves. */
  fixedTabOrder?: boolean;
};

/** The side of the Pane it was placed beside that a Pane takes. */
export type PaneSide = "right" | "down" | "left" | "up";

export type Pane = {
  id: string;
  /** The title a program set, else the command running, else the shell. */
  name: string;
  /** The Pane this one was placed beside, `null` for the first. The split is drawn from these. */
  source: string | null;
  side: PaneSide;
  /** Closing the Pane would end work the Machine sees, so it asks first. */
  running: boolean;
  /** Another device controls the Pane, so closing it asks first. */
  controlledElsewhere: boolean;
  /** Opaque. Changes whenever what Close Pane ends changes. Absent in the mock. */
  revision?: string;
};

export type Tab = {
  id: string;
  /** Its first Pane's name. */
  name: string;
  /** The path of the Worktree the Tab belongs to, `null` outside a repository. */
  worktree: string | null;
  /** In the order the Machine keeps them. The first is the Tab's own. */
  panes: readonly Pane[];
  /** Opaque. Changes whenever what Close Tab ends changes. Absent in the mock. */
  revision?: string;
};

/** A Pane's last screen, top-left first, cropped to what the Machine sends. */
export type PaneScreen = {
  /** A row with no runs is blank. */
  rows: readonly (readonly ScreenRun[])[];
};

/** Consecutive cells drawn alike. Colors are `#rrggbb`; `null` is the Terminal Theme's own. */
export type ScreenRun = {
  text: string;
  foreground: string | null;
  background: string | null;
  /** Foreground and background trade places. */
  inverse: boolean;
  bold: boolean;
  faint: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
};

export type Worktree = {
  /** The Worktree's root, as the Machine's path. */
  path: string;
  /** The branch it has checked out, or the short commit of a detached `HEAD`. */
  name: string;
};

export type Repository = {
  /** The Main Worktree, as the Machine's path. */
  root: string;
  /** As Git lists them, the Main Worktree first. */
  worktrees: readonly Worktree[];
};

/** What New Worktree reads from the Machine to fill its form. */
export type WorktreeContext = {
  root: string;
  /** Newest first. */
  local: readonly string[];
  /** Remote branches the repository has fetched, such as `origin/topic`, newest first. */
  remote: readonly string[];
  /** Local branches a Worktree has checked out. */
  checkedOut: readonly string[];
  /** The branch Start From holds as the form opens, `null` with no local branch. */
  startFrom: string | null;
  /** The Machine's rule for where a Worktree goes, and its home directory. Opaque here. */
  template: string;
  home: string;
};

/** The branch a new Worktree checks out. */
export type NewWorktreeBranch =
  | { kind: "new"; name: string; base: string; baseIsRemote: boolean }
  | { kind: "existing"; name: string }
  /** A new local branch `name` that tracks the fetched remote branch `remote`. */
  | { kind: "remote"; remote: string; name: string };

export type WorktreeCreation =
  /** The Worktree exists, and `tab` is its one Tab. */
  | { kind: "created"; tab: string }
  | { kind: "invalid-name" }
  | { kind: "branch-exists" }
  /** The Machine cannot use the Location: it is not empty, or not a place it can create one. */
  | { kind: "not-empty" }
  | { kind: "failed" };

/** What New Tab comes to: the Tab it opened, or a failure. */
export type NewTabResult = { kind: "done"; tab: string } | { kind: "failed" };

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

/**
 * How a pairing starts: the Machine shows a code, cannot be reached, or this device has no room
 * for another pairing. `unfinished` of the pairings it holds are cancelled ones still waiting for
 * their Machine to answer.
 */
export type PairingStart = Pairing | { kind: "unreachable" } | { kind: "full"; unfinished: number };

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
  /**
   * Opens a Tab with a shell as the Workspace's last Tab, in `worktree` when it is given. `again`
   * is Try Again of a New Tab that failed: the Machine may have opened that Tab with its answer
   * lost, and then opens no second one.
   */
  newTab: (
    machineId: string,
    workspace: Workspace,
    worktree: Worktree | null,
    again: boolean,
  ) => Promise<NewTabResult>;
  /**
   * Adds a Pane with a shell to `tab`, as its last Pane, split from `source`, one of its Panes.
   * `again` is as for `newTab`, with the `source` of the New Pane that failed.
   */
  newPane: (
    machineId: string,
    workspace: Workspace,
    tab: Tab,
    source: Pane,
    again: boolean,
  ) => Promise<CommandResult>;
  /**
   * Moves `tab` just before or after `beside`, another Tab of its Worktree, in the order the
   * Machine keeps for every device.
   */
  moveTab: (
    machineId: string,
    workspace: Workspace,
    tab: Tab,
    beside: Tab,
    side: "before" | "after",
  ) => Promise<CommandResult>;
  /**
   * `tab` and `pane` are as the person saw them. The Machine refuses when what the close ends has
   * changed since, so no Terminal Session ends that the person was not shown. `asked` is whether
   * the person agreed to the close; without it, the Machine also refuses where it can tell that a
   * command started or another device took control since.
   */
  closeTab: (
    machineId: string,
    workspace: Workspace,
    tab: Tab,
    asked: boolean,
  ) => Promise<CommandResult>;
  closePane: (
    machineId: string,
    workspace: Workspace,
    tab: Tab,
    pane: Pane,
    asked: boolean,
  ) => Promise<CommandResult>;
  /**
   * The last screens of `panes`, by Pane, for their cards. A Pane that shows nothing has no rows.
   * A Pane whose screen did not arrive in time is left out, as is every Pane of a Machine that
   * sends no previews.
   */
  panePreviews: (
    machineId: string,
    panes: readonly string[],
  ) => Promise<Readonly<Record<string, PaneScreen>>>;
  /** The branches and rule New Worktree needs, or `null` when the Machine did not answer. */
  worktreeContext: (machineId: string, repository: Repository) => Promise<WorktreeContext | null>;
  /** Where the Machine's rule places a Worktree for `branch`, `null` when the rule gives none. */
  worktreeLocation: (context: WorktreeContext, branch: string) => string | null;
  /** Creates a Worktree at `location`, which can start with `~/`, and opens one Tab in it. */
  createWorktree: (
    machineId: string,
    workspace: Workspace,
    context: WorktreeContext,
    request: { branch: NewWorktreeBranch; location: string },
  ) => Promise<WorktreeCreation>;
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
  ) => Promise<PairingStart>;
  /**
   * Stops waiting for the Machines of cancelled pairings to answer, which frees the room they hold.
   * Resolves whether every one stopped. A Machine that approved this device may still list it, so
   * call it only once the person confirms.
   */
  stopUnfinishedPairings: () => Promise<boolean>;
};
