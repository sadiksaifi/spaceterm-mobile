import { Stack } from "expo-router";

/**
 * The steps of New Workspace. Choosing a Machine pushes its Directory step over the Machine step,
 * in the same sheet on iOS, and Back returns to it; on Android each step is a page.
 */
export default function NewWorkspaceLayout() {
  const ios = process.env.EXPO_OS === "ios";
  // iOS shows Back as the chevron alone, as the design draws it.
  return (
    <Stack
      screenOptions={{ headerShown: ios, ...(ios && { headerBackButtonDisplayMode: "minimal" }) }}
    />
  );
}
