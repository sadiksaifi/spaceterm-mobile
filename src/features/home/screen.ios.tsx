import { Host } from "@expo/ui";
import {
  Button,
  HStack,
  Image,
  List,
  ProgressView,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  multilineTextAlignment,
  padding,
  scrollDismissesKeyboard,
  textCase,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import type { ColorValue } from "react-native";
import { useCallback, useState, type ComponentProps } from "react";

import { useColors } from "@/theme/colors";

import { homeView, isSearchable, type HomeView, type WorkspaceRow } from "./model";
import type { HomeActions, HomeScreenProps } from "./props";
import { rowStateText, text, unreachableText } from "./text";

/** Empty-state metrics from the mockups. */
const ACTION_WIDTH = 230;
const ACTION_HEIGHT = 34;
/** Empty states sit above center, clear of the bottom toolbar. */
const BOTTOM_INSET = 96;
/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const [query, setQuery] = useState("");
  const view = homeView(snapshot, query);
  const colors = useColors();

  return (
    <>
      {view.kind === "workspaces" ? (
        <WorkspaceList rows={view.rows} onOpen={actions.onOpenWorkspace} />
      ) : (
        <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
          <EmptyState view={view} actions={actions} />
        </Host>
      )}

      <Stack.Screen.Title large>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={text.more}>
          <Stack.Toolbar.MenuAction
            icon="plus"
            disabled={!actions.onAddMachine}
            onPress={actions.onAddMachine}
          >
            {text.addMachine}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="gear"
            disabled={!actions.onOpenSettings}
            onPress={actions.onOpenSettings}
          >
            {text.settings}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {isSearchable(view) && (
        <>
          <Stack.SearchBar
            placeholder={text.search}
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onCancelButtonPress={() => setQuery("")}
          />
          <Stack.Toolbar placement="bottom">
            <Stack.Toolbar.SearchBarSlot />
            <Stack.Toolbar.Spacer />
            <Stack.Toolbar.Button
              icon="plus"
              accessibilityLabel={text.newWorkspace}
              disabled={!view.canCreateWorkspace || !actions.onNewWorkspace}
              onPress={actions.onNewWorkspace}
              separateBackground
            />
          </Stack.Toolbar>
        </>
      )}
    </>
  );
}

function WorkspaceList({
  rows,
  onOpen,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const colors = useColors();
  const renderRow = useCallback(
    ({ item }: { item: WorkspaceRow }) => <WorkspaceRowView row={item} onOpen={onOpen} />,
    [onOpen],
  );

  return (
    <Host style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      <List modifiers={[listStyle("insetGrouped"), scrollDismissesKeyboard("interactively")]}>
        <Section>
          <List.ForEach data={rows} keyExtractor={(row) => row.key}>
            {renderRow}
          </List.ForEach>
        </Section>
      </List>
    </Host>
  );
}

const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" });
const detailFont = font({ textStyle: "subheadline" });

function WorkspaceRowView({
  row,
  onOpen,
}: {
  row: WorkspaceRow;
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const colors = useColors();
  const { workspace, connection } = row;
  const connected = connection === "connected";

  return (
    <Button onPress={() => onOpen?.(row)} modifiers={[disabled(!onOpen)]}>
      {/* A Button in a List tints its label. The row reads as text, so it starts from the text color. */}
      <HStack spacing={10} modifiers={[foregroundStyle({ type: "color", color: colors.text })]}>
        <VStack alignment="leading" spacing={2}>
          <HStack spacing={0} alignment="firstTextBaseline">
            <SwiftText
              modifiers={[
                font({ textStyle: "headline" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: connected ? "primary" : "secondary",
                }),
                lineLimit(1),
              ]}
            >
              {workspace.name}
            </SwiftText>
            <Spacer minLength={8} />
            <SwiftText modifiers={[detailFont, secondary, lineLimit(1), fixedSize()]}>
              {row.machineName}
            </SwiftText>
          </HStack>
          <HStack spacing={0}>
            <SwiftText modifiers={[detailFont, secondary, lineLimit(1)]}>
              {connection === "connected" ? workspace.directory : rowStateText(connection)}
            </SwiftText>
            <Spacer minLength={8} />
            {connected && workspace.branch !== undefined && (
              <HStack spacing={3} modifiers={[fixedSize()]}>
                <Image
                  systemName="arrow.triangle.branch"
                  modifiers={[font({ textStyle: "caption" }), secondary]}
                />
                <SwiftText modifiers={[detailFont, secondary, lineLimit(1)]}>
                  {workspace.branch}
                </SwiftText>
              </HStack>
            )}
          </HStack>
        </VStack>
        <Image
          systemName="chevron.forward"
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            foregroundStyle({ type: "hierarchical", style: "tertiary" }),
          ]}
        />
      </HStack>
    </Button>
  );
}

