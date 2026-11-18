import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";

import { newWorkspaceHref } from "@/features/new-workspace/entry";
import { useMachineClient, useMachines } from "@/shared/machines/client";

import HomeScreen from "./screen";

const DESKTOP_PROJECT_URL = "https://github.com/sadiksaifi/spaceterm";

/**
 * The screens these controls open do not exist yet: the Tabs of a Workspace, Add Machine,
 * Settings and Machine Settings. Each control works and stays on Home until its screen is built.
 */
const stayOnHome = () => {};

/** Home as a route: what this device knows about its Machines, and what Home can lead to. */
export default function HomeRoute() {
  const snapshot = useMachines();
  const client = useMachineClient();
  const router = useRouter();

  return (
    <HomeScreen
      snapshot={snapshot}
      // Navigate, not push: a second tap before the flow shows must not open it twice.
      onNewWorkspace={() => router.navigate(newWorkspaceHref(snapshot))}
      renameWorkspace={client.renameWorkspace}
      killWorkspace={client.killWorkspace}
      onOpenWorkspace={stayOnHome}
      onNewTab={stayOnHome}
      onAddMachine={stayOnHome}
      onScanQrCode={stayOnHome}
      onPasteInvitationLink={stayOnHome}
      onOpenSettings={stayOnHome}
      onMachineSettings={stayOnHome}
      onTryAgain={stayOnHome}
      // The page opens inside the app. If it cannot open, the person stays on Home.
      onGetDesktop={() => void openBrowserAsync(DESKTOP_PROJECT_URL).catch(() => {})}
    />
  );
}
