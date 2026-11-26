import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { workspaceRows, type WorkspaceRow } from "@/features/home/model";
import { useRowAlerts } from "@/features/home/row-alerts";
import { newWorkspaceHref } from "@/features/new-workspace/entry";
import { useMachineClient, useMachines } from "@/shared/machines/client";
import type { Workspace } from "@/shared/machines/model";

import { NEW_TAB } from "./entry";
import { workspaceView } from "./model";
import WorkspaceScreen from "./screen";
import { usePanePreviews } from "./use-pane-previews";
import { useTabCommands } from "./use-tab-commands";

type Params = { machineId: string; workspaceId: string; action?: string };

/**
 * A Workspace as a route: its Tabs, or its Machine's state while it is not connected. Changing
 * Workspace from the bar or the sheet changes this route's parameters, so the screen stays.
 */
export default function WorkspaceRoute() {
  const { machineId, workspaceId, action } = useLocalSearchParams<Params>();
  const snapshot = useMachines();
  const client = useMachineClient();
  const router = useRouter();
  const [kept, setKept] = useState<Workspace | null>(null);
  const view = workspaceView(snapshot, machineId, workspaceId, kept);
  const shown = view.kind === "gone" ? kept : view.workspace;
  // The Workspace as shown last, for a Machine that drops and keeps no list.
  if (view.kind !== "gone" && view.workspace !== kept) setKept(view.workspace);

  const rows = workspaceRows(snapshot);
  const alerts = useRowAlerts(
    {
      onGetDesktop: () => {},
      renameWorkspace: client.renameWorkspace,
      killWorkspace: client.killWorkspace,
      // New Tab in another Workspace's menu changes to it and opens the Tab there.
      onNewTab: (rowMachine, rowWorkspace) =>
        router.setParams({ machineId: rowMachine, workspaceId: rowWorkspace, action: NEW_TAB }),
    },
    snapshot,
  );

  const row: WorkspaceRow | null =
    shown === null
      ? null
      : (rows.find((each) => each.machineId === machineId && each.workspace.id === workspaceId) ?? {
          key: `${machineId}/${workspaceId}`,
          machineId,
          machineName: view.kind === "gone" ? "" : view.machine.name,
          workspace: shown,
          connection: view.kind === "unreachable" ? view.state : "connected",
        });
  const commands = useTabCommands({
    client,
    machineId,
    workspace: shown ?? EMPTY,
    onKill: () => row && alerts.handlers.onKillWorkspace?.(row),
  });

  // New Tab from Home or another Workspace's menu runs once the Tabs show.
  const tabsShow = view.kind === "tabs";
  const focused = useIsFocused();
  const screens = usePanePreviews(
    client,
    machineId,
    commands.grid.tabs.flatMap((tab) => tab.panes.map((pane) => pane.id)),
    tabsShow && focused,
  );
  const newTab = useEffectEvent(() => commands.newTab());
  useEffect(() => {
    if (action !== NEW_TAB || !tabsShow) return;
    newTab();
    router.setParams({ action: undefined });
  }, [action, tabsShow, router]);

  // Kill Workspace, or the Machine leaving, ends the screen: Home shows without the Workspace. A
  // screen under another one waits to be shown again.
  const gone = view.kind === "gone";
  useFocusEffect(
    useCallback(() => {
      if (gone) router.back();
    }, [gone, router]),
  );

  if (view.kind === "gone" || row === null) return null;

  const newWorkspace = newWorkspaceHref(snapshot);
  const { repository } = view.workspace;
  return (
    <WorkspaceScreen
      view={view}
      rows={rows}
      row={row}
      commands={commands}
      screens={screens}
      alerts={alerts}
      onBack={() => router.back()}
      onSwitch={(next) =>
        router.setParams({ machineId: next.machineId, workspaceId: next.workspace.id })
      }
      onNewWorkspace={newWorkspace === null ? undefined : () => router.navigate(newWorkspace)}
      onNewWorktree={
        repository === null || view.kind !== "tabs"
          ? undefined
          : () =>
              router.navigate({
                pathname: "/new-worktree/[machineId]/[workspaceId]",
                params: { machineId, workspaceId },
              })
      }
      onTryAgain={() => void client.connect(machineId)}
      onMachineSettings={() =>
        router.navigate({ pathname: "/settings/machines/[machineId]", params: { machineId } })
      }
    />
  );
}

/** Stands in while the Workspace is gone, until the screen leaves. */
const EMPTY: Workspace = {
  id: "",
  name: "",
  directory: "",
  terminalSessions: 0,
  tabs: [],
  repository: null,
};
