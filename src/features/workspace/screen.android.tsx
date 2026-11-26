import backIcon from "@expo/material-symbols/arrow_back.xml";
import moreIcon from "@expo/material-symbols/more_vert.xml";
import checkIcon from "@expo/material-symbols/check.xml";
import {
  Box,
  Column,
  HorizontalDivider,
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
import { heading } from "@/modules/compose-modifiers";
import { useColors } from "@/shared/theme/colors";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";

import { CardGrid } from "./components/android/card-grid";
import { PanesSheet } from "./components/android/panes-sheet";
import { TabDialogs } from "./components/android/tab-dialogs";
import { BAR_HEIGHT, WorkspaceBar } from "./components/android/workspace-bar";
import { WorkspacesSheet } from "./components/android/workspaces-sheet";
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
          <SnackbarSlot {...snackbar} bottom={bottom + BAR_HEIGHT + 8} />
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
            />
          )}
          {connected && commands.panes && <PanesSheet tab={commands.panes} commands={commands} />}
          <TabDialogs commands={commands} />
          <RowAlertsView alerts={alerts} />
        </Box>
      </ScreenHost>
    </>
  );
}

function isRowFailure(failure: TabFailure | RowFailure): failure is RowFailure {
  return "row" in failure;
}

/** Back, the Workspace name over its Machine, and the Workspace menu. */
function Header(props: WorkspaceScreenProps) {
  const colors = useColors();
  const { view } = props;
  return (
    <TopAppBar colors={{ containerColor: colors.background }}>
      <TopAppBar.NavigationIcon>
        <IconButton onClick={props.onBack}>
          <Icon source={backIcon} contentDescription={text.back} />
        </IconButton>
      </TopAppBar.NavigationIcon>
      <TopAppBar.Title>
        <Column>
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "titleLarge" }}
            modifiers={[heading()]}
          >
            {view.workspace.name}
          </Text>
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "bodyMedium" }}
            color={colors.secondaryText}
          >
            {view.machine.name}
          </Text>
        </Column>
      </TopAppBar.Title>
      <TopAppBar.Actions>
        <WorkspaceMenu {...props} />
      </TopAppBar.Actions>
    </TopAppBar>
  );
}

/**
 * The Workspace menu under More options: its Worktrees with the active one filled and New
 * Worktree, in a repository, then Rename Workspace and Kill Workspace. No item is red.
 */
function WorkspaceMenu({ view, row, commands, alerts, onNewWorktree }: WorkspaceScreenProps) {
  const [expanded, setExpanded] = useState(false);
  const material = useMaterialColors();
  const colors = useColors();
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
  const inRepository = view.workspace.repository !== null;

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
        {inRepository && (
          <Text
            style={{ typography: "titleSmall" }}
            color={colors.secondaryText}
            modifiers={[padding(16, 12, 16, 8), heading()]}
          >
            {text.worktree}
          </Text>
        )}
        {inRepository &&
          commands.grid.worktrees.map(({ worktree, active }) => (
            <DropdownMenuItem
              key={worktree.path}
              enabled={connected}
              modifiers={[
                defaultMinSize({ minWidth: MENU_WIDTH }),
                padding(8, 0, 8, 0),
                ...(active ? [background(material.primaryContainer)] : []),
              ]}
              onClick={() => {
                setExpanded(false);
                commands.pickWorktree(worktree);
              }}
            >
              {active && (
                <DropdownMenuItem.LeadingIcon>
                  <Icon source={checkIcon} tint={material.onPrimaryContainer} />
                </DropdownMenuItem.LeadingIcon>
              )}
              <DropdownMenuItem.Text>
                <Text color={active ? material.onPrimaryContainer : undefined}>
                  {worktree.name}
                </Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        {inRepository && item(text.newWorktree, { onPress: onNewWorktree })}
        {inRepository && <HorizontalDivider />}
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
