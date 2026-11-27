import backIcon from "@expo/material-symbols/arrow_back.xml";
import moreIcon from "@expo/material-symbols/more_vert.xml";
import {
  Box,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  Text,
  TopAppBar,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Control } from "@/features/home/actions";
import { RowAlertsView } from "@/features/home/components/android/row-alerts";
import { Unreachable } from "@/features/home/components/android/states/unreachable";
import type { RowFailure } from "@/features/home/row-alerts";
import { text as homeText } from "@/features/home/text";
import { useColors } from "@/shared/theme/colors";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";

import { CardGrid } from "./components/android/card-grid";
import { PanesSheet } from "./components/android/panes-sheet";
import { RemovalDialogs } from "./components/android/removal-dialogs";
import { TabDialogs } from "./components/android/tab-dialogs";
import { BAR_HEIGHT, WorkspaceBar } from "./components/android/workspace-bar";
import { WorkspacesSheet } from "./components/android/workspaces-sheet";
import { WorkspaceTitle } from "./components/android/workspace-title";
import { moves } from "./grid";
import { splitOf } from "./layout";
import type { WorkspaceScreenProps } from "./props";
import type ScreenContract from "./screen";
import { failureText, text } from "./text";
import type { TabFailure } from "./use-tab-commands";

/** The bar sits this far above the gesture area. */
const BAR_MARGIN = 16;
const MENU_CORNER = 16;
const MENU_ELEVATION = 3;
const MENU_WIDTH = 220;

export default function WorkspaceScreen(props: WorkspaceScreenProps) {
  const { view, rows, row, commands, alerts } = props;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  const bottom = insets.bottom + BAR_MARGIN;
  const connected = view.kind === "tabs";
  const panes = connected ? commands.panes : null;

  // Android reports a refused command in a snackbar above the bar, which leaves the grid usable.
  const failure: TabFailure | RowFailure | null = commands.failure ?? alerts.failure;
  const snackbar = useSnackbar(
    failure,
    (shown) => ({
      message: isRowFailure(shown)
        ? homeText.failedTitle(shown.command, shown.row.workspace.name)
        : failureText(shown),
      actionLabel: text.tryAgain,
    }),
    (shown) => (isRowFailure(shown) ? alerts.retry(shown) : commands.retry(shown)),
    (shown) =>
      isRowFailure(shown) ? alerts.dismissFailure(shown) : commands.dismissFailure(shown),
  );

  return (
    <>
      {/* Compose draws the top app bar. */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Box modifiers={[fillMaxSize(), background(colors.background)]}>
          <Column modifiers={[fillMaxSize()]}>
            <Header {...props} />
            {connected ? (
              <Column
                modifiers={[
                  fillMaxWidth(),
                  weight(1),
                  verticalScroll(),
                  padding(0, 8, 0, bottom + BAR_HEIGHT + 24),
                ]}
              >
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
                      menu: [
                        { label: text.newTab, control: { onPress: commands.newTab } },
                        {
                          label: text.moveTabLeft,
                          control: {
                            onPress: move.left ? () => commands.moveTab(tab, -1) : undefined,
                          },
                        },
                        {
                          label: text.moveTabRight,
                          control: {
                            onPress: move.right ? () => commands.moveTab(tab, 1) : undefined,
                          },
                        },
                        {
                          label: text.closeTab,
                          control: { onPress: () => commands.closeTab(tab) },
                        },
                      ],
                    };
                  })}
                  addLabel={text.newTab}
                  onAdd={commands.newTab}
                />
              </Column>
            ) : (
              <Box modifiers={[fillMaxWidth(), weight(1)]}>
                <Unreachable
                  view={{ kind: "unreachable", state: view.state, machine: view.machine }}
                  actions={{
                    onTryAgain: props.onTryAgain,
                    onMachineSettings: props.onMachineSettings,
                    onGetDesktop: () => {},
                  }}
                  bottom={bottom + BAR_HEIGHT}
                />
              </Box>
            )}
          </Column>
          {!sheet && panes === null && (
            <SnackbarSlot {...snackbar} bottom={bottom + BAR_HEIGHT + 8} />
          )}
          <Box modifiers={[align("bottomCenter"), padding(0, 0, 0, bottom)]}>
            <WorkspaceBar
              rows={rows}
              selected={row.key}
              alerts={alerts}
              onSwitch={props.onSwitch}
              onWorkspaces={() => setSheet(true)}
              onNewWorkspace={props.onNewWorkspace}
            />
          </Box>
          {sheet && (
            <WorkspacesSheet
              onClose={() => setSheet(false)}
              rows={rows}
              selected={row.key}
              alerts={alerts}
              onSwitch={props.onSwitch}
              onNewWorkspace={props.onNewWorkspace}
              snackbar={
                panes === null && <SnackbarSlot {...snackbar} bottom={insets.bottom + 16} />
              }
            />
          )}
          {panes !== null && (
            <PanesSheet
              screens={props.screens}
              tab={panes}
              commands={commands}
              snackbar={<SnackbarSlot {...snackbar} bottom={insets.bottom + 16} />}
            />
          )}
          <TabDialogs commands={commands} />
          <RemovalDialogs removal={props.removal} machine={row.machineName} />
          <RowAlertsView alerts={alerts} />
        </Box>
      </ScreenHost>
    </>
  );
}

