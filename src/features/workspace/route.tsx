import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { workspaceRows, type WorkspaceRow } from "@/features/home/model";
import { useRowAlerts } from "@/features/home/row-alerts";
import { newWorkspaceHref } from "@/features/new-workspace/entry";
import { useMachineClient, useMachines } from "@/shared/machines/client";
import type { Tab, Workspace } from "@/shared/machines/model";

import { newTabAction, takeNewTab } from "./entry";
import { gridView } from "./grid";
import { readGridState } from "./grid-store";
import { workspaceView } from "./model";
import type { WorkspacePage } from "./props";
import WorkspaceScreen from "./screen";
import { usePanePreviews, type Screens } from "./use-pane-previews";
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
        router.setParams({
          machineId: rowMachine,
          workspaceId: rowWorkspace,
          action: newTabAction(),
        }),
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
  // The pages beside the one on screen read their screens too, so a drag of the bar slides them
  // in whole, and the page on screen keeps its screens as it slides out.
  const at = row === null ? -1 : rows.findIndex((each) => each.key === row.key);
  const beside = (index: number) => at !== -1 && index !== at && Math.abs(index - at) <= 1;
  const drafts = rows.map((each, index) => {
    if (index === at) return { row: each, view, tabs: commands.grid.tabs };
    const page = workspaceView(snapshot, each.machineId, each.workspace.id, null);
    const tabs =
      page.kind === "tabs" ? gridView(page.workspace, readGridState(each.key)).tabs : NO_TABS;
    return { row: each, view: page, tabs };
  });
  const byMachine = usePanePreviews(
    client,
    [
      { machineId, panes: paneIds(commands.grid.tabs) },
      ...drafts.flatMap((draft, index) =>
        beside(index) ? [{ machineId: draft.row.machineId, panes: paneIds(draft.tabs) }] : [],
      ),
    ],
    tabsShow && focused,
  );
  const screens = byMachine[machineId] ?? NO_SCREENS;
  const pages: WorkspacePage[] = drafts.map((draft, index) => ({
    key: draft.row.key,
    view: draft.view,
    tabs: draft.tabs,
    screens: beside(index) ? (byMachine[draft.row.machineId] ?? NO_SCREENS) : NO_SCREENS,
  }));
  const newTab = useEffectEvent(() => commands.newTab());
  useEffect(() => {
    if (action === undefined || !tabsShow) return;
    if (takeNewTab(action)) newTab();
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
      pages={pages}
      screens={screens}
      alerts={alerts}
      onBack={() => router.back()}
      onSwitch={(next) =>
        // A New Tab still waiting for this Workspace's Tabs does not follow to the next one.
        router.setParams({
          machineId: next.machineId,
          workspaceId: next.workspace.id,
          action: undefined,
        })
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

function paneIds(tabs: readonly Tab[]): string[] {
  return tabs.flatMap((tab) => tab.panes.map((pane) => pane.id));
}

const NO_TABS: readonly Tab[] = [];
const NO_SCREENS: Screens = {};

/** Stands in while the Workspace is gone, until the screen leaves. */
const EMPTY: Workspace = {
  id: "",
  name: "",
  directory: "",
  terminalSessions: 0,
  tabs: [],
  repository: null,
};
