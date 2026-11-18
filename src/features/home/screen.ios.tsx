import { Host } from "@expo/ui";
import {
  Button,
  ContentUnavailableView,
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
import { useCallback, useState } from "react";

import { useColors } from "@/theme/colors";

import { homeView, isSearchable, type HomeView, type WorkspaceRow } from "./model";
import type { HomeActions, HomeScreenProps } from "./props";
import { rowStateText, text, unreachableText } from "./text";

/** Two stacked buttons in an empty state share this width. */
const ACTION_WIDTH = 230;

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
            placeholder={text.searchWorkspaces}
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
  const { workspace, connection } = row;
  const connected = connection === "connected";

  return (
    <Button onPress={() => onOpen?.(row)} modifiers={[disabled(!onOpen)]}>
      <HStack spacing={10}>
        <VStack alignment="leading" spacing={2}>
          <HStack spacing={8} alignment="firstTextBaseline">
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
            <Spacer />
            <SwiftText modifiers={[detailFont, secondary, lineLimit(1)]}>
              {row.machineName}
            </SwiftText>
          </HStack>
          <HStack spacing={8}>
            <SwiftText modifiers={[detailFont, secondary, lineLimit(1)]}>
              {connection === "connected" ? workspace.directory : rowStateText(connection)}
            </SwiftText>
            <Spacer />
            {connected && workspace.branch !== undefined && (
              <HStack spacing={3}>
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
  switch (view.kind) {
    case "loading":
      return (
        <ProgressView>
          <SwiftText modifiers={[textCase("uppercase"), font({ textStyle: "caption" })]}>
            {text.loading}
          </SwiftText>
        </ProgressView>
      );

    case "no-machines":
      return (
        <ContentUnavailableView
          title={text.noMachines}
          systemImage="desktopcomputer"
          description={text.noMachinesBody.join("")}
          actions={
            <VStack spacing={10}>
              <ActionButton label={text.scanQrCode} onPress={actions.onScanQrCode} prominent />
              <ActionButton
                label={text.pasteInvitationLink}
                onPress={actions.onPasteInvitationLink}
              />
              <Button
                label={text.getDesktop}
                onPress={actions.onGetDesktop}
                modifiers={[buttonStyle("borderless"), padding({ top: 4 })]}
              />
            </VStack>
          }
        />
      );

    case "no-workspaces":
      return (
        <ContentUnavailableView
          title={text.noWorkspaces}
          systemImage="square.stack"
          description={text.noWorkspacesBody}
        />
      );

    case "no-results":
      return (
        <ContentUnavailableView
          title={text.noResultsTitle(view.query)}
          systemImage="magnifyingglass"
          description={text.noResultsBody}
        />
      );

    case "unreachable": {
      const { title, body } = unreachableText(view.state, view.machine?.name ?? null);
      const machine = view.machine;
      const onMachineSettings = machine
        ? actions.onMachineSettings && (() => actions.onMachineSettings?.(machine.id))
        : actions.onOpenSettings;
      const machineSettings = (
        <ActionButton label={text.machineSettings} onPress={onMachineSettings} />
      );

      if (view.state === "reconnecting") {
        return (
          <VStack spacing={14} modifiers={[padding({ horizontal: 40 })]}>
            <ProgressView modifiers={[controlSize("large")]} />
            <SwiftText
              modifiers={[
                font({ textStyle: "title2", weight: "bold" }),
                multilineTextAlignment("center"),
              ]}
            >
              {title}
            </SwiftText>
            {machineSettings}
          </VStack>
        );
      }

      return (
        <ContentUnavailableView
          title={title}
          systemImage="desktopcomputer.trianglebadge.exclamationmark"
          description={body}
          actions={
            <VStack spacing={10}>
              <ActionButton label={text.tryAgain} onPress={actions.onTryAgain} prominent />
              {machineSettings}
            </VStack>
          }
        />
      );
    }
  }
}

/** A capsule button of the system empty state: filled blue when prominent, gray otherwise. */
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
        disabled(!onPress),
      ]}
    >
      <SwiftText
        modifiers={[
          font({ weight: "semibold", textStyle: "subheadline" }),
          frame({ maxWidth: ACTION_WIDTH }),
        ]}
      >
        {label}
      </SwiftText>
    </Button>
  );
}
