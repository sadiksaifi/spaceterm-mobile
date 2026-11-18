import { Host } from "@expo/ui";
import {
  Button,
  ContentUnavailableView,
  ProgressView,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  frame,
  multilineTextAlignment,
  padding,
  textCase,
} from "@expo/ui/swift-ui/modifiers";
import { SymbolView } from "expo-symbols";
import { Color, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { homeView, isSearchable, type HomeView, type WorkspaceRow } from "./model";
import type { HomeActions, HomeScreenProps } from "./props";
import { rowStateText, text, unreachableText } from "./text";

/** Two stacked buttons in an empty state share this width. */
const ACTION_WIDTH = 230;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const [query, setQuery] = useState("");
  const view = homeView(snapshot, query);

  return (
    <>
      {view.kind === "workspaces" ? (
        <WorkspaceList rows={view.rows} onOpen={actions.onOpenWorkspace} />
      ) : (
        <Host style={styles.page}>
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
            onChangeText={(event) => setQuery(event.nativeEvent.text)}
            onCancelButtonPress={() => setQuery("")}
          />
          <Stack.Toolbar placement="bottom">
            <Stack.Toolbar.SearchBarSlot />
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
  return (
    <ScrollView
      style={styles.page}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.listContent}
      keyboardDismissMode="interactive"
    >
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.key}>
            {index > 0 && <View style={styles.separator} />}
            <WorkspaceRowView row={row} onOpen={onOpen} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

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
    <Pressable
      accessibilityRole="button"
      disabled={!onOpen}
      onPress={() => onOpen?.(row)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <View style={styles.rowLine}>
          <Text numberOfLines={1} style={[styles.name, !connected && styles.secondary]}>
            {workspace.name}
          </Text>
          <Text numberOfLines={1} style={[styles.detail, styles.trailing]}>
            {row.machineName}
          </Text>
        </View>
        {connection !== "connected" ? (
          <Text numberOfLines={1} style={styles.detail}>
            {rowStateText(connection)}
          </Text>
        ) : (
          <View style={styles.detailLine}>
            <Text numberOfLines={1} style={[styles.detail, styles.directory]}>
              {workspace.directory}
            </Text>
            {workspace.branch !== undefined && (
              <View style={styles.branch}>
                <SymbolView
                  name="arrow.triangle.branch"
                  size={12}
                  tintColor={Color.ios.secondaryLabel}
                />
                <Text style={styles.detail}>{workspace.branch}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <SymbolView
        name="chevron.forward"
        size={13}
        weight="semibold"
        tintColor={Color.ios.tertiaryLabel}
      />
    </Pressable>
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Color.ios.systemGroupedBackground,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 26,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: Color.ios.secondarySystemGroupedBackground,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    backgroundColor: Color.ios.separator,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  rowPressed: {
    backgroundColor: Color.ios.systemGray4,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.43,
    color: Color.ios.label,
  },
  secondary: {
    color: Color.ios.secondaryLabel,
  },
  detail: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.23,
    color: Color.ios.secondaryLabel,
  },
  trailing: {
    flexShrink: 0,
    marginLeft: "auto",
  },
  directory: {
    flexShrink: 1,
  },
  branch: {
    flexShrink: 0,
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
});
