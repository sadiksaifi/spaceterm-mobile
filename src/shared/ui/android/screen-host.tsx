import { Host } from "@expo/ui";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";

/**
 * The Compose host that fills a screen, in the scheme `useColors` uses. Left to itself, a host
 * reads light or dark from its window, and a screen the stack covers is out of its window when
 * the system switches, so it would come back in the old scheme.
 */
export function ScreenHost({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <Host style={{ flex: 1 }} colorScheme={scheme}>
      {children}
    </Host>
  );
}
