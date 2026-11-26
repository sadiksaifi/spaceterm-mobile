import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useMachineClient, useMachines } from "@/shared/machines/client";
import { reachUnconnected } from "@/shared/machines/reach";

import { newWorkspaceHref } from "../entry";
import MachineStepScreen from "./screen";

/** The first step when several Machines are paired: which Machine the Workspace runs on. */
export default function MachineStepRoute() {
  const snapshot = useMachines();
  const { machines } = snapshot;
  const client = useMachineClient();
  const router = useRouter();
  // A link can open the flow here whatever is paired. Once the Machines are known, the flow goes
  // where Home would open it: to the one Machine's directories, or back to Home while none is
  // connected. Changes after that leave the step alone.
  const entry = snapshot.starting ? undefined : newWorkspaceHref(snapshot);
  const entered = useRef(false);
  useEffect(() => {
    if (entry === undefined || entered.current) return;
    entered.current = true;
    if (entry === null) router.dismissTo("/");
    else if (entry !== "/new-workspace") router.replace(entry);
  }, [entry, router]);

  return (
    <MachineStepScreen
      machines={machines}
      // Navigate, not push: a second tap before the step shows must not stack it twice.
      onPick={(machineId) =>
        router.navigate({ pathname: "/new-workspace/[machineId]", params: { machineId } })
      }
      // Cancel returns to the screen the flow was opened from.
      onCancel={() => router.back()}
      onRefresh={() => reachUnconnected(client, machines)}
    />
  );
}
