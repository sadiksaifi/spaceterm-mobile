import type {
  ConnectionState,
  MachineRef,
  MachinesSnapshot,
  UnreachableState,
  Workspace,
} from "@/shared/machines/model";

export type WorkspaceRow = {
  key: string;
  machineId: string;
  machineName: string;
  workspace: Workspace;
  /** `connected` rows show the directory; the others show the state and are dimmed. */
  connection: ConnectionState;
};

export type HomeView =
  | { kind: "loading" }
  | { kind: "no-machines" }
  | {
      kind: "unreachable";
      state: UnreachableState;
      /** The one Machine to name, or `null` when several Machines are paired. */
      machine: MachineRef | null;
    }
  | { kind: "no-workspaces"; canCreateWorkspace: true }
  | { kind: "workspaces"; rows: readonly WorkspaceRow[]; canCreateWorkspace: boolean }
  | { kind: "no-results"; query: string; canCreateWorkspace: boolean };

/** The views that offer search and New Workspace. */
export type SearchableHomeView = Extract<HomeView, { canCreateWorkspace: boolean }>;

/** The order in which a screen with nothing to list picks the state it shows. */
const UNREACHABLE_PRIORITY: readonly UnreachableState[] = [
  "reconnecting",
  "still-not-connected",
  "not-connected",
];

/** Every Workspace this device knows, Machine by Machine in the order they were paired. */
export function workspaceRows({ machines }: MachinesSnapshot): readonly WorkspaceRow[] {
  return machines.flatMap((machine) =>
    (machine.workspaces ?? []).map((workspace): WorkspaceRow => ({
      key: `${machine.id}/${workspace.id}`,
      machineId: machine.id,
      machineName: machine.name,
      workspace,
      connection: machine.connection,
    })),
  );
}

export function homeView(snapshot: MachinesSnapshot, query = ""): HomeView {
  const { machines } = snapshot;
  if (machines.length === 0) return { kind: "no-machines" };

  const anyConnected = machines.some((machine) => machine.connection === "connected");
  const rows = workspaceRows(snapshot);

  if (rows.length === 0 && !anyConnected) {
    if (snapshot.starting) return { kind: "loading" };
    const state =
      UNREACHABLE_PRIORITY.find((candidate) =>
        machines.some((machine) => machine.connection === candidate),
      ) ?? "not-connected";
    const machine = machines.length === 1 ? { id: machines[0].id, name: machines[0].name } : null;
    return { kind: "unreachable", state, machine };
  }

  const needle = query.trim().toLocaleLowerCase();
  if (needle !== "") {
    const matches = rows.filter((row) => row.workspace.name.toLocaleLowerCase().includes(needle));
    if (matches.length === 0) {
      return { kind: "no-results", query: query.trim(), canCreateWorkspace: anyConnected };
    }
    return { kind: "workspaces", rows: matches, canCreateWorkspace: anyConnected };
  }

  if (rows.length === 0) return { kind: "no-workspaces", canCreateWorkspace: true };
  return { kind: "workspaces", rows, canCreateWorkspace: anyConnected };
}

export function isSearchable(view: HomeView): view is SearchableHomeView {
  return view.kind === "workspaces" || view.kind === "no-workspaces" || view.kind === "no-results";
}
