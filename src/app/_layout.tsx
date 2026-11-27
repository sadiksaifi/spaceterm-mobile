import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { MachinesProvider } from "@/shared/machines/client";
import { PreferencesProvider } from "@/shared/preferences/provider";
import { useNavigationTheme } from "@/shared/theme/navigation";

// Home sits under every route, so a link that opens New Workspace from a stopped app still has
// Home to go back to.
export const unstable_settings = { anchor: "index" };

export default function RootLayout() {
  return (
    <MachinesProvider>
      <PreferencesProvider>
        <ThemeProvider value={useNavigationTheme()}>
          {/* iOS shows Back as the chevron alone, as the design draws it. */}
          <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
            <Stack.Screen
              name="new-workspace"
              options={{
                // iOS shows New Workspace in a sheet; Android shows it as full-screen pages.
                presentation: process.env.EXPO_OS === "ios" ? "modal" : "card",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="add-machine"
              options={{
                // iOS shows Add Machine in a sheet; Android shows it as full-screen pages.
                presentation: process.env.EXPO_OS === "ios" ? "modal" : "card",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="new-worktree/[machineId]/[workspaceId]"
              options={{
                // iOS shows New Worktree in a sheet; Android shows it as a full-screen page.
                presentation: process.env.EXPO_OS === "ios" ? "modal" : "card",
              }}
            />
            <Stack.Screen
              name="workspaces/[machineId]/[workspaceId]"
              options={{
                // iOS only: Android shows the Workspaces in a sheet of the Workspace screen.
                presentation: "formSheet",
                sheetAllowedDetents: [0.5, 1],
                // Close closes it, so the grabber stays hidden; a drag still resizes it.
                sheetGrabberVisible: false,
                // Transparent, so the sheet shows the system's glass.
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
            <Stack.Screen
              name="settings/themes/get-more"
              options={{
                // iOS shows Get More Themes in a sheet; Android shows it as a full-screen page.
                presentation: process.env.EXPO_OS === "ios" ? "modal" : "card",
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PreferencesProvider>
    </MachinesProvider>
  );
}
