import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { workspaceRows, type WorkspaceRow } from "@/features/home/model";
import { useRowAlerts } from "@/features/home/row-alerts";
import { newWorkspaceHref } from "@/features/new-workspace/entry";
import { useMachineClient, useMachines } from "@/shared/machines/client";

import { workspaceHref } from "../entry";
import WorkspacesScreen from "./screen";

type Params = { machineId: string; workspaceId: string };

/**
 * The Workspaces sheet over a Workspace: Search, New Workspace, and the Workspaces Home lists,
 * with the one under the sheet checked. Picking one closes the sheet on its Tabs.
 */
export default function WorkspacesRoute() {
  const { machineId, workspaceId } = useLocalSearchParams<Params>();
  const snapshot = useMachines();
  const client = useMachineClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Back to the Workspace screen under the sheet, which changes to `row`'s Workspace.
  const open = (row: WorkspaceRow, newTab = false) =>
    router.dismissTo(workspaceHref(row.machineId, row.workspace.id, newTab));
  const alerts = useRowAlerts(
    {
      onGetDesktop: () => {},
      renameWorkspace: client.renameWorkspace,
      killWorkspace: client.killWorkspace,
      onNewTab: (rowMachine, rowWorkspace) => {
        const row = workspaceRows(snapshot).find(
          (each) => each.machineId === rowMachine && each.workspace.id === rowWorkspace,
        );
        if (row) open(row, true);
      },
    },
    snapshot,
  );

  const needle = query.trim().toLocaleLowerCase();
  const rows = workspaceRows(snapshot).filter(
    (row) => needle === "" || row.workspace.name.toLocaleLowerCase().includes(needle),
  );
  const newWorkspace = newWorkspaceHref(snapshot);

  return (
    <WorkspacesScreen
      rows={rows}
      selected={`${machineId}/${workspaceId}`}
      alerts={alerts}
      onSearch={setQuery}
      onPick={(row) => open(row)}
      onNewWorkspace={
        newWorkspace === null
          ? undefined
          : () => {
              router.back();
              router.navigate(newWorkspace);
            }
      }
      onClose={() => router.back()}
    />
  );
}
