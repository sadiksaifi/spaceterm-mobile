import { Redirect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";

import { useMachines } from "@/shared/machines/client";

import { useDirectoryPicker } from "../use-directory-picker";
import DirectoryStepScreen from "./screen";

/** The directory of the new Workspace, on the Machine the route names. */
export default function DirectoryStepRoute() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { machines } = useMachines();
  const router = useRouter();
  // This step is the first of the flow when the Machine step was skipped. Its place in the
  // flow's stack does not change while it shows.
  const first = useNavigation().getState()?.index === 0;
  const picker = useDirectoryPicker(machineId, () =>
    // The Tabs of the new Workspace do not exist yet, so the flow returns to Home, which lists it.
    router.dismissTo("/"),
  );
  const machine = machines.find((candidate) => candidate.id === machineId);
  // A link can name a Machine this device does not know, or one unpaired since.
  if (machine === undefined) return <Redirect href="/" />;

  return (
    <DirectoryStepScreen
      machineName={machine.name}
      picker={picker}
      leading={first ? "cancel" : "back"}
      onLeave={() => router.back()}
    />
  );
}
