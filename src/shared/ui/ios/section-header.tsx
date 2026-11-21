import { Text } from "@expo/ui/swift-ui";
import { font } from "@expo/ui/swift-ui/modifiers";

import { secondary } from "./modifiers";

/** A section header in a sheet: the headline style in secondary text. */
export function SectionHeader({ children }: { children: string }) {
  return <Text modifiers={[font({ textStyle: "headline" }), secondary]}>{children}</Text>;
}
