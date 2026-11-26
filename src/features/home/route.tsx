import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";

import { linkStepHref, pastedInvitationLink } from "@/features/add-machine/flow";
import { newWorkspaceHref } from "@/features/new-workspace/entry";
import { workspaceHref } from "@/features/workspace/entry";
import { useMachineClient, useMachines } from "@/shared/machines/client";
import { reachUnconnected } from "@/shared/machines/reach";

import HomeScreen from "./screen";

const DESKTOP_PROJECT_URL = "https://github.com/sadiksaifi/spaceterm";

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
      onOpenWorkspace={(machineId, workspaceId) =>
        router.navigate(workspaceHref(machineId, workspaceId))
      }
      // New Tab opens the Workspace, which opens the Tab once its Tabs show.
      onNewTab={(machineId, workspaceId) =>
        router.navigate(workspaceHref(machineId, workspaceId, true))
      }
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
      onTryAgain={() => void reachUnconnected(client, snapshot.machines)}
      onRefresh={() => reachUnconnected(client, snapshot.machines)}
      // The page opens inside the app. If it cannot open, the person stays on Home.
      onGetDesktop={() => void openBrowserAsync(DESKTOP_PROJECT_URL).catch(() => {})}
    />
  );
}
