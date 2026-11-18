import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { MachinesProvider } from "@/shared/machines/client";
import { useNavigationTheme } from "@/shared/theme/navigation";

export default function RootLayout() {
  return (
    <MachinesProvider>
      <ThemeProvider value={useNavigationTheme()}>
        <Stack>
          <Stack.Screen
            name="new-workspace"
            options={{
              // iOS shows New Workspace in a sheet; Android shows it as full-screen pages.
              presentation: process.env.EXPO_OS === "ios" ? "modal" : "card",
              headerShown: false,
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </MachinesProvider>
  );
}
