import { Host } from "@expo/ui";
import { ScrollView, Spacer, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  frame,
  ignoreSafeArea,
  padding,
  scrollEdgeEffectStyle,
  useScrollGeometryChange,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { PlatformColor, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { HomeActions } from "@/features/home/actions";
import { RowAlertsView } from "@/features/home/components/ios/row-alerts";
import { Unreachable } from "@/features/home/components/ios/states/unreachable";
import type { Tab } from "@/shared/machines/model";

import { moves } from "./grid";
import { splitOf } from "./layout";
import type { WorkspaceView } from "./model";
import type { WorkspaceScreenProps } from "./props";
import type { Screens } from "./use-pane-previews";
import { CardGrid, type Card } from "./components/ios/card-grid";
import { PanesSheet } from "./components/ios/panes-sheet";
import { TabAlertsView } from "./components/ios/tab-alerts";
import { BAR_HEIGHT, menuItem, WorkspaceBar } from "./components/ios/workspace-bar";
import { WorkspacesSheet } from "./components/ios/workspaces-sheet";
import type ScreenContract from "./screen";
import { text } from "./text";

/** The bar's bottom edge sits this far into the bottom safe area, as the mockups place it. */
const INTO_SAFE_AREA = 6;
const MIN_BOTTOM = 16;
/** Width the header keeps beside the names for its margins and the menu button. */
const TITLE_ROOM = 120;

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

  // A system alert shows over the topmost view: an open sheet, else the screen. Each view always
  // carries the alerts, so a sheet that closes leaves every view in place.
  const alertsView = (active: boolean) => (children: ReactNode) => (
    <RowAlertsView alerts={alerts} active={active}>
      <TabAlertsView commands={commands} active={active}>
        {children}
      </TabAlertsView>
    </RowAlertsView>
  );
  const onScreen = !sheet && panes === null;

  const cards: Card[] = connected
    ? commands.grid.tabs.map((tab) => {
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
              {menuItem(text.closeTab, "xmark", { onPress: () => commands.closeTab(tab) }, true)}
            </>
          ),
        };
      })
    : [];
  const page = (
    <Page
      key={row.key}
      view={view}
      cards={cards}
      screens={props.screens}
      onAdd={commands.newTab}
      actions={{
        onTryAgain: props.onTryAgain,
        onMachineSettings: props.onMachineSettings,
        onGetDesktop: () => {},
      }}
      bottom={bottom}
      scroll={scroll}
    />
  );
  // Each Workspace of the bar has a page under it, which a drag of the bar slides in. One that
  // is not in the bar, as one whose Machine dropped its list, shows alone.
  const paged = props.pages.some((each) => each.key === row.key);
  const bar = (pages?: ReactNode) => (
    <WorkspaceBar
      rows={rows}
      selected={row.key}
      alerts={alerts}
      bottom={bottom}
      onBack={props.onBack}
      onSwitch={props.onSwitch}
      onWorkspaces={() => setSheet(true)}
    >
      {pages}
    </WorkspaceBar>
  );

  const body = (
    // The grid starts below the header and scrolls under it; the bar sits in the bottom safe area.
    <ZStack
      alignment="bottom"
      modifiers={[frame({ maxWidth: FILL, maxHeight: FILL }), ignoreSafeArea({ edges: "bottom" })]}
    >
      {paged ? (
        bar(
          props.pages.map((each) =>
            each.key === row.key ? (
              page
            ) : (
              <Page
                key={each.key}
                view={each.view}
                cards={each.tabs.map(sideCard)}
                screens={each.screens}
                onAdd={NOTHING}
                actions={SIDE_ACTIONS}
                bottom={bottom}
                scroll={null}
              />
            ),
          ),
        )
      ) : (
        <>
          {page}
          {bar()}
        </>
      )}
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
      {/* Back sits in the bar, so the names take its place at the top left and the middle stays
          empty. The swipe back starts above the bar only, so a swipe on the bar stays there. */}
      <Stack.Screen
        options={{
          title: view.workspace.name,
          headerTitle: "",
          gestureResponseDistance: { bottom: barTop },
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <View
            style={[styles.title, { maxWidth: window.width - TITLE_ROOM }]}
            accessible
            accessibilityRole="header"
          >
            <Text numberOfLines={1} style={styles.name}>
              {view.workspace.name}
            </Text>
            <Text numberOfLines={1} style={styles.machine}>
              {view.machine.name}
            </Text>
          </View>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <WorkspaceMenu {...props} />
      <Host style={styles.fill}>{alertsView(onScreen)(body)}</Host>
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

/**
 * A Workspace's page: its grid, or its Machine's state while it is not connected. Every page has
 * the same parts, so the page a drag brings in stays in place as it takes over the screen.
 */
function Page({
  view,
  cards,
  screens,
  onAdd,
  actions,
  bottom,
  scroll,
}: {
  view: WorkspaceView;
  cards: readonly Card[];
  screens: Screens;
  onAdd: (() => void) | undefined;
  actions: HomeActions;
  bottom: number;
  /** The page on screen's, which tells the header whether the grid scrolled. */
  scroll: Scrolled | null;
}) {
  if (view.kind === "gone") return <Spacer />;
  if (view.kind === "unreachable") {
    return (
      <Unreachable
        view={{ kind: "unreachable", state: view.state, machine: view.machine }}
        actions={actions}
      />
    );
  }
  return (
    // A hard edge under the header once the grid scrolls: the soft one barely covers it over a
    // SwiftUI scroll view, so a card scrolled under it would cross the title. At rest the hard
    // edge would draw a band and a line over nothing.
    <ScrollView
      modifiers={[
        ...(scroll?.modifier ? [scroll.modifier] : []),
        scrollEdgeEffectStyle(scroll?.scrolled ? "hard" : "soft", "top"),
      ]}
    >
      <VStack modifiers={[padding({ top: 10, bottom: bottom + BAR_HEIGHT + 24 })]}>
        <CardGrid cards={cards} screens={screens} addLabel={text.newTab} onAdd={onAdd} />
      </VStack>
    </ScrollView>
  );
}

/** A card of a page beside the one on screen, which shows only while it slides past. */
function sideCard(tab: Tab): Card {
  return {
    key: tab.id,
    name: tab.name,
    split: splitOf(tab.panes),
    onPress: NOTHING,
    closeLabel: text.closeTab,
    onClose: NOTHING,
    menu: null,
  };
}

const NOTHING = () => {};
const SIDE_ACTIONS: HomeActions = {
  onTryAgain: NOTHING,
  onMachineSettings: NOTHING,
  onGetDesktop: NOTHING,
};

type Scrolled = ReturnType<typeof useScrolled>;

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
  title: { alignItems: "flex-start" },
  name: { fontSize: 17, fontWeight: "600", color: PlatformColor("label") },
  machine: { fontSize: 13, color: PlatformColor("secondaryLabel") },
});

WorkspaceScreen satisfies typeof ScreenContract;
