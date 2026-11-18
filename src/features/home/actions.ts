import { isSearchable, type HomeSnapshot, type HomeView, type MachineRef } from "./model";

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

/**
 * The controls around Home's content, the same on both platforms. A handler is `undefined` while
 * its control is unavailable.
 */
export type HomeControls = {
  /** Search and New Workspace exist only where Workspaces can be listed. */
  searchable: boolean;
  /** New Workspace shows wherever search does, and works once a connected Machine can take it. */
  newWorkspace: (() => void) | undefined;
  addMachine: (() => void) | undefined;
  settings: (() => void) | undefined;
};

export function homeControls(view: HomeView, actions: HomeActions): HomeControls {
  const searchable = isSearchable(view);
  return {
    searchable,
    newWorkspace: searchable && view.canCreateWorkspace ? actions.onNewWorkspace : undefined,
    addMachine: actions.onAddMachine,
    settings: actions.onOpenSettings,
  };
}

/**
 * Machine Settings opens the one unreachable Machine's settings, or Settings when several
 * Machines are paired.
 */
export function machineSettingsAction(
  machine: MachineRef | null,
  actions: HomeActions,
): (() => void) | undefined {
  if (machine === null) return actions.onOpenSettings;
  const { onMachineSettings } = actions;
  return onMachineSettings && (() => onMachineSettings(machine.id));
}
