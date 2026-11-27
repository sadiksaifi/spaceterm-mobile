import { Host } from "@expo/ui";
import { ScrollView, VStack, ZStack } from "@expo/ui/swift-ui";
import { frame, ignoreSafeArea, padding, scrollEdgeEffectStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import { PlatformColor, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RowAlertsView } from "@/features/home/components/ios/row-alerts";
import { Unreachable } from "@/features/home/components/ios/states/unreachable";

import { moves } from "./grid";
import { splitOf } from "./layout";
import type { WorkspaceScreenProps } from "./props";
import { CardGrid } from "./components/ios/card-grid";
import { PanesSheet } from "./components/ios/panes-sheet";
import { TabAlertsView } from "./components/ios/tab-alerts";
import { BAR_HEIGHT, menuItem, WorkspaceBar } from "./components/ios/workspace-bar";
import { WorkspacesSheet } from "./components/ios/workspaces-sheet";
import type ScreenContract from "./screen";
import { text } from "./text";
import { useBarSwipe } from "./use-bar-swipe";

/** The bar's bottom edge sits this far into the bottom safe area, as the mockups place it. */
const INTO_SAFE_AREA = 6;
const MIN_BOTTOM = 16;

export default function WorkspaceScreen(props: WorkspaceScreenProps) {
  const { view, rows, row, commands, alerts } = props;
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  const bottom = Math.max(insets.bottom - INTO_SAFE_AREA, MIN_BOTTOM);
  const swipe = useBarSwipe(rows, row.key, props.onSwitch, bottom + BAR_HEIGHT);
  const barTop = useWindowDimensions().height - bottom - BAR_HEIGHT;
  const connected = view.kind === "tabs";
  const panes = connected ? commands.panes : null;

  // A system alert shows over the topmost view: an open sheet, else the screen.
  const alertsView = (children: ReactNode) => (
    <RowAlertsView alerts={alerts}>
      <TabAlertsView commands={commands}>{children}</TabAlertsView>
    </RowAlertsView>
  );
  const onScreen = !sheet && panes === null;

  const content = connected ? (
    // A hard edge under the header: the soft one barely covers it over a SwiftUI scroll view,
    // so a card scrolled under it would cross the title.
    <ScrollView modifiers={[scrollEdgeEffectStyle("hard", "top")]}>
      <VStack modifiers={[padding({ top: 2, bottom: bottom + BAR_HEIGHT + 24 })]}>
        <CardGrid
          screens={props.screens}
          cards={commands.grid.tabs.map((tab) => {
            const move = moves(commands.grid, tab);
            return {
              key: tab.id,
              name: tab.name,
              split: splitOf(tab.panes),
              onPress: () => commands.openTab(tab),
              closeLabel: text.closeTab,
              onClose: () => commands.closeTab(tab),
              menu: (
                <>
                  {menuItem(text.newTab, "plus.square.on.square", { onPress: commands.newTab })}
                  {menuItem(text.moveTabLeft, "arrow.left", {
                    onPress: move.left ? () => commands.moveTab(tab, -1) : undefined,
                  })}
                  {menuItem(text.moveTabRight, "arrow.right", {
                    onPress: move.right ? () => commands.moveTab(tab, 1) : undefined,
                  })}
                  {menuItem(
                    text.closeTab,
                    "xmark",
                    { onPress: () => commands.closeTab(tab) },
                    true,
                  )}
                </>
              ),
            };
          })}
          addLabel={text.newTab}
          onAdd={commands.newTab}
        />
      </VStack>
    </ScrollView>
  ) : (
    <Unreachable
      view={{ kind: "unreachable", state: view.state, machine: view.machine }}
      actions={{
        onTryAgain: props.onTryAgain,
        onMachineSettings: props.onMachineSettings,
        onGetDesktop: () => {},
      }}
    />
  );

  const body = (
    // The grid starts below the header and scrolls under it; the bar sits in the bottom safe area.
    <ZStack
      alignment="bottom"
      modifiers={[frame({ maxWidth: FILL, maxHeight: FILL }), ignoreSafeArea({ edges: "bottom" })]}
    >
      {content}
      <VStack modifiers={[padding({ bottom })]}>
        <WorkspaceBar
          rows={rows}
          selected={row.key}
          alerts={alerts}
          onSwitch={props.onSwitch}
          onWorkspaces={() => setSheet(true)}
          onNewWorkspace={props.onNewWorkspace}
        />
      </VStack>
      <WorkspacesSheet
        open={sheet}
        onClose={() => setSheet(false)}
        rows={rows}
        selected={row.key}
        alerts={alerts}
        alertsView={(children) => (sheet ? alertsView(children) : children)}
        onSwitch={props.onSwitch}
        onNewWorkspace={props.onNewWorkspace}
      />
      <PanesSheet
        screens={props.screens}
        tab={panes}
        commands={commands}
        alertsView={(children) => (panes !== null && !sheet ? alertsView(children) : children)}
      />
    </ZStack>
  );

  return (
    <>
      {/* The title names the screen for VoiceOver and the next screen's back button. The swipe
          back starts above the bar only, so a swipe to the right on the bar changes Workspace. */}
      <Stack.Screen
        options={{ title: view.workspace.name, gestureResponseDistance: { bottom: barTop } }}
      />
      <Stack.Screen.Title asChild>
        <View style={styles.title} accessible accessibilityRole="header">
          <Text numberOfLines={1} style={styles.name}>
            {view.workspace.name}
          </Text>
          <Text numberOfLines={1} style={styles.machine}>
            {view.machine.name}
          </Text>
        </View>
      </Stack.Screen.Title>
      <WorkspaceMenu {...props} />
      <View style={styles.fill} {...swipe}>
        <Host style={styles.fill}>{onScreen ? alertsView(body) : body}</Host>
      </View>
    </>
  );
}

/**
 * The Workspace menu: its Worktrees with the active one checked and New Worktree, in a
 * repository, then Rename Workspace and Kill Workspace.
 */
function WorkspaceMenu({ view, row, commands, alerts, onNewWorktree }: WorkspaceScreenProps) {
  const connected = view.kind === "tabs";
  const worktrees = connected ? commands.grid.worktrees : [];
  const available = connected && alerts.underway.get(row.key) === undefined;
  const { onRenameWorkspace, onKillWorkspace } = alerts.handlers;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={text.more}>
        {view.workspace.repository !== null && (
          <Stack.Toolbar.Menu inline title={text.worktree}>
            {worktrees.map(({ worktree, active }) => (
              <Stack.Toolbar.MenuAction
                key={worktree.path}
                isOn={active}
                disabled={!connected}
                onPress={() => commands.pickWorktree(worktree)}
              >
                {worktree.name}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        )}
        <Stack.Toolbar.Menu inline>
          {view.workspace.repository !== null && (
            <Stack.Toolbar.MenuAction icon="plus" disabled={!onNewWorktree} onPress={onNewWorktree}>
              {text.newWorktree}
            </Stack.Toolbar.MenuAction>
          )}
          <Stack.Toolbar.MenuAction
            icon="pencil"
            disabled={!available || !onRenameWorkspace}
            onPress={() => onRenameWorkspace?.(row)}
          >
            {text.renameWorkspace}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.MenuAction
          icon="xmark"
          destructive
          disabled={!available || !onKillWorkspace}
          onPress={() => onKillWorkspace?.(row)}
        >
          {text.killWorkspace}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  title: { alignItems: "center", maxWidth: 240 },
  name: { fontSize: 17, fontWeight: "600", color: PlatformColor("label") },
  machine: { fontSize: 13, color: PlatformColor("secondaryLabel") },
});

WorkspaceScreen satisfies typeof ScreenContract;
