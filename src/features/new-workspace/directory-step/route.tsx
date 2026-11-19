import { useLocalSearchParams, useNavigation, useRoute, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useMachines } from "@/shared/machines/client";

import { useDirectoryPicker } from "../use-directory-picker";
import DirectoryStepScreen from "./screen";

/** The directory of the new Workspace, on the Machine the route names. */
export default function DirectoryStepRoute() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { machines, starting } = useMachines();
  const router = useRouter();
  // This step is the first of the flow when the Machine step was skipped. The stack's index can
  // still point at the Machine step while a pushed step first renders, so compare routes instead.
  const route = useRoute();
  const navigation = useNavigation();
  const first = navigation.getState()?.routes[0]?.key === route.key;
  const picker = useDirectoryPicker(machineId, () => {
    // A link can push a newer step over this one while it opens; leaving would close that one.
    if (!navigation.isFocused()) return false;
    // The Tabs of the new Workspace do not exist yet, so the flow returns to Home, which lists it.
    router.dismissTo("/");
    return true;
  });
  const machine = machines.find((candidate) => candidate.id === machineId);
  const connected = machine?.connection === "connected";

  // A link can name a Machine this device does not know, or one the Machine step would not offer
  // because it is not connected; a Machine can also be unpaired while the step shows. The flow
  // then closes back to Home, which a redirect would push a second time. A Machine that only
  // disconnects while the step shows keeps the step.
  const entered = useRef(false);
  useEffect(() => {
    if (starting) return;
    const entering = !entered.current;
    entered.current = true;
    if (machine === undefined || (entering && !connected)) router.dismissTo("/");
  }, [starting, machine, connected, router]);
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
