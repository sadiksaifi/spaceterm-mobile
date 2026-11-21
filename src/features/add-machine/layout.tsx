import { Stack } from "expo-router";

import { AddMachineFlowProvider } from "./flow";

/**
 * The steps of Add Machine, in one sheet on iOS and as pages on Android. The camera is the first
 * step, so it is under the Invitation Link step even where the flow opens there.
 */
export default function AddMachineLayout() {
  const ios = process.env.EXPO_OS === "ios";
  return (
    <AddMachineFlowProvider>
      {/* iOS shows Back as the chevron alone, as the design draws it. */}
      <Stack
        screenOptions={{ headerShown: ios, ...(ios && { headerBackButtonDisplayMode: "minimal" }) }}
      />
    </AddMachineFlowProvider>
  );
}
