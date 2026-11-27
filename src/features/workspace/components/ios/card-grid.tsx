import {
  Button,
  ContextMenu,
  HStack,
  Image,
  Overlay,
  Rectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  bold,
  buttonStyle,
  clipShape,
  clipped,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  italic,
  lineLimit,
  lineSpacing,
  onTapGesture,
  padding,
  shapes,
  strikethrough,
  strokeBorder,
  underline,
} from "@expo/ui/swift-ui/modifiers";
import { Color } from "expo-router";
import type { ReactNode } from "react";
import { useWindowDimensions, type ColorValue } from "react-native";

import type { PaneScreen } from "@/shared/machines/model";
import type { TerminalColors } from "@/shared/preferences/model";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";

import type { Split } from "../../layout";
import { runColors, SNAPSHOT_TEXT } from "../../snapshot";
import { useTerminalColors } from "../../terminal";
import type { Screens } from "../../use-pane-previews";

/** The grid's metrics from the mockups. */
const SIDE = 16;
const GAP = 14;
const ROW_GAP = 18;
const CORNER = 20;
/** A card is a little taller than wide, as the mockups draw it. */
const ASPECT = 1.1;
const CLOSE_SIZE = 24;
const CLOSE_INSET = 10;
const DASH = [4, 4];
const CAPTION_HEIGHT = 20;
const CAPTION_GAP = 8;
const caption = font({ textStyle: "subheadline", weight: "medium" });

export type Card = {
  key: string;
  name: string;
  split: Split | null;
  onPress: () => void;
  closeLabel: string;
  onClose: () => void;
  /** The touch and hold menu's items. */
  menu: ReactNode;
};

/** The height of a grid of `count` cards and the add tile, `width` wide. */
export function cardGridHeight(count: number, width: number): number {
  const rows = Math.ceil((count + 1) / 2);
  const cardHeight = cardWidthIn(width) * ASPECT;
  return rows * (cardHeight + CAPTION_GAP + CAPTION_HEIGHT) + (rows - 1) * ROW_GAP;
}

function cardWidthIn(width: number): number {
  return (width - 2 * SIDE - GAP) / 2;
}

/**
 * Cards two to a row, each a snapshot over its name, then the tile that adds one more. The grid
 * of Tabs and the Panes sheet share it.
 */
export function CardGrid({
  cards,
  screens,
  addLabel,
  onAdd,
  width,
}: {
  cards: readonly Card[];
  /** The Panes' last screens, by Pane. */
  screens: Screens;
  addLabel: string;
  onAdd: (() => void) | undefined;
  /** The width the grid fills. */
  width?: number;
}) {
  const window = useWindowDimensions();
  const cardWidth = cardWidthIn(width ?? window.width);
  const cardHeight = cardWidth * ASPECT;
  const tiles: ReactNode[] = [
    ...cards.map((card) => (
      <CardView
        key={card.key}
        card={card}
        screens={screens}
        width={cardWidth}
        height={cardHeight}
      />
    )),
    <AddTile key="add" label={addLabel} onAdd={onAdd} width={cardWidth} height={cardHeight} />,
  ];
  const rows: ReactNode[][] = [];
  for (let at = 0; at < tiles.length; at += 2) rows.push(tiles.slice(at, at + 2));

  return (
    <VStack alignment="leading" spacing={ROW_GAP} modifiers={[padding({ horizontal: SIDE })]}>
      {rows.map((pair, index) => (
        <HStack key={index} alignment="top" spacing={GAP}>
          {pair}
          {pair.length === 1 && <Spacer />}
        </HStack>
      ))}
    </VStack>
  );
}

function CardView({
  card,
  screens,
  width,
  height,
}: {
  card: Card;
  screens: Screens;
  width: number;
  height: number;
}) {
  const colors = useColors();
  const terminal = useTerminalColors();
  const snapshot = (
    <ZStack
      modifiers={[
        frame({ width, height }),
        background(terminal.background),
        clipShape("roundedRectangle", CORNER),
        strokeBorder({
          content: colors.separator,
          style: { lineWidth: 1 },
          shape: "roundedRectangle",
          cornerRadius: CORNER,
        }),
        contentShape(shapes.roundedRectangle({ cornerRadius: CORNER })),
        onTapGesture(card.onPress),
        accessibilityLabel(card.name),
        accessibilityAddTraits(["isButton"]),
      ]}
    >
      {card.split && (
        <SplitView
          split={card.split}
          screens={screens}
          terminal={terminal}
          line={colors.separator}
        />
      )}
    </ZStack>
  );

  return (
    <VStack alignment="leading" spacing={CAPTION_GAP} modifiers={[frame({ width })]}>
      {/* The close button sits beside the touch and hold menu, not in it, so the menu's press
          does not take its taps and the lifted card shows without it. */}
      <ZStack alignment="topTrailing" modifiers={[frame({ width, height })]}>
        <ContextMenu>
          <ContextMenu.Items>{card.menu}</ContextMenu.Items>
          <ContextMenu.Trigger>{snapshot}</ContextMenu.Trigger>
        </ContextMenu>
        <Button
          onPress={card.onClose}
          modifiers={[buttonStyle("plain"), accessibilityLabel(card.closeLabel)]}
        >
          {/* The inset is part of the button, so it takes taps across the full 44 points. */}
          <Image
            systemName="xmark"
            modifiers={[
              font({ size: 11, weight: "bold" }),
              foregroundStyle({ type: "color", color: "#FFFFFF" }),
              frame({ width: CLOSE_SIZE, height: CLOSE_SIZE }),
              background(Color.ios.systemGray3, shapes.circle()),
              padding({ all: CLOSE_INSET }),
              contentShape(shapes.rectangle()),
            ]}
          />
        </Button>
      </ZStack>
      <Text modifiers={[caption, lineLimit(1), padding({ horizontal: 4 })]}>{card.name}</Text>
    </VStack>
  );
}