function EmptyState({
  view,
  actions,
}: {
  view: Exclude<HomeView, { kind: "workspaces" }>;
  actions: HomeActions;
}) {
  const colors = useColors();
  switch (view.kind) {
    case "loading":
      return (
        <Centered extraBottom={60}>
          <VStack spacing={8} modifiers={[secondary]}>
            <ProgressView />
            <SwiftText modifiers={[textCase("uppercase"), font({ textStyle: "caption" })]}>
              {text.loading}
            </SwiftText>
          </VStack>
        </Centered>
      );

    case "no-machines": {
      const [before, command, after] = text.noMachinesBody;
      return (
        <Centered>
          <StateIcon systemName="desktopcomputer" />
          <StateTitle>{text.noMachines}</StateTitle>
          <StateBody>
            {before}
            {commandText(command, colors.text)}
            {after}
          </StateBody>
          <VStack spacing={10} modifiers={[padding({ top: 20 })]}>
            <ActionButton label={text.scanQrCode} onPress={actions.onScanQrCode} prominent />
            <ActionButton
              label={text.pasteInvitationLink}
              onPress={actions.onPasteInvitationLink}
            />
            <Button
              onPress={actions.onGetDesktop}
              modifiers={[buttonStyle("borderless"), frame({ height: ACTION_HEIGHT })]}
            >
              <SwiftText modifiers={[font({ textStyle: "subheadline" })]}>
                {text.getDesktop}
              </SwiftText>
            </Button>
          </VStack>
        </Centered>
      );
    }

    case "no-workspaces":
      return (
        <Centered>
          <StateIcon systemName="square.stack" />
          <StateTitle>{text.noWorkspaces}</StateTitle>
          <StateBody>{text.noWorkspacesBody}</StateBody>
        </Centered>
      );

    case "no-results":
      return (
        <Centered>
          <StateIcon systemName="magnifyingglass" />
          <StateTitle>{text.noResultsTitle(view.query)}</StateTitle>
          <StateBody>{text.noResultsBody}</StateBody>
        </Centered>
      );

    case "unreachable": {
      const { title, body } = unreachableText(view.state, view.machine?.name ?? null);
      const machine = view.machine;
      const onMachineSettings = machine
        ? actions.onMachineSettings && (() => actions.onMachineSettings?.(machine.id))
        : actions.onOpenSettings;
      const reconnecting = view.state === "reconnecting";

      return (
        <Centered>
          {reconnecting ? (
            <ProgressView modifiers={[controlSize("large"), secondary, padding({ bottom: 16 })]} />
          ) : (
            <StateIcon systemName="desktopcomputer.trianglebadge.exclamationmark" />
          )}
          <StateTitle>{title}</StateTitle>
          {body !== undefined && <StateBody>{body}</StateBody>}
          <VStack spacing={10} modifiers={[padding({ top: reconnecting ? 24 : 20 })]}>
            {!reconnecting && (
              <ActionButton label={text.tryAgain} onPress={actions.onTryAgain} prominent />
            )}
            <ActionButton label={text.machineSettings} onPress={onMachineSettings} />
          </VStack>
        </Centered>
      );
    }
  }
}

/** Fills the screen and centers its content above the bottom toolbar. */
function Centered({
  children,
  extraBottom = 0,
}: {
  children: React.ReactNode;
  extraBottom?: number;
}) {
  return (
    <VStack
      spacing={0}
      modifiers={[
        padding({ leading: 40, trailing: 40, bottom: BOTTOM_INSET + extraBottom }),
        frame({ maxWidth: FILL, maxHeight: FILL }),
      ]}
    >
      {children}
    </VStack>
  );
}

function StateIcon({ systemName }: { systemName: ComponentProps<typeof Image>["systemName"] }) {
  return (
    <Image
      systemName={systemName}
      modifiers={[font({ size: 48 }), secondary, padding({ bottom: 14 })]}
    />
  );
}

function StateTitle({ children }: { children: string }) {
  return (
    <SwiftText
      modifiers={[font({ textStyle: "title2", weight: "bold" }), multilineTextAlignment("center")]}
    >
      {children}
    </SwiftText>
  );
}

function StateBody({ children }: { children: React.ReactNode }) {
  return (
    <SwiftText
      modifiers={[
        font({ textStyle: "callout" }),
        secondary,
        multilineTextAlignment("center"),
        padding({ top: 6 }),
      ]}
    >
      {children}
    </SwiftText>
  );
}

/**
 * A command inside a sentence, in the monospaced system font and the text color. A plain function,
 * not a component: a nested Text renders only when the element passed in is a Text itself.
 */
function commandText(command: string, color: ColorValue) {
  return (
    <SwiftText
      modifiers={[
        font({ textStyle: "subheadline", design: "monospaced" }),
        foregroundStyle({ type: "color", color }),
      ]}
    >
      {command}
    </SwiftText>
  );
}

/** A capsule button of an empty state: filled blue when prominent, gray otherwise. */
function ActionButton({
  label,
  onPress,
  prominent = false,
}: {
  label: string;
  onPress: (() => void) | undefined;
  prominent?: boolean;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle(prominent ? "borderedProminent" : "bordered"),
        buttonBorderShape("capsule"),
        frame({ width: ACTION_WIDTH }),
        disabled(!onPress),
      ]}
    >
      <SwiftText
        modifiers={[
          font({ weight: "semibold", textStyle: "subheadline" }),
          frame({ maxWidth: FILL, minHeight: ACTION_HEIGHT - 14 }),
        ]}
      >
        {label}
      </SwiftText>
    </Button>
  );
}
