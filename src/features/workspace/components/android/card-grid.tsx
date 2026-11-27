import addIcon from "@expo/material-symbols/add.xml";
import closeIcon from "@expo/material-symbols/close.xml";
import {
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Row,
  Shape,
  Surface,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  combinedClickable,
  defaultMinSize,
  fillMaxHeight,
  fillMaxSize,
  fillMaxWidth,
  height as fixedHeight,
  padding,
  semantics,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState, type ReactNode } from "react";
import { useWindowDimensions, type ColorValue } from "react-native";

import type { PaneScreen } from "@/shared/machines/model";
import type { TerminalColors } from "@/shared/preferences/model";
import { useColors } from "@/shared/theme/colors";
import { hiddenFromAccessibility } from "@/modules/compose-modifiers";

import type { Control } from "@/features/home/actions";

import type { Split } from "../../layout";
import { runColors, SNAPSHOT_TEXT } from "../../snapshot";
import { useTerminalColors } from "../../terminal";
import type { Screens } from "../../use-pane-previews";

/** The grid's metrics from the mockups. */
const SIDE = 16;
const GAP = 12;
const CORNER = 20;
const SNAPSHOT_CORNER = 16;
const TITLE_HEIGHT = 44;
const CLOSE_SIZE = 18;
const SNAPSHOT_INSET = 4;
/** A card is taller than wide, as the mockups draw it. */
const ASPECT = 1.26;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
const MENU_WIDTH = 196;

export type CardMenuItem = { label: string; control: Control };

export type Card = {
  key: string;
  name: string;
  split: Split | null;
  /** A Pane on screen takes the selected fill; nothing on this screen is on screen yet. */
  onPress: () => void;
  closeLabel: string;
  onClose: () => void;
  /** The touch and hold menu, which opens at the card. */
  menu: readonly CardMenuItem[];
};

/**
 * Cards two to a row, each a title row over its snapshot, then the outlined tile that adds one
 * more. The grid of Tabs and the Panes sheet share it.
 */
