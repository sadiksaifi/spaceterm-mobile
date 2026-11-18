import type { Href } from "expo-router";

import type { MachinesSnapshot } from "@/shared/machines/model";

/**
 * Where New Workspace opens for these Machines. With one Machine there is nothing to choose, so
 * the flow opens on its directories.
 */
export function newWorkspaceHref(snapshot: MachinesSnapshot): Href {
  const [only, ...others] = snapshot.machines;
  return only !== undefined && others.length === 0
    ? { pathname: "/new-workspace/[machineId]", params: { machineId: only.id } }
    : "/new-workspace";
}
