import type {
  MachineRef,
  MachinesSnapshot,
  UnreachableState,
  Workspace,
} from "@/shared/machines/model";

/** What the Workspace screen shows. */
export type WorkspaceView =
  /** The Machine no longer lists the Workspace, or the Machine is unpaired: Home shows again. */
  | { kind: "gone" }
  | { kind: "tabs"; machine: MachineRef; workspace: Workspace }
  /** The Machine is not connected. Its state shows in place of the Tabs. */
  | { kind: "unreachable"; machine: MachineRef; workspace: Workspace; state: UnreachableState };

/**
 * The Workspace `workspaceId` of the Machine `machineId`. `kept` is the Workspace as the screen
 * showed it last, for a Machine that drops and keeps no list of its Workspaces.
 */
export function workspaceView(
  { machines }: MachinesSnapshot,
  machineId: string,
  workspaceId: string,
  kept: Workspace | null,
): WorkspaceView {
  const machine = machines.find((candidate) => candidate.id === machineId);
  if (machine === undefined) return { kind: "gone" };
  const ref = { id: machine.id, name: machine.name };
  const listed = machine.workspaces?.find((candidate) => candidate.id === workspaceId);
  if (machine.connection === "connected") {
    return listed === undefined
      ? { kind: "gone" }
      : { kind: "tabs", machine: ref, workspace: listed };
  }
  const workspace = listed ?? (machine.workspaces === null ? kept : null);
  return workspace === null || workspace === undefined
    ? { kind: "gone" }
    : { kind: "unreachable", machine: ref, workspace, state: machine.connection };
}
