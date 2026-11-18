import type { MachinesSnapshot } from "@/shared/machines/model";

export type FirstStep = { step: "machine" } | { step: "directory"; machineId: string };

/** With one Machine there is nothing to choose, so the flow opens on its directories. */
export function firstStep(snapshot: MachinesSnapshot): FirstStep {
  const [only, ...others] = snapshot.machines;
  if (only !== undefined && others.length === 0) return { step: "directory", machineId: only.id };
  return { step: "machine" };
}
