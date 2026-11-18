import type { Href } from "expo-router";

import type { MachinesSnapshot } from "@/shared/machines/model";

import { firstStep } from "./entry";

/** Where New Workspace opens for these Machines. */
export function newWorkspaceHref(snapshot: MachinesSnapshot): Href {
  const step = firstStep(snapshot);
  return step.step === "machine"
    ? "/new-workspace"
    : { pathname: "/new-workspace/[machineId]", params: { machineId: step.machineId } };
}
