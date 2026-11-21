import { Box, Column, Icon, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxSize,
  padding,
  Shapes,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";

import { heading } from "@/modules/compose-modifiers";
import { useColors } from "@/shared/theme/colors";

/** Fills the space it has and centers its content, keeping `bottom` free below it. */
export function Centered({ children, bottom }: { children: ReactNode; bottom: number }) {
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement="center"
      modifiers={[fillMaxSize(), padding(40, 0, 40, bottom)]}
    >
      {children}
    </Column>
  );
}

/** A state's icon on a tile: the error container after an attempt failed, the secondary container otherwise. */
export function StateTile({ icon, failed = false }: { icon: number; failed?: boolean }) {
  const colors = useMaterialColors();
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        padding(0, 0, 0, 20),
        size(80, 80),
        clip(Shapes.RoundedCorner(28)),
        background(failed ? colors.errorContainer : colors.secondaryContainer),
      ]}
    >
      <Icon
        source={icon}
        size={40}
        tint={failed ? colors.onErrorContainer : colors.onSecondaryContainer}
      />
    </Box>
  );
}

export function StateTitle({ children }: { children: string }) {
  return (
    <Text style={{ typography: "titleLarge", textAlign: "center" }} modifiers={[heading()]}>
      {children}
    </Text>
  );
}

/** A state's sentence. `top` is the space above it: more for a second paragraph. */
export function StateBody({ children, top = 8 }: { children: ReactNode; top?: number }) {
  const colors = useColors();
  return (
    <Text
      style={{ typography: "bodyMedium", textAlign: "center" }}
      color={colors.secondaryText}
      modifiers={[padding(0, top, 0, 0)]}
    >
      {children}
    </Text>
  );
}

/** The column of buttons under a state's text. */
export function StateActions({ children }: { children: ReactNode }) {
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 4 }}
      modifiers={[padding(0, 24, 0, 0)]}
    >
      {children}
    </Column>
  );
}
