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

export type BarLayout = {
  /** Every Workspace takes an equal share of the bar. */
  shared: boolean;
  widths: readonly number[];
  /** How far the Workspaces are moved left, to keep the selected one in view. */
  offset: number;
};

/**
 * How the bar lays out its Workspaces. They share the bar equally while every name, with
 * `padding` on each side, fits its share. Otherwise each is as wide as its name, and the bar
 * moves them to center the selected one as far as the ends allow. `names` are the names' widths,
 * `undefined` until measured; the bar shares equally until then.
 */
export function barLayout(
  names: readonly (number | undefined)[],
  width: number,
  selected: number,
  padding: number,
): BarLayout {
  const share = names.length === 0 ? 0 : width / names.length;
  const natural = names.map((name) => (name === undefined ? undefined : name + 2 * padding));
  if (natural.every((each) => each !== undefined && each <= share) || natural.includes(undefined)) {
    return { shared: true, widths: names.map(() => share), offset: 0 };
  }
  const widths = natural as number[];
  const total = widths.reduce((sum, each) => sum + each, 0);
  const start = widths.slice(0, Math.max(selected, 0)).reduce((sum, each) => sum + each, 0);
  const middle = start + (widths[selected] ?? 0) / 2;
  const offset = Math.min(Math.max(middle - width / 2, 0), Math.max(total - width, 0));
  return { shared: false, widths, offset };
}
