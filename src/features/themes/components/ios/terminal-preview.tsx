import { Capsule, HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  background,
  clipShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";

import type { TerminalColors } from "@/shared/preferences/model";

import { PREVIEW_LINES, PREVIEW_SIZES, roleColor, THUMBNAIL, THUMBNAIL_BARS } from "../../preview";

const PREVIEW_CORNER = 14;
const THUMBNAIL_CORNER = 9;
/** The hairline that keeps a preview's edge visible on a row of the same tone. */
const RING = "#80808040";

/**
 * The hairline around a preview: a rounded fill `width` larger on every side, behind the
 * preview's own opaque fill.
 */
const ring = (corner: number, width: number) => [
  padding({ all: width }),
  background(RING, shapes.roundedRectangle({ cornerRadius: corner + width })),
];

/** A short shell session in a theme's colors. It shows the colors; screen readers skip it. */
export function TerminalPreview({
  colors,
  size,
}: {
  colors: TerminalColors;
  size: keyof typeof PREVIEW_SIZES;
}) {
  const metrics = PREVIEW_SIZES[size];
  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        padding({ all: metrics.padding }),
        // The preview fills its width and no more, so a long line runs on under the clipped edge.
        frame({ minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, alignment: "leading" }),
        background(colors.background, shapes.roundedRectangle({ cornerRadius: PREVIEW_CORNER })),
        clipShape("roundedRectangle", PREVIEW_CORNER),
        ...ring(PREVIEW_CORNER, 0.5),
        accessibilityHidden(),
      ]}
    >
      {PREVIEW_LINES.map((line, index) => (
        <Text
          key={index}
          modifiers={[
            font({ size: metrics.font, design: "monospaced" }),
            frame({ height: metrics.lineHeight }),
            // A terminal clips a long line; it does not end it with an ellipsis.
            fixedSize({ horizontal: true, vertical: false }),
            accessibilityHidden(),
          ]}
        >
          {line.map((span, at) => (
            <Text
              key={at}
              modifiers={[foregroundStyle({ type: "color", color: roleColor(colors, span.role) })]}
            >
              {span.text}
            </Text>
          ))}
        </Text>
      ))}
    </VStack>
  );
}

/** A list row's thumbnail: the theme's background with a few bars of its colors. */
export function ThemeThumbnail({ colors }: { colors: TerminalColors }) {
  return (
    <VStack
      alignment="leading"
      spacing={THUMBNAIL.rowGap}
      modifiers={[
        padding({ horizontal: THUMBNAIL.inset }),
        frame({ width: THUMBNAIL.width, height: THUMBNAIL.height, alignment: "leading" }),
        background(colors.background, shapes.roundedRectangle({ cornerRadius: THUMBNAIL_CORNER })),
        ...ring(THUMBNAIL_CORNER, 1),
        accessibilityHidden(),
      ]}
    >
      {THUMBNAIL_BARS.map((row, index) => (
        <HStack key={index} spacing={THUMBNAIL.barGap}>
          {row.map((bar, at) => (
            <Capsule
              key={at}
              modifiers={[
                foregroundStyle({ type: "color", color: roleColor(colors, bar.role) }),
                frame({ width: bar.width, height: THUMBNAIL.bar }),
              ]}
            />
          ))}
        </HStack>
      ))}
    </VStack>
  );
}
