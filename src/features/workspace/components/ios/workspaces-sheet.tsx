import {
  BottomSheet,
  Button,
  ContextMenu,
  Divider,
  Group,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  SwipeActions,
  Text,
  TextField,
  VStack,
  type TextFieldRef,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  animation,
  Animation,
  autocorrectionDisabled,
  buttonStyle,
  contentShape,
  disabled,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  lineLimit,
  listStyle,
  padding,
  presentationDetents,
  presentationDragIndicator,
  contentTransition,
  type PresentationDetent,
  shapes,
  submitLabel,
  textInputAutocapitalization,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Color } from "expo-router";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import type { ColorValue } from "react-native";

import { rowCommands, type Control } from "@/features/home/actions";
import type { WorkspaceRow } from "@/features/home/model";
import type { RowAlerts } from "@/features/home/row-alerts";
import { connectionStateText } from "@/shared/machines/text";
import { useColors } from "@/shared/theme/colors";
import { secondary } from "@/shared/ui/ios/modifiers";

import { text } from "../../text";
import { menuItem } from "./workspace-bar";

/**
 * Search and New Workspace, then the Workspaces Home lists, with the one on screen checked.
 * Picking a Workspace closes the sheet on its Tabs. `alerts` shows Rename and Kill over the
 * sheet while it is open. While Search has the keyboard, New Workspace turns into Cancel, which
 * clears and leaves Search and brings the sheet back to half height, as the system's search does.
 */
