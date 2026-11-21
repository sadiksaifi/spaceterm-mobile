import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";

import { linkStepHref, pastedInvitationLink } from "@/features/add-machine/flow";
import { newWorkspaceHref } from "@/features/new-workspace/entry";
import { useMachineClient, useMachines } from "@/shared/machines/client";

import HomeScreen from "./screen";

const DESKTOP_PROJECT_URL = "https://github.com/sadiksaifi/spaceterm";

/**
 * The screen these controls open does not exist yet: the Tabs of a Workspace. Each control works
 * and stays on Home until its screen is built.
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
      onNewWorkspace={() => {
        const href = newWorkspaceHref(snapshot);
        if (href !== null) router.navigate(href);
      }}
      renameWorkspace={client.renameWorkspace}
      killWorkspace={client.killWorkspace}
      onOpenWorkspace={stayOnHome}
      onNewTab={stayOnHome}
      onAddMachine={() => router.navigate("/add-machine")}
      onScanQrCode={() => router.navigate("/add-machine")}
      // The clipboard is read first, so the iOS paste prompt shows over Home.
      onPasteInvitationLink={() =>
        void pastedInvitationLink().then((link) => router.navigate(linkStepHref(link)))
      }
      onOpenSettings={() => router.navigate("/settings")}
      onMachineSettings={(machineId) =>
        router.navigate({ pathname: "/settings/machines/[machineId]", params: { machineId } })
      }
      // Try Again reaches every Machine that is not connected and not already being reached.
      onTryAgain={() => {
        for (const machine of snapshot.machines) {
          if (
            machine.connection === "not-connected" ||
            machine.connection === "still-not-connected"
          ) {
            void client.connect(machine.id);
          }
        }
      }}
      // The page opens inside the app. If it cannot open, the person stays on Home.
      onGetDesktop={() => void openBrowserAsync(DESKTOP_PROJECT_URL).catch(() => {})}
    />
  );
}
