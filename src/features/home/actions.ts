import type { CommandResult, MachinesSnapshot } from "@/shared/machines/model";

import { isSearchable, type HomeView, type WorkspaceRow } from "./model";

/**
 * What Home can lead to. A control whose handler is absent is unavailable,
 * because the screen it opens does not exist yet.
 */
export type HomeActions = {
  onOpenWorkspace?: (machineId: string, workspaceId: string) => void;
  onNewTab?: (machineId: string, workspaceId: string) => void;
  renameWorkspace?: (
    machineId: string,
    workspaceId: string,
    name: string,
  ) => Promise<CommandResult>;
  killWorkspace?: (machineId: string, workspaceId: string) => Promise<CommandResult>;
  onNewWorkspace?: () => void;
  onAddMachine?: () => void;
  onScanQrCode?: () => void;
  onPasteInvitationLink?: () => void;
  onOpenSettings?: () => void;
  onMachineSettings?: (machineId: string) => void;
  onTryAgain?: () => void;
  onGetDesktop: () => void;
};

export type HomeScreenProps = HomeActions & { snapshot: MachinesSnapshot };

/** A control that shows, with its handler, `undefined` while it is unavailable. */
export type Control = { onPress: (() => void) | undefined };

/** The controls around Home's content, the same on both platforms. */
export type HomeControls = {
  /** Search exists only where Workspaces can be listed. */
  searchable: boolean;
  /** New Workspace shows wherever search does, and works once a connected Machine can take it. */
  newWorkspace: Control | null;
  addMachine: Control;
  settings: Control;
};

export function homeControls(view: HomeView, actions: HomeActions): HomeControls {
  const searchable = isSearchable(view);
  return {
    searchable,
    newWorkspace: searchable
      ? { onPress: view.canCreateWorkspace ? actions.onNewWorkspace : undefined }
      : null,
    addMachine: { onPress: actions.onAddMachine },
    settings: { onPress: actions.onOpenSettings },
  };
}

/** The buttons of an unreachable Machine's state. */
export type UnreachableControls = {
  /** Try Again shows unless a reconnect is under way. */
  tryAgain: Control | null;
  /**
   * Machine Settings opens the one unreachable Machine's settings, or Settings when several
   * Machines are paired.
   */
  machineSettings: Control;
};

export function unreachableControls(
  view: Extract<HomeView, { kind: "unreachable" }>,
  actions: HomeActions,
): UnreachableControls {
  const { machine } = view;
  const { onMachineSettings } = actions;
  return {
    tryAgain: view.state === "reconnecting" ? null : { onPress: actions.onTryAgain },
    machineSettings: {
      onPress:
        machine === null
          ? actions.onOpenSettings
          : onMachineSettings && (() => onMachineSettings(machine.id)),
    },
  };
}

/** What a row's touch and hold menu and swipe start. Rename and Kill open their alerts. */
export type RowHandlers = {
  onNewTab?: (row: WorkspaceRow) => void;
  onRenameWorkspace?: (row: WorkspaceRow) => void;
  onKillWorkspace?: (row: WorkspaceRow) => void;
};

/** The commands on a row's touch and hold menu; Rename and Kill are also on its swipe. */
export type RowCommands = {
  /** A row swipes only while its Machine is connected and Kill Workspace is available. */
  swipes: boolean;
  newTab: Control;
  rename: Control;
  kill: Control;
};

/** Every command needs the Machine, so a row whose Machine is not connected offers none. */
export function rowCommands(row: WorkspaceRow, handlers: RowHandlers): RowCommands {
  const connected = row.connection === "connected";
  const control = (handler: ((row: WorkspaceRow) => void) | undefined): Control => ({
    onPress: connected && handler ? () => handler(row) : undefined,
  });
  return {
    swipes: connected && handlers.onKillWorkspace !== undefined,
    newTab: control(handlers.onNewTab),
    rename: control(handlers.onRenameWorkspace),
    kill: control(handlers.onKillWorkspace),
  };
}

export type RenameOutcome =
  | { kind: "unavailable" }
  /** Rename closes the alert and sends nothing. */
  | { kind: "unchanged" }
  | { kind: "rename"; name: string };

/** What Rename does with the field's text. A name is never empty or only spaces. */
export function renameOutcome(current: string, typed: string): RenameOutcome {
  const name = typed.trim();
  if (name === "") return { kind: "unavailable" };
  if (name === current) return { kind: "unchanged" };
  return { kind: "rename", name };
}