function isRowFailure(failure: TabFailure | RowFailure): failure is RowFailure {
  return "row" in failure;
}

/** Back, the Worktree or directory, and the Workspace menu. The bar names the Workspace. */
function Header(props: WorkspaceScreenProps) {
  const colors = useColors();
  const { view, commands } = props;
  return (
    <TopAppBar colors={{ containerColor: colors.background }}>
      <TopAppBar.NavigationIcon>
        <IconButton onClick={props.onBack}>
          <Icon source={backIcon} contentDescription={text.back} />
        </IconButton>
      </TopAppBar.NavigationIcon>
      <TopAppBar.Title>
        <WorkspaceTitle
          directory={view.workspace.directory}
          worktrees={view.workspace.repository === null ? [] : commands.grid.worktrees}
          connected={view.kind === "tabs"}
          onPickWorktree={({ worktree }) => commands.pickWorktree(worktree)}
          onNewWorktree={props.onNewWorktree}
          onRemoveWorktree={props.removal.start}
        />
      </TopAppBar.Title>
      <TopAppBar.Actions>
        <WorkspaceMenu {...props} />
      </TopAppBar.Actions>
    </TopAppBar>
  );
}

/** The Workspace menu under More options: Rename Workspace and Kill Workspace. No item is red. */
function WorkspaceMenu({ view, row, alerts }: WorkspaceScreenProps) {
  const [expanded, setExpanded] = useState(false);
  const material = useMaterialColors();
  const connected = view.kind === "tabs";
  const available = connected && alerts.underway.get(row.key) === undefined;
  const { onRenameWorkspace, onKillWorkspace } = alerts.handlers;
  const item = (label: string, { onPress }: Control) => (
    <DropdownMenuItem
      key={label}
      enabled={!!onPress}
      modifiers={[defaultMinSize({ minWidth: MENU_WIDTH })]}
      onClick={() => {
        setExpanded(false);
        onPress?.();
      }}
    >
      <DropdownMenuItem.Text>
        <Text>{label}</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu
      expanded={expanded}
      onDismissRequest={() => setExpanded(false)}
      color={material.surfaceContainerHigh}
      cornerRadius={MENU_CORNER}
      shadowElevation={MENU_ELEVATION}
    >
      <DropdownMenu.Trigger>
        <IconButton onClick={() => setExpanded(true)}>
          <Icon source={moreIcon} contentDescription={text.more} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {item(text.renameWorkspace, {
          onPress: available && onRenameWorkspace ? () => onRenameWorkspace(row) : undefined,
        })}
        {item(text.killWorkspace, {
          onPress: available && onKillWorkspace ? () => onKillWorkspace(row) : undefined,
        })}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}

WorkspaceScreen satisfies typeof ScreenContract;
