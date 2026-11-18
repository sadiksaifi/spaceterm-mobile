import { useRouter } from "expo-router";

import { useMachines } from "@/shared/machines/client";

import MachineStepScreen from "./screen";

/** The first step when several Machines are paired: which Machine the Workspace runs on. */
export default function MachineStepRoute() {
  const { machines } = useMachines();
  const router = useRouter();
  return (
    <MachineStepScreen
      machines={machines}
      // Navigate, not push: a second tap before the step shows must not stack it twice.
      onPick={(machineId) =>
        router.navigate({ pathname: "/new-workspace/[machineId]", params: { machineId } })
      }
      // Cancel returns to the screen the flow was opened from.
      onCancel={() => router.back()}
    />
  );
}
