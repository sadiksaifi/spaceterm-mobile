import { isSearchable, type HomeSnapshot, type HomeView } from "./model";

/**
 * What Home can lead to. A control whose handler is absent is unavailable,
 * because the screen it opens does not exist yet.
 */
export type HomeActions = {
  onOpenWorkspace?: (machineId: string, workspaceId: string) => void;
  onNewWorkspace?: () => void;
  onAddMachine?: () => void;
  onScanQrCode?: () => void;
  onPasteInvitationLink?: () => void;
  onOpenSettings?: () => void;
  onMachineSettings?: (machineId: string) => void;
  onTryAgain?: () => void;
  onGetDesktop: () => void;
};

export type HomeScreenProps = HomeActions & { snapshot: HomeSnapshot };

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
