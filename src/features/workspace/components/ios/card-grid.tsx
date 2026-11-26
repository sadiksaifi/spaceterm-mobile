import {
  Button,
  ContextMenu,
  HStack,
  Image,
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
  buttonStyle,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  onTapGesture,
  padding,
  shapes,
  strokeBorder,
} from "@expo/ui/swift-ui/modifiers";
import { Color } from "expo-router";
import type { ReactNode } from "react";
import { useWindowDimensions, type ColorValue } from "react-native";

import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";

import type { Split } from "../../layout";
import { useTerminalBackground } from "../../terminal";

/** The grid's metrics from the mockups. */
const SIDE = 16;
const GAP = 12;
const ROW_GAP = 20;
const CORNER = 28;
/** A card is a little taller than wide, as the mockups draw it. */
const ASPECT = 1.1;
const CLOSE_SIZE = 24;
const CLOSE_INSET = 10;
const DASH = [6, 5];

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

/**
 * Cards two to a row, each a snapshot over its name, then the tile that adds one more. The grid
 * of Tabs and the Panes sheet share it.
 */
export function CardGrid({
  cards,
  addLabel,
  onAdd,
  width,
}: {
  cards: readonly Card[];
  addLabel: string;
  onAdd: (() => void) | undefined;
  /** The width the grid fills. */
  width?: number;
}) {
  const window = useWindowDimensions();
  const cardWidth = ((width ?? window.width) - 2 * SIDE - GAP) / 2;
  const cardHeight = cardWidth * ASPECT;
  const tiles: ReactNode[] = [
    ...cards.map((card) => (
      <CardView key={card.key} card={card} width={cardWidth} height={cardHeight} />
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

function CardView({ card, width, height }: { card: Card; width: number; height: number }) {
  const colors = useColors();
  const terminal = useTerminalBackground();
  const snapshot = (
    <ZStack alignment="topTrailing" modifiers={[frame({ width, height })]}>
      {/* The snapshot and its close button are separate elements for VoiceOver. */}
      <ZStack
        modifiers={[
          frame({ width, height }),
          background(terminal),
          clipShape("roundedRectangle", CORNER),
          contentShape(shapes.roundedRectangle({ cornerRadius: CORNER })),
          onTapGesture(card.onPress),
          accessibilityLabel(card.name),
          accessibilityAddTraits(["isButton"]),
        ]}
      >
        {card.split && <SplitView split={card.split} terminal={terminal} line={colors.separator} />}
      </ZStack>
      <Button
        onPress={card.onClose}
        modifiers={[
          buttonStyle("plain"),
          padding({ all: CLOSE_INSET }),
          accessibilityLabel(card.closeLabel),
        ]}
      >
        <Image
          systemName="xmark"
          modifiers={[
            font({ size: 11, weight: "bold" }),
            foregroundStyle({ type: "color", color: "#FFFFFF" }),
            frame({ width: CLOSE_SIZE, height: CLOSE_SIZE }),
            background(Color.ios.systemGray3, shapes.circle()),
          ]}
        />
      </Button>
    </ZStack>
  );

  return (
    <VStack alignment="leading" spacing={10} modifiers={[frame({ width })]}>
      <ContextMenu>
        <ContextMenu.Items>{card.menu}</ContextMenu.Items>
        <ContextMenu.Trigger>{snapshot}</ContextMenu.Trigger>
      </ContextMenu>
      <Text modifiers={[font({ textStyle: "body" }), lineLimit(1), padding({ leading: 10 })]}>
        {card.name}
      </Text>
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
      <VStack alignment="leading" spacing={10} modifiers={[frame({ width })]}>
        <ZStack
          modifiers={[
            frame({ width, height }),
            strokeBorder({
              content: colors.separator,
              style: { lineWidth: 1, dash: DASH },
              shape: "roundedRectangle",
              cornerRadius: CORNER,
            }),
          ]}
        >
          <Image systemName="plus" modifiers={[font({ size: 28, weight: "light" }), secondary]} />
        </ZStack>
        <Text
          modifiers={[
            font({ textStyle: "body" }),
            secondary,
            lineLimit(1),
            padding({ leading: 10 }),
          ]}
        >
          {label}
        </Text>
      </VStack>
    </Button>
  );
}

/**
 * A Tab's split, each Pane a part of the card. The Panes' last screens cannot be read yet
 * (sadiksaifi/SpaceTerm#948), so each part shows the terminal's background only.
 */
function SplitView({
  split,
  terminal,
  line,
}: {
  split: Split;
  terminal: string;
  line: ColorValue;
}) {
  if (split.kind === "pane") {
    return <Rectangle modifiers={[foregroundStyle({ type: "color", color: terminal })]} />;
  }
  const parts = (
    <>
      <SplitView split={split.first} terminal={terminal} line={line} />
      <SplitView split={split.second} terminal={terminal} line={line} />
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
