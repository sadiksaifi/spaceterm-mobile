import { NativeModule, requireNativeModule } from "expo";

/** The Machine an Invitation Link names. `machineId` stays the same for the same SpaceTerm Core. */
export type InvitedMachine = { machineId: string; machineName: string; address: string };

export type NativeInvitationReading =
  | ({ kind: "invitation" } & InvitedMachine)
  /** Not an Invitation Link, one for another edition of SpaceTerm, or an expired one. */
  | { kind: "unusable" }
  | ({ kind: "already-paired" } & InvitedMachine);

export type NativeJoinStart =
  | { kind: "joining"; join: string }
  | { kind: "unusable" }
  /** The network address is no DNS name or IP address with an optional port. */
  | { kind: "invalid-address" }
  | { kind: "unavailable" };

export type NativeJoinState =
  | { kind: "reaching" }
  /** The six digits the Machine shows too. */
  | { kind: "comparing"; code: string }
  /** The Machine did not answer. The join waits for `retryJoin` or `cancelJoin`. */
  | { kind: "paused" }
  | { kind: "paired"; machineId: string }
  /** The Machine declined, or the Comparison Code expired. */
  | { kind: "declined" }
  | { kind: "unreachable" }
  /**
   * This device has no room for another pairing. `unfinished` of those it holds are cancelled
   * pairings still waiting for their Machine to answer; `stopUnfinishedPairings` frees them.
   */
  | { kind: "full"; unfinished: number };

/** A Workspace as its Machine lists it. Paths start with `~` where they are in the home directory. */
export type NativeWorkspace = {
  id: string;
  name: string;
  directory: string;
  /** `null` when the directory is in no repository, or its `HEAD` is detached. */
  branch: string | null;
  /** The Terminal Sessions that Kill Workspace ends. */
  terminalSessions: number;
  /** The Workspace as listed, which Rename and Kill send back. Opaque. */
  seen: string;
  tabs: NativeTab[];
  /** `null` outside a repository. */
  repository: NativeRepository | null;
  /** The Machine keeps the Tabs in a fixed order: it is before work 1.6. */
  fixedTabOrder: boolean;
};

/** A Pane's last screen, top-left first. A row with no runs is blank. */
export type NativePaneScreen = { pane: string; rows: NativeScreenRun[][] };

/**
 * Consecutive cells drawn alike. A color is `#rrggbb` or a 256-color palette index; `null` is the
 * terminal's own.
 */
export type NativeScreenRun = {
  text: string;
  foreground: string | number | null;
  background: string | number | null;
  /** Foreground and background trade places. */
  inverse: boolean;
  bold: boolean;
  faint: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
};

export type NativeTab = {
  id: string;
  /** Its Root Pane's name. */
  name: string;
  /** The Worktree the Tab belongs to, as the Machine's path. `null` outside a repository. */
  worktree: string | null;
  panes: NativePane[];
  /** What Close Tab sends back. Opaque. */
  seen: string;
};

export type NativePane = {
  id: string;
  name: string;
  source: string | null;
  side: "right" | "down" | "left" | "up";
  /** Closing it would end work, as the Machine observes, else as the shell reports. */
  running: boolean;
  controlledElsewhere: boolean;
  /** What Close Pane sends back. Opaque. */
  seen: string;
};

export type NativeRepository = {
  root: string;
  worktrees: { path: string; name: string }[];
};

export type NativeWorktreeContext = {
  root: string;
  local: string[];
  remote: string[];
  checkedOut: string[];
  startFrom: string | null;
  template: string;
  home: string;
};

export type NativeWorktreeCreation =
  | { kind: "created"; tab: string }
  | { kind: "invalid-name" }
  | { kind: "branch-exists" }
  | { kind: "not-empty" }
  | { kind: "failed" };

export type NativeWorktreeRemovalFailure =
  | "main"
  | "locked"
  | "pinned"
  | "missing"
  | "changed"
  | "changed-after-closing"
  | "interrupted"
  | "failed";

/** What removing a Worktree deletes and closes. `boot` and `confirmation` go back with the remove. */
export type NativeWorktreeRemovalCheck =
  | {
      kind: "review";
      boot: string;
      confirmation: string;
      changes: boolean;
      submodules: boolean;
      tabs: number;
      sessions: number;
    }
  | { kind: "failed"; failure: NativeWorktreeRemovalFailure };

export type NativeWorktreeRemoval =
  | { kind: "removed" }
  | { kind: "failed"; failure: NativeWorktreeRemovalFailure };

export type NativePairedMachine = {
  id: string;
  name: string;
  address: string;
  connection: "connected" | "connecting" | "disconnected" | "unavailable";
  /** The Machine's Workspaces while it is connected and has sent them, `null` otherwise. */
  workspaces: NativeWorkspace[] | null;
};

