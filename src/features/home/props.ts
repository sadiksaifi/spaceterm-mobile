import type { HomeSnapshot, WorkspaceRow } from "./model";

/**
 * What Home can lead to. A control whose handler is absent shows as unavailable,
 * because the screen it opens does not exist yet.
 */
export type HomeActions = {
  onOpenWorkspace?: (row: WorkspaceRow) => void;
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
