import { ListItem, Shape, Surface, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import { alpha, fillMaxWidth, padding } from "@expo/ui/jetpack-compose/modifiers";
import type { ColorValue } from "react-native";
import type { ReactNode } from "react";

import { heading } from "@/modules/compose-modifiers";
import { useColors } from "@/shared/theme/colors";

import { groupedCorners } from "./grouped";

/** Material's disabled content: on-surface at 38 %. */
const DISABLED = 0.38;

/**
 * One row of a grouped card: Material's list item on the card's color, with the corners of its
 * place in the group. A row with `onClick` takes taps; a disabled row is dimmed and takes none.
 */
export function GroupedRow({
  first,
  last,
  headline,
  supporting,
  leading,
  trailing,
  enabled = true,
  color,
  onClick,
}: {
  first: boolean;
  last: boolean;
  headline: ReactNode;
  supporting?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  enabled?: boolean;
  /** The card color, for a row that is held or selected. */
  color?: ColorValue;
  onClick?: () => void;
}) {
  const colors = useColors();
  return (
    <Surface
      color={color ?? colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({ cornerRadii: groupedCorners(first, last) })}
      enabled={enabled && onClick !== undefined}
      onClick={onClick}
      modifiers={[fillMaxWidth()]}
    >
      <ListItem
        // The list item reads which slots it has only when it is first drawn, so a slot that comes
        // or goes draws a new one.
        key={[supporting, leading, trailing].map((slot) => slot !== undefined).join()}
        colors={{
          containerColor: "transparent",
          contentColor: colors.text,
          supportingContentColor: colors.secondaryText,
          leadingContentColor: colors.secondaryText,
        }}
        modifiers={enabled ? [] : [alpha(DISABLED)]}
      >
        <ListItem.HeadlineContent>
          {typeof headline === "string" ? <Text>{headline}</Text> : headline}
        </ListItem.HeadlineContent>
        {supporting !== undefined && (
          <ListItem.SupportingContent>
            {typeof supporting === "string" ? <Text>{supporting}</Text> : supporting}
          </ListItem.SupportingContent>
        )}
        {leading !== undefined && <ListItem.LeadingContent>{leading}</ListItem.LeadingContent>}
        {trailing !== undefined && <ListItem.TrailingContent>{trailing}</ListItem.TrailingContent>}
      </ListItem>
    </Surface>
  );
}

/** The title over a grouped card: title small in the primary color, read out as a heading. */
export function GroupHeader({ children }: { children: string }) {
  const material = useMaterialColors();
  return (
    <Text
      style={{ typography: "titleSmall" }}
      color={material.primary}
      modifiers={[padding(8, 16, 8, 8), heading()]}
    >
      {children}
    </Text>
  );
}
