import { Stack } from "expo-router";

/**
 * The steps of New Workspace. Opening a directory replaces the Machine step in the same sheet on
 * iOS, with Back to return; on Android each step is a page.
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