export function CardGrid({
  cards,
  screens,
  addLabel,
  onAdd,
}: {
  cards: readonly Card[];
  /** The Panes' last screens, by Pane. */
  screens: Screens;
  addLabel: string;
  onAdd: (() => void) | undefined;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 2 * SIDE - GAP) / 2;
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
    <Column verticalArrangement={{ spacedBy: GAP }} modifiers={[padding(SIDE, 0, SIDE, 0)]}>
      {rows.map((pair, index) => (
        <Row key={index} horizontalArrangement={{ spacedBy: GAP }}>
          {pair}
        </Row>
      ))}
    </Column>
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
  const material = useMaterialColors();
  const terminal = useTerminalColors();
  const [held, setHeld] = useState(false);

  return (
    <DropdownMenu
      expanded={held}
      onDismissRequest={() => setHeld(false)}
      color={material.surfaceContainerHigh}
      cornerRadius={MENU_CORNER}
      shadowElevation={MENU_ELEVATION}
    >
      <DropdownMenu.Trigger>
        <Surface
          color={held ? material.surfaceContainerHighest : material.surfaceContainer}
          contentColor={colors.text}
          modifiers={[
            size(width, height),
            clip(Shapes.RoundedCorner(CORNER)),
            combinedClickable({ onClick: card.onPress, onLongClick: () => setHeld(true) }),
          ]}
        >
          <Column modifiers={[fillMaxSize()]}>
            <Row
              verticalAlignment="center"
              modifiers={[fillMaxWidth(), fixedHeight(TITLE_HEIGHT), padding(16, 0, 0, 0)]}
            >
              <Text
                maxLines={1}
                overflow="ellipsis"
                style={{ typography: "titleSmall" }}
                modifiers={[weight(1)]}
              >
                {card.name}
              </Text>
              <IconButton onClick={card.onClose}>
                <Icon
                  source={closeIcon}
                  contentDescription={card.closeLabel}
                  modifiers={[size(CLOSE_SIZE, CLOSE_SIZE)]}
                />
              </IconButton>
            </Row>
            <Box
              modifiers={[
                fillMaxWidth(),
                weight(1),
                padding(SNAPSHOT_INSET, 0, SNAPSHOT_INSET, SNAPSHOT_INSET),
                clip(Shapes.RoundedCorner(SNAPSHOT_CORNER)),
                background(terminal.background),
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
            </Box>
          </Column>
        </Surface>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {card.menu.map(({ label, control: { onPress } }) => (
          <DropdownMenuItem
            key={label}
            enabled={!!onPress}
            modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
            onClick={() => {
              setHeld(false);
              onPress?.();
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{label}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}

/** The last tile: an outline with a plus over its label, in the primary color. */
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
  const material = useMaterialColors();
  return (
    <Surface
      color="#00000000"
      contentColor={material.primary}
      enabled={!!onAdd}
      onClick={onAdd}
      // The Surface's own shape and border, so the outline follows the rounded corners.
      shape={Shape.RoundedCorner({
        cornerRadii: { topStart: CORNER, topEnd: CORNER, bottomStart: CORNER, bottomEnd: CORNER },
      })}
      border={{ width: 1, color: material.outlineVariant }}
      modifiers={[size(width, height), semantics({ contentDescription: label })]}
    >
      <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[fillMaxSize()]}>
        <Icon source={addIcon} tint={material.primary} size={24} />
        <Text style={{ typography: "titleSmall" }} color={material.primary}>
          {label}
        </Text>
      </Column>
    </Surface>
  );
}

/** A Tab's split, each Pane a part of the snapshot that shows its last screen. */
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
  const first = <SplitView split={split.first} screens={screens} terminal={terminal} line={line} />;
  const second = (
    <SplitView split={split.second} screens={screens} terminal={terminal} line={line} />
  );
  // The one-dp gap between the parts shows the line color behind them.
  return split.axis === "row" ? (
    <Row horizontalArrangement={{ spacedBy: 1 }} modifiers={[fillMaxSize(), background(line)]}>
      <Box modifiers={[weight(1), fillMaxHeight()]}>{first}</Box>
      <Box modifiers={[weight(1), fillMaxHeight()]}>{second}</Box>
    </Row>
  ) : (
    <Column verticalArrangement={{ spacedBy: 1 }} modifiers={[fillMaxSize(), background(line)]}>
      <Box modifiers={[weight(1), fillMaxWidth()]}>{first}</Box>
      <Box modifiers={[weight(1), fillMaxWidth()]}>{second}</Box>
    </Column>
  );
}

/** A Pane's screen from the top-left, cropped where the part ends. */
function PaneSnapshot({
  screen,
  terminal,
}: {
  screen: PaneScreen | undefined;
  terminal: TerminalColors;
}) {
  const lines =
    screen?.rows.flatMap((row, at) => [
      ...(at === 0 ? [] : ["\n"]),
      ...row.map((run, index) => {
        const { foreground, background: fill } = runColors(run, terminal, true);
        return (
          <Text
            key={`${at}/${index}`}
            color={foreground}
            style={{
              fontWeight: run.bold ? "bold" : undefined,
              fontStyle: run.italic ? "italic" : undefined,
              textDecoration: run.underline
                ? "underline"
                : run.strikethrough
                  ? "lineThrough"
                  : undefined,
              background: fill ?? undefined,
            }}
          >
            {run.text}
          </Text>
        );
      }),
    ]) ?? [];
  return (
    // The card's name speaks for it; TalkBack does not read the screen's text.
    <Box
      modifiers={[
        fillMaxSize(),
        clip(Shapes.Rectangle),
        background(terminal.background),
        hiddenFromAccessibility(),
      ]}
    >
      {lines.length > 0 && (
        <Text
          softWrap={false}
          overflow="clip"
          color={terminal.foreground}
          style={{
            fontFamily: "monospace",
            fontSize: SNAPSHOT_TEXT.size,
            lineHeight: SNAPSHOT_TEXT.lineHeight,
          }}
          // Only the top-left is inset, so the text is cut at the part's own edges.
          modifiers={[
            fillMaxSize(),
            padding(SNAPSHOT_TEXT.horizontal, SNAPSHOT_TEXT.vertical, 0, 0),
          ]}
        >
          {lines}
        </Text>
      )}
    </Box>
  );
}
