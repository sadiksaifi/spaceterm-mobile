import { Host } from "@expo/ui";
import { ScrollView, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  frame,
  ignoreSafeArea,
  padding,
  scrollEdgeEffectStyle,
  useScrollGeometryChange,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RowAlertsView } from "@/features/home/components/ios/row-alerts";
import { Unreachable } from "@/features/home/components/ios/states/unreachable";
import { NavigationSubtitle } from "@/modules/navigation-subtitle";

import { moves } from "./grid";
import { splitOf } from "./layout";
import type { WorkspaceScreenProps } from "./props";
import { CardGrid } from "./components/ios/card-grid";
import { PanesSheet } from "./components/ios/panes-sheet";
import { RemovalAlertsView } from "./components/ios/removal-alerts";
import { TabAlertsView } from "./components/ios/tab-alerts";
import { BAR_HEIGHT, menuItem, WorkspaceBar } from "./components/ios/workspace-bar";
import { WorkspacesSheet } from "./components/ios/workspaces-sheet";
import type ScreenContract from "./screen";
import { text } from "./text";
import { headerBranch, worktreeMenu } from "./worktree-menu";

/** The bar's bottom edge sits this far into the bottom safe area, as the mockups place it. */
const INTO_SAFE_AREA = 6;
const MIN_BOTTOM = 16;

export default function WorkspaceScreen(props: WorkspaceScreenProps) {
  const { view, rows, row, commands, alerts } = props;
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  const scroll = useScrolled();
  const bottom = Math.max(insets.bottom - INTO_SAFE_AREA, MIN_BOTTOM);
  const window = useWindowDimensions();
  const barTop = window.height - bottom - BAR_HEIGHT;
  const connected = view.kind === "tabs";
  const panes = connected ? commands.panes : null;
  const worktree = worktreeMenu(props);

  // A system alert shows over the topmost view: an open sheet, else the screen. Each view always
  // carries the alerts, so a sheet that closes leaves every view in place.
  const alertsView = (active: boolean) => (children: ReactNode) => (
    <RowAlertsView alerts={alerts} active={active}>
      <TabAlertsView commands={commands} active={active}>
        <RemovalAlertsView removal={props.removal} machine={row.machineName} active={active}>
          {children}
        </RemovalAlertsView>
      </TabAlertsView>
    </RowAlertsView>
  );
  const onScreen = !sheet && panes === null;

  const content = connected ? (
    // A hard edge under the header once the grid scrolls: the soft one barely covers it over a
    // SwiftUI scroll view, so a card scrolled under it would cross the title. At rest the hard
    // edge would draw a band and a line over nothing.
    <ScrollView
      modifiers={[
        ...(scroll.modifier ? [scroll.modifier] : []),
        scrollEdgeEffectStyle(scroll.scrolled ? "hard" : "soft", "top"),
      ]}
    >
      <VStack modifiers={[padding({ top: 10, bottom: bottom + BAR_HEIGHT + 24 })]}>
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
      <WorkspaceBar
        rows={rows}
        selected={row.key}
        alerts={alerts}
        bottom={bottom}
        worktree={worktree}
        onSwitch={props.onSwitch}
        onWorkspaces={() => setSheet(true)}
      >
        {content}
      </WorkspaceBar>
      <WorkspacesSheet
        open={sheet}
        onClose={() => setSheet(false)}
        rows={rows}
        selected={row.key}
        alerts={alerts}
        alertsView={alertsView(sheet)}
        onSwitch={props.onSwitch}
        onNewWorkspace={props.onNewWorkspace}
      />
      <PanesSheet
        screens={props.screens}
        tab={panes}
        commands={commands}
        alertsView={alertsView(panes !== null && !sheet)}
      />
    </ZStack>
  );

  return (
    <>
      {/* The swipe back starts above the bar only, so a swipe on the bar stays there. */}
      <Stack.Screen
        options={{
          title: view.workspace.name,
          gestureResponseDistance: { bottom: barTop },
        }}
      />
      {/* The branch under the Workspace's name; the bar's Worktree button changes it. */}
      <NavigationSubtitle text={headerBranch(view, worktree)} />
      <WorkspaceMenu {...props} />
      <Host style={styles.fill}>{alertsView(onScreen)(body)}</Host>
    </>
  );
}

/** The Workspace menu: Rename Workspace and Kill Workspace. The Worktrees have their own menu. */
function WorkspaceMenu({ view, row, alerts }: WorkspaceScreenProps) {
  const connected = view.kind === "tabs";
  const available = connected && alerts.underway.get(row.key) === undefined;
  const { onRenameWorkspace, onKillWorkspace } = alerts.handlers;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={text.more}>
        <Stack.Toolbar.MenuAction
          icon="pencil"
          disabled={!available || !onRenameWorkspace}
          onPress={() => onRenameWorkspace?.(row)}
        >
          {text.renameWorkspace}
        </Stack.Toolbar.MenuAction>
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

/** Whether a scroll view has scrolled from where it first rested, with the modifier that tells. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  const rest = useRef<number | null>(null);
  const modifier = useScrollGeometryChange(({ contentOffsetY }) => {
    rest.current ??= contentOffsetY;
    setScrolled(contentOffsetY > rest.current + 1);
  });
  return { scrolled, modifier };
}

/** Lets a frame take all the space its container offers, like SwiftUI's `.infinity`. */
const FILL = Number.POSITIVE_INFINITY;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

WorkspaceScreen satisfies typeof ScreenContract;
