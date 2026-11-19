import { Box, Column, Row, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
} from "@expo/ui/jetpack-compose/modifiers";

import { hiddenFromAccessibility } from "@/modules/compose-modifiers";
import type { TerminalColors } from "@/shared/preferences/model";

import { PREVIEW_LINES, PREVIEW_SIZES, roleColor, THUMBNAIL, THUMBNAIL_BARS } from "../../preview";

const PREVIEW_CORNER = 12;
/** The card preview's padding on Android, a point under iOS's. */
const CARD_PADDING = 9;
const THUMBNAIL_CORNER = 8;
const BAR_CORNER = 2;
/** The hairline that keeps a thumbnail's edge visible on a row of the same tone. */
const RING = "#80808040";
const RING_WIDTH = 1;

/** A short shell session in a theme's colors. It shows the colors; TalkBack skips it. */
export function TerminalPreview({
  colors,
  size: previewSize,
}: {
  colors: TerminalColors;
  size: keyof typeof PREVIEW_SIZES;
}) {
  const metrics = PREVIEW_SIZES[previewSize];
  const inset = previewSize === "card" ? CARD_PADDING : metrics.padding;
  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(PREVIEW_CORNER)),
        background(colors.background),
        padding(inset, inset, inset, inset),
        hiddenFromAccessibility(),
      ]}
    >
      {PREVIEW_LINES.map((line, index) => (
        <Text
          key={index}
          maxLines={1}
          softWrap={false}
          overflow="clip"
          style={{
            fontFamily: "monospace",
            fontSize: metrics.font,
            lineHeight: metrics.lineHeight,
          }}
        >
          {line.map((span, at) => (
            <Text key={at} color={roleColor(colors, span.role)}>
              {span.text}
            </Text>
          ))}
        </Text>
      ))}
    </Column>
  );
}

/**
 * A list row's thumbnail: the theme's background with a few bars of its colors, inside a
 * hairline drawn as a rounded fill 1 dp larger on every side.
 */
export function ThemeThumbnail({ colors }: { colors: TerminalColors }) {
  return (
    <Box
      contentAlignment="centerStart"
      modifiers={[
        size(THUMBNAIL.width, THUMBNAIL.height),
        clip(Shapes.RoundedCorner(THUMBNAIL_CORNER)),
        background(RING),
        padding(RING_WIDTH, RING_WIDTH, RING_WIDTH, RING_WIDTH),
        clip(Shapes.RoundedCorner(THUMBNAIL_CORNER - RING_WIDTH)),
        background(colors.background),
        hiddenFromAccessibility(),
      ]}
    >
      <Column
        verticalArrangement={{ spacedBy: THUMBNAIL.rowGap }}
        modifiers={[padding(THUMBNAIL.inset - RING_WIDTH, 0, THUMBNAIL.inset - RING_WIDTH, 0)]}
      >
        {THUMBNAIL_BARS.map((bars, index) => (
          <Row key={index} horizontalArrangement={{ spacedBy: THUMBNAIL.barGap }}>
            {bars.map((bar, at) => (
              <Box
                key={at}
                modifiers={[
                  size(bar.width, THUMBNAIL.bar),
                  clip(Shapes.RoundedCorner(BAR_CORNER)),
                  background(roleColor(colors, bar.role)),
                ]}
              />
            ))}
          </Row>
        ))}
      </Column>
    </Box>
  );
}