type LibspacetermEvents = {
  /**
   * Something about the paired Machines, their Workspaces, or a join changed. Read them again to
   * see what.
   */
  onChange: () => void;
};

/**
 * libspaceterm on this device: Invitation Links, pairing, and the paired Machines. Its Saved
 * Connections and pairing secrets stay in native storage; JavaScript never sees a secret.
 */
export declare class LibspacetermModule extends NativeModule<LibspacetermEvents> {
  readInvitation(link: string): NativeInvitationReading;
  /** Starts pairing with the Machine of `link`, at `networkAddress` when it is not `null`. */
  join(link: string, networkAddress: string | null): NativeJoinStart;
  joinState(join: string): NativeJoinState;
  /**
   * Asks for access to Machines on the local network where the system wants the app to ask, and
   * resolves whether the app has it.
   */
  allowLocalNetwork(): Promise<boolean>;
  /** Tries a paused join again. `false` when the join is not paused or has expired. */
  retryJoin(join: string): boolean;
  /** Ends a join. A join the Machine approved meanwhile is unpaired again. */
  cancelJoin(join: string): Promise<void>;
  /**
   * Stops waiting for the Machines of cancelled pairings to answer, which frees their room.
   * Resolves whether every one stopped. A Machine that approved this device may still list it.
   */
  stopUnfinishedPairings(): Promise<boolean>;
  /** The paired Machines, in the order they were paired. */
  paired(): NativePairedMachine[];
  /** Each resolves `false` when no paired Machine has the id, or the change failed. */
  connect(machineId: string): Promise<boolean>;
  disconnect(machineId: string): Promise<boolean>;
  unpair(machineId: string): Promise<boolean>;
  /**
   * Each resolves `true` once the Machine has made the change, and `false` when it did not. `seen`
   * is from the listing the person saw: a Machine whose Workspace changed since refuses.
   */
  renameWorkspace(
    machineId: string,
    workspaceId: string,
    seen: string,
    name: string,
  ): Promise<boolean>;
  /** Ends the Workspace and every Terminal Session in it. */
  killWorkspace(machineId: string, workspaceId: string, seen: string): Promise<boolean>;
  /**
   * Opens a Tab as the Workspace's last, in the Worktree at `path` of the repository whose Main
   * Worktree is `root` when both are given. `again` is Try Again of a New Tab that failed, which
   * opens no second Tab if the first opened with its answer lost. Resolves the new Tab, or `null`.
   */
  newTab(
    machineId: string,
    workspaceId: string,
    root: string | null,
    path: string | null,
    again: boolean,
  ): Promise<string | null>;
  /** Adds a Pane beside `source`, one of the Tab's Panes. `again` is as for `newTab`. */
  newPane(
    machineId: string,
    workspaceId: string,
    tabId: string,
    source: string,
    again: boolean,
  ): Promise<boolean>;
  /** Moves the Tab just after `beside`, another Tab of its Worktree, or else just before it. */
  moveTab(
    machineId: string,
    workspaceId: string,
    tabId: string,
    beside: string,
    after: boolean,
  ): Promise<boolean>;
  /** Closes the Tab, or its Pane `paneId`, as listed with `seen`. `asked`: the person agreed. */
  close(
    machineId: string,
    workspaceId: string,
    tabId: string,
    paneId: string | null,
    seen: string,
    asked: boolean,
  ): Promise<boolean>;
  /**
   * The last screens of `panes`. A Pane that shows nothing has no rows. A Pane whose screen did
   * not arrive in time is left out.
   */
  panePreviews(machineId: string, panes: string[]): Promise<NativePaneScreen[]>;
  /** `null` when the Machine did not answer. */
  worktreeContext(machineId: string, root: string): Promise<NativeWorktreeContext | null>;
  /** Reads nothing from the Machine. */
  worktreeLocation(template: string, home: string, root: string, branch: string): string | null;
  /**
   * `kind` is `new` or `new-from-remote` with `base` the branch to start from, `existing`, or
   * `remote` with `base` the remote branch to track. `home` is the Machine's, from
   * `worktreeContext`, which places a Location that starts with `~/`.
   */
  createWorktree(
    machineId: string,
    workspaceId: string,
    root: string,
    home: string,
    location: string,
    kind: "new" | "new-from-remote" | "existing" | "remote",
    name: string,
    base: string,
  ): Promise<NativeWorktreeCreation>;
  /** Changes nothing. */
  checkWorktreeRemoval(
    machineId: string,
    root: string,
    path: string,
  ): Promise<NativeWorktreeRemovalCheck>;
  /** `boot` and `confirmation` are from the `checkWorktreeRemoval` the person confirmed. */
  removeWorktree(
    machineId: string,
    root: string,
    path: string,
    boot: string,
    confirmation: string,
  ): Promise<NativeWorktreeRemoval>;
}

export default requireNativeModule<LibspacetermModule>("Libspaceterm");