/** The last tile: a dashed outline with a plus, over its label. */
function AddTile({
  label,
  onAdd,
  width,
  height,
}: {
  label: string;
  onAdd: (() => void) | undefined;
  width: number;
  height: number;
}) {
  const colors = useColors();
  return (
    <Button onPress={onAdd} modifiers={[buttonStyle("plain"), accessibilityLabel(label)]}>
      {/* The whole tile takes taps, not only what it draws. */}
      <VStack
        alignment="leading"
        spacing={CAPTION_GAP}
        modifiers={[frame({ width }), contentShape(shapes.rectangle())]}
      >
        <ZStack
          modifiers={[
            frame({ width, height }),
            strokeBorder({
              content: colors.separator,
              style: { lineWidth: 1.5, dash: DASH },
              shape: "roundedRectangle",
              cornerRadius: CORNER,
            }),
          ]}
        >
          <Image systemName="plus" modifiers={[font({ size: 28, weight: "light" }), secondary]} />
        </ZStack>
        <Text modifiers={[caption, secondary, lineLimit(1), padding({ horizontal: 4 })]}>
          {label}
        </Text>
      </VStack>
    </Button>
  );
}

/** A Tab's split, each Pane a part of the card that shows its last screen. */
function SplitView({
  split,
  screens,
  terminal,
  line,
}: {
  split: Split;
  screens: Screens;
  terminal: TerminalColors;
  line: ColorValue;
}) {
  if (split.kind === "pane") {
    return <PaneSnapshot screen={screens[split.pane.id]} terminal={terminal} />;
  }
  const parts = (
    <>
      <SplitView split={split.first} screens={screens} terminal={terminal} line={line} />
      <SplitView split={split.second} screens={screens} terminal={terminal} line={line} />
    </>
  );
  // The one-point gap between the parts shows the line color behind them.
  return split.axis === "row" ? (
    <HStack spacing={1} modifiers={[background(line)]}>
      {parts}
    </HStack>
  ) : (
    <VStack spacing={1} modifiers={[background(line)]}>
      {parts}
    </VStack>
  );
}

const SNAPSHOT_FONT = font({ size: SNAPSHOT_TEXT.size, design: "monospaced" });
/** The space between lines that makes up the mockups' line height. */
const SNAPSHOT_LINE_SPACING = SNAPSHOT_TEXT.lineHeight - SNAPSHOT_TEXT.size * 1.2;

/**
 * A Pane's screen from the top-left, cropped where the part ends. SwiftUI draws no background
 * behind part of a text, so a filled run takes its fill as its text color.
 */
function PaneSnapshot({
  screen,
  terminal,
}: {
  screen: PaneScreen | undefined;
  terminal: TerminalColors;
}) {
  const part = (
    <Rectangle modifiers={[foregroundStyle({ type: "color", color: terminal.background })]} />
  );
  if (screen === undefined || screen.rows.length === 0) return part;
  const lines = screen.rows.flatMap((row, at) => [
    ...(at === 0 ? [] : [<Text key={`${at}`}>{"\n"}</Text>]),
    ...row.map((run, index) => (
      <Text
        key={`${at}/${index}`}
        modifiers={[
          foregroundStyle({ type: "color", color: runColors(run, terminal, false).foreground }),
          ...(run.bold ? [bold()] : []),
          ...(run.italic ? [italic()] : []),
          ...(run.underline ? [underline({ isActive: true, pattern: "solid" })] : []),
          ...(run.strikethrough ? [strikethrough({ isActive: true, pattern: "solid" })] : []),
        ]}
      >
        {run.text}
      </Text>
    )),
  ]);
  // The text overlays the part from its top-left and is cut where the part ends.
  return (
    <Overlay alignment="topLeading" modifiers={[clipped()]}>
      {part}
      <Overlay.Content>
        <Text
          modifiers={[
            SNAPSHOT_FONT,
            lineSpacing(SNAPSHOT_LINE_SPACING),
            fixedSize({ horizontal: true, vertical: true }),
            padding({ vertical: SNAPSHOT_TEXT.vertical, horizontal: SNAPSHOT_TEXT.horizontal }),
          ]}
        >
          {lines}
        </Text>
      </Overlay.Content>
    </Overlay>
  );
}
