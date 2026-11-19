import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useMachines } from "@/shared/machines/client";

import MachinePageScreen from "./screen";
import { useMachinePage } from "./use-machine-page";

/** One paired Machine: its connection, and Disconnect, Connect, Restart SpaceTerm Core and Unpair. */
export default function MachinePageRoute() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { machines, starting } = useMachines();
  const router = useRouter();
  const machine = machines.find((candidate) => candidate.id === machineId);

  // The page leaves once: after Unpair, or when the Machine is not paired, for example on a link
  // to one this device does not know.
  const left = useRef(false);
  const leave = () => {
    if (left.current) return;
    left.current = true;
    router.back();
  };
  const page = useMachinePage(machineId, leave);
  const gone = !starting && machine === undefined;
  useEffect(() => {
    if (gone && !left.current) {
      left.current = true;
      router.back();
    }
  }, [gone, router]);
  if (machine === undefined) return null;

  const terminalSessions = (machine.workspaces ?? []).reduce(
    (sum, workspace) => sum + workspace.terminalSessions,
    0,
  );
  return <MachinePageScreen machine={machine} terminalSessions={terminalSessions} page={page} />;
}