export function WorkspacesSheet({
  open,
  onClose,
  rows,
  selected,
  alerts,
  alertsView,
  onSwitch,
  onNewWorkspace,
}: {
  open: boolean;
  onClose: () => void;
  rows: readonly WorkspaceRow[];
  selected: string;
  alerts: RowAlerts;
  /** Wraps the sheet's content in the alerts, which show over the topmost view. */
  alertsView: (children: ReactNode) => ReactNode;
  onSwitch: (row: WorkspaceRow) => void;
  onNewWorkspace: (() => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [detent, setDetent] = useState<PresentationDetent>("medium");
  const field = useRef<TextFieldRef>(null);
  const needle = query.trim().toLocaleLowerCase();
  const shown =
    needle === ""
      ? rows
      : rows.filter((row) => row.workspace.name.toLocaleLowerCase().includes(needle));
  // The field keeps its own text: the sheet's content stays mounted while it is closed, so it
  // would come back with the old query over every Workspace. Clearing it clears both.
  const reset = () => {
    void field.current?.clear();
    void field.current?.blur();
    setQuery("");
    setSearching(false);
    setDetent("medium");
  };
  const close = () => {
    reset();
    onClose();
  };

  return (
    <BottomSheet isPresented={open} onIsPresentedChange={(presented) => !presented && close()}>
      <Group
        modifiers={[
          presentationDetents(["medium", "large"], {
            selection: detent,
            onSelectionChange: setDetent,
          }),
          presentationDragIndicator("visible"),
        ]}
      >
        {alertsView(
          <VStack spacing={0}>
            <HStack spacing={12} modifiers={[padding({ top: 24, horizontal: 16, bottom: 4 })]}>
              <SearchField
                field={field}
                query={query}
                onChange={setQuery}
                onFocusChange={(focused) => {
                  setSearching(focused);
                  // The keyboard would cover half a sheet, so Search takes all of it.
                  if (focused) setDetent("large");
                }}
              />
              <Button
                onPress={
                  searching
                    ? reset
                    : onNewWorkspace &&
                      (() => {
                        close();
                        onNewWorkspace();
                      })
                }
                modifiers={[
                  buttonStyle("plain"),
                  disabled(!searching && !onNewWorkspace),
                  accessibilityLabel(searching ? text.cancelSearch : text.newWorkspace),
                ]}
              >
                {/* As the system's bar: the plus gives way to the X with the system's symbol
                    transition. The glass is a circle as tall as Search, so the two line up. */}
                <Image
                  systemName={searching ? "xmark" : "plus"}
                  modifiers={[
                    font({ size: 22, weight: "medium" }),
                    contentTransition("symbolEffect"),
                    animation(Animation.snappy(), searching),
                    frame({ width: FIELD_HEIGHT, height: FIELD_HEIGHT }),
                    glassEffect({
                      glass: { variant: "regular", interactive: true },
                      shape: "circle",
                    }),
                    contentShape(shapes.circle()),
                  ]}
                />
              </Button>
            </HStack>
            <List modifiers={[listStyle("plain")]}>
              <Section>
                {shown.map((row) => (
                  <SheetRow
                    key={row.key}
                    row={row}
                    checked={row.key === selected}
                    commands={rowCommands(
                      row,
                      alerts.handlers,
                      alerts.underway.get(row.key) ?? null,
                    )}
                    onPick={() => {
                      close();
                      onSwitch(row);
                    }}
                  />
                ))}
              </Section>
            </List>
          </VStack>,
        )}
      </Group>
    </BottomSheet>
  );
}

/** The height of the system's search field in a bar, which New Workspace's circle matches. */
const FIELD_HEIGHT = 48;

/** As the system's search field: glass, Search on the keyboard, and Clear while it has text. */
function SearchField({
  field,
  query,
  onChange,
  onFocusChange,
}: {
  field: RefObject<TextFieldRef | null>;
  query: string;
  onChange: (query: string) => void;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <HStack
      spacing={8}
      modifiers={[
        padding({ horizontal: 11.5 }),
        frame({ height: FIELD_HEIGHT }),
        // Glass, as the system's search field in a bar.
        glassEffect({ glass: { variant: "regular", interactive: true }, shape: "capsule" }),
      ]}
    >
      <Image
        systemName="magnifyingglass"
        // The size, weight, and color of the system search field's glass.
        modifiers={[font({ size: 17, weight: "medium" }), accessibilityHidden()]}
      />
      <TextField
        ref={field}
        onTextChange={onChange}
        onFocusChange={onFocusChange}
        modifiers={[
          textInputAutocapitalization("never"),
          autocorrectionDisabled(),
          submitLabel("search"),
        ]}
      >
        {/* As bright as the system's placeholder; the default is dimmer. */}
        <TextField.Placeholder>
          <Text modifiers={[foregroundStyle({ type: "color", color: Color.ios.secondaryLabel })]}>
            {text.searchWorkspaces}
          </Text>
        </TextField.Placeholder>
      </TextField>
      {query !== "" && (
        <Button
          onPress={() => {
            void field.current?.clear();
            onChange("");
          }}
          modifiers={[buttonStyle("plain"), accessibilityLabel(text.clearText)]}
        >
          <Image systemName="xmark.circle.fill" modifiers={[font({ size: 17 })]} />
        </Button>
      )}
    </HStack>
  );
}

function SheetRow({
  row,
  checked,
  commands,
  onPick,
}: {
  row: WorkspaceRow;
  checked: boolean;
  commands: ReturnType<typeof rowCommands>;
  onPick: () => void;
}) {
  const colors = useColors();
  const { connection } = row;
  const connected = connection === "connected";
  const detail =
    connection === "connected"
      ? row.machineName
      : `${row.machineName} · ${connectionStateText(connection)}`;
  const button = (
    <Button onPress={onPick} modifiers={[disabled(commands.underway !== null)]}>
      <HStack spacing={8} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ textStyle: "headline" }),
              lineLimit(1),
              ...(connected ? [] : [secondary]),
            ]}
          >
            {row.workspace.name}
          </Text>
          <Text modifiers={[font({ textStyle: "subheadline" }), secondary, lineLimit(1)]}>
            {detail}
          </Text>
        </VStack>
        <Spacer minLength={8} />
        {checked && (
          <Image
            systemName="checkmark"
            modifiers={[
              font({ weight: "semibold" }),
              foregroundStyle({ type: "color", color: colors.tint }),
              accessibilityLabel(text.current),
            ]}
          />
        )}
      </HStack>
    </Button>
  );
  if (commands.underway !== null) return button;
  const withMenu = (
    <ContextMenu>
      <ContextMenu.Items>
        {menuItem(text.newTab, "plus.square.on.square", commands.newTab)}
        {menuItem(text.renameWorkspace, "pencil", commands.rename)}
        <Divider />
        {menuItem(text.killWorkspace, "xmark", commands.kill, true)}
      </ContextMenu.Items>
      <ContextMenu.Trigger>{button}</ContextMenu.Trigger>
    </ContextMenu>
  );
  if (!commands.swipes) return withMenu;
  // As on Home: two circles with no words; a full swipe is Kill Workspace, which asks first.
  return (
    <SwipeActions>
      {withMenu}
      <SwipeActions.Actions edge="trailing">
        {swipeButton(text.killWorkspace, "xmark", commands.kill, Color.ios.systemRed)}
        {swipeButton(text.renameWorkspace, "pencil", commands.rename)}
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

function swipeButton(
  label: string,
  symbol: "xmark" | "pencil",
  { onPress }: Control,
  color?: ColorValue,
) {
  return (
    <Button
      label={label}
      systemImage={symbol}
      onPress={onPress}
      modifiers={[labelStyle("iconOnly"), ...(color === undefined ? [] : [tint(color)])]}
    />
  );
}
