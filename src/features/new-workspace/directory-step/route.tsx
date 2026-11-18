import { useLocalSearchParams, useNavigation, useRoute, useRouter } from "expo-router";
import { useEffect } from "react";

import { useMachines } from "@/shared/machines/client";

import { useDirectoryPicker } from "../use-directory-picker";
import DirectoryStepScreen from "./screen";

/** The directory of the new Workspace, on the Machine the route names. */
export default function DirectoryStepRoute() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { machines } = useMachines();
  const router = useRouter();
  // This step is the first of the flow when the Machine step was skipped. The stack's index can
  // still point at the Machine step while a pushed step first renders, so compare routes instead.
  const route = useRoute();
  const first = useNavigation().getState()?.routes[0]?.key === route.key;
  const picker = useDirectoryPicker(machineId, () =>
    // The Tabs of the new Workspace do not exist yet, so the flow returns to Home, which lists it.
    router.dismissTo("/"),
  );
  const machine = machines.find((candidate) => candidate.id === machineId);
  const unknown = machine === undefined;

  // A link can name a Machine this device does not know, or one unpaired since. The flow closes
  // back to Home, which a redirect would push a second time.
  useEffect(() => {
    if (unknown) router.dismissTo("/");
  }, [unknown, router]);
  if (machine === undefined) return null;

  return (
    <DirectoryStepScreen
      machineName={machine.name}
      picker={picker}
      leading={first ? "cancel" : "back"}
      onLeave={() => router.back()}
    />
  );
}
