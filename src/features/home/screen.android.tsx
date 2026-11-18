import addIcon from "@expo/material-symbols/add.xml";
import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import branchIcon from "@expo/material-symbols/graph_1.xml";
import moreIcon from "@expo/material-symbols/more_vert.xml";
import searchOffIcon from "@expo/material-symbols/search_off.xml";
import workspacesIcon from "@expo/material-symbols/stacks.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  ExtendedFloatingActionButton,
  FilledTonalButton,
  Icon,
  IconButton,
  LazyColumn,
  LoadingIndicator,
  Row,
  Shape,
  Surface,
  Text,
  TextButton,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  alpha,
  background,
  clip,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  semantics,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/theme/colors";
import { SearchBar } from "../../../modules/search-bar";

import { homeView, isSearchable, type HomeView, type WorkspaceRow } from "./model";
import type { HomeActions, HomeScreenProps } from "./props";
import { rowStateText, text, unreachableText } from "./text";

/** Grouped cards: 16 outside corners, 4 inside, 2 between rows. */
const OUTER_CORNER = 16;
const INNER_CORNER = 4;
const ROW_GAP = 2;
/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;
/** Empty states sit above center: clear of New Workspace on the page, just above the keyboard in search. */
const EMPTY_BOTTOM = 120;
const EMPTY_BOTTOM_IN_SEARCH = 40;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const [query, setQuery] = useState("");
  const view = homeView(snapshot);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const searchable = isSearchable(view);
  const canCreateWorkspace = searchable && view.canCreateWorkspace;
  const bottomPadding = insets.bottom + (canCreateWorkspace ? 96 : 16);

  return (
    <>
      {/* The search bar takes the header's place where there is something to search. */}
      <Stack.Screen options={{ headerShown: !searchable, headerShadowVisible: false }} />
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      {!searchable && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon={moreIcon} accessibilityLabel={text.more}>
            <Stack.Toolbar.MenuAction disabled>{text.newWorkspace}</Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              disabled={!actions.onAddMachine}
              onPress={actions.onAddMachine}
            >
              {text.addMachine}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              disabled={!actions.onOpenSettings}
              onPress={actions.onOpenSettings}
            >
              {text.settings}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      <Host style={{ flex: 1 }}>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          {searchable ? (
            <Column modifiers={[fillMaxSize()]}>
              <SearchBar
                onQueryChange={setQuery}
                backLabel={text.back}
                clearLabel={text.clearText}
                modifiers={[fillMaxWidth(), padding(16, insets.top + 4, 16, 0)]}
              >
                <SearchBar.Placeholder>
                  <Text>{text.searchWorkspaces}</Text>
                </SearchBar.Placeholder>
                <SearchBar.TrailingIcon>
                  <MoreMenu actions={actions} canCreateWorkspace={canCreateWorkspace} />
                </SearchBar.TrailingIcon>
                <SearchBar.Results>
                  {/* Results sit above the keyboard. */}
                  <Box modifiers={[fillMaxSize(), imePadding()]}>
                    <HomeContent
                      view={homeView(snapshot, query)}
                      actions={actions}
                      bottomPadding={insets.bottom + 16}
                      emptyBottom={EMPTY_BOTTOM_IN_SEARCH}
                    />
                  </Box>
                </SearchBar.Results>
              </SearchBar>
              <HomeContent view={view} actions={actions} bottomPadding={bottomPadding} />
            </Column>
          ) : (
            <HomeContent view={view} actions={actions} bottomPadding={bottomPadding} />
          )}

          {canCreateWorkspace && actions.onNewWorkspace && (
            <ExtendedFloatingActionButton
              onClick={actions.onNewWorkspace}
              modifiers={[align("bottomEnd"), padding(16, 16, 16, insets.bottom + 16)]}
            >
              <ExtendedFloatingActionButton.Icon>
                <Icon source={addIcon} />
              </ExtendedFloatingActionButton.Icon>
              <ExtendedFloatingActionButton.Text>
                <Text>{text.newWorkspace}</Text>
              </ExtendedFloatingActionButton.Text>
            </ExtendedFloatingActionButton>
          )}
        </Box>
      </Host>
    </>
  );
}

/** The More options button at the end of the search bar, and its menu. */
function MoreMenu({
  actions,
  canCreateWorkspace,
}: {
  actions: HomeActions;
  canCreateWorkspace: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = useMaterialColors();
  const item = (label: string, onPress: (() => void) | undefined) => (
    <DropdownMenuItem
      enabled={!!onPress}
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
      color={colors.surfaceContainerHigh}
      cornerRadius={16}
    >
      <DropdownMenu.Trigger>
        <IconButton onClick={() => setExpanded(true)}>
          <Icon source={moreIcon} contentDescription={text.more} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Items>
        {item(text.newWorkspace, canCreateWorkspace ? actions.onNewWorkspace : undefined)}
        {item(text.addMachine, actions.onAddMachine)}
        {item(text.settings, actions.onOpenSettings)}
      </DropdownMenu.Items>
    </DropdownMenu>
  );
}

function HomeContent({
  view,
  actions,
  bottomPadding,
  emptyBottom = EMPTY_BOTTOM,
}: {
  view: HomeView;
  actions: HomeActions;
  /** Space below the last row. */
  bottomPadding: number;
  /** Space an empty state keeps below itself. */
  emptyBottom?: number;
}) {
  return view.kind === "workspaces" ? (
    <WorkspaceList
      rows={view.rows}
      onOpen={actions.onOpenWorkspace}
      bottomPadding={bottomPadding}
    />
  ) : (
    <EmptyState view={view} actions={actions} bottom={emptyBottom} />
  );
}

function WorkspaceList({
  rows,
  onOpen,
  bottomPadding,
}: {
  rows: readonly WorkspaceRow[];
  onOpen: HomeActions["onOpenWorkspace"];
  bottomPadding: number;
}) {
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: ROW_GAP }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: bottomPadding }}
      modifiers={[fillMaxSize()]}
    >
      {rows.map((row, index) => (
        <WorkspaceRowView
          key={row.key}
          row={row}
          first={index === 0}
          last={index === rows.length - 1}
          onOpen={onOpen}
        />
      ))}
    </LazyColumn>
  );
}

function WorkspaceRowView({
  row,
  first,
  last,
  onOpen,
}: {
  row: WorkspaceRow;
  first: boolean;
  last: boolean;
  onOpen: HomeActions["onOpenWorkspace"];
}) {
  const colors = useColors();
  const { workspace, connection } = row;
  const top = first ? OUTER_CORNER : INNER_CORNER;
  const bottom = last ? OUTER_CORNER : INNER_CORNER;

  return (
    <Surface
      color={colors.groupedRow}
      contentColor={colors.text}
      shape={Shape.RoundedCorner({
        cornerRadii: { topStart: top, topEnd: top, bottomStart: bottom, bottomEnd: bottom },
      })}
      enabled={!!onOpen}
      onClick={() => onOpen?.(row)}
      modifiers={[fillMaxWidth(), ...(connection === "connected" ? [] : [alpha(DIMMED)])]}
    >
      <Column
        verticalArrangement={{ spacedBy: 2 }}
        modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}
      >
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "bodyLarge" }}
            modifiers={[weight(1)]}
          >
            {workspace.name}
          </Text>
          <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
            {row.machineName}
          </Text>
        </Row>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <Text
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: "bodyMedium" }}
            color={colors.secondaryText}
            modifiers={[weight(1)]}
          >
            {connection === "connected" ? workspace.directory : rowStateText(connection)}
          </Text>
          {connection === "connected" && workspace.branch !== undefined && (
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
              <Icon source={branchIcon} size={13} tint={colors.secondaryText} />
              <Text style={{ typography: "bodyMedium" }} color={colors.secondaryText}>
                {workspace.branch}
              </Text>
            </Row>
          )}
        </Row>
      </Column>
    </Surface>
  );
}

function EmptyState({
  view,
  actions,
  bottom,
}: {
  view: Exclude<HomeView, { kind: "workspaces" }>;
  actions: HomeActions;
  bottom: number;
}) {
  switch (view.kind) {
    case "loading":
      return (
        <Centered bottom={bottom}>
          <LoadingIndicator modifiers={[semantics({ contentDescription: text.loading })]} />
        </Centered>
      );

    case "no-machines": {
      const [before, command, after] = text.noMachinesBody;
      return (
        <Centered bottom={bottom}>
          <StateTile icon={machineIcon} />
          <StateTitle>{text.noMachines}</StateTitle>
          <StateBody>
            {before}
            <Text style={{ fontFamily: "monospace" }}>{command}</Text>
            {after}
          </StateBody>
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[padding(0, 24, 0, 0)]}
          >
            <Button onClick={actions.onScanQrCode} enabled={!!actions.onScanQrCode}>
              <Text>{text.scanQrCode}</Text>
            </Button>
            <FilledTonalButton
              onClick={actions.onPasteInvitationLink}
              enabled={!!actions.onPasteInvitationLink}
            >
              <Text>{text.pasteInvitationLink}</Text>
            </FilledTonalButton>
            <TextButton onClick={actions.onGetDesktop} modifiers={[padding(0, 4, 0, 0)]}>
              <Text>{text.getDesktop}</Text>
            </TextButton>
          </Column>
        </Centered>
      );
    }

    case "no-workspaces":
      return (
        <Centered bottom={bottom}>
          <StateTile icon={workspacesIcon} />
          <StateTitle>{text.noWorkspaces}</StateTitle>
          <StateBody>{text.noWorkspacesBody}</StateBody>
        </Centered>
      );

    case "no-results":
      return (
        <Centered bottom={bottom}>
          <StateTile icon={searchOffIcon} />
          <StateBody>{text.noResultsTitle(view.query)}</StateBody>
        </Centered>
      );

    case "unreachable": {
      const { title, body } = unreachableText(view.state, view.machine?.name ?? null);
      const machine = view.machine;
      const onMachineSettings = machine
        ? actions.onMachineSettings && (() => actions.onMachineSettings?.(machine.id))
        : actions.onOpenSettings;

      return (
        <Centered bottom={bottom}>
          {view.state === "reconnecting" ? (
            <LoadingIndicator
              modifiers={[semantics({ contentDescription: text.loading }), padding(0, 0, 0, 20)]}
            />
          ) : (
            <StateTile icon={notConnectedIcon} failed={view.state === "still-not-connected"} />
          )}
          <StateTitle>{title}</StateTitle>
          {body !== undefined && <StateBody>{body}</StateBody>}
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[padding(0, 24, 0, 0)]}
          >
            {view.state !== "reconnecting" && (
              <Button onClick={actions.onTryAgain} enabled={!!actions.onTryAgain}>
                <Text>{text.tryAgain}</Text>
              </Button>
            )}
            <TextButton onClick={onMachineSettings} enabled={!!onMachineSettings}>
              <Text>{text.machineSettings}</Text>
            </TextButton>
          </Column>
        </Centered>
      );
    }
  }
}

function Centered({ children, bottom }: { children: React.ReactNode; bottom: number }) {
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement="center"
      modifiers={[fillMaxSize(), padding(40, 0, 40, bottom)]}
    >
      {children}
    </Column>
  );
}

/** A state's icon on a tile: the error container after an attempt failed, the secondary container otherwise. */
function StateTile({ icon, failed = false }: { icon: number; failed?: boolean }) {
  const colors = useMaterialColors();
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        padding(0, 0, 0, 20),
        size(80, 80),
        clip(Shapes.RoundedCorner(28)),
        background(failed ? colors.errorContainer : colors.secondaryContainer),
      ]}
    >
      <Icon
        source={icon}
        size={40}
        tint={failed ? colors.onErrorContainer : colors.onSecondaryContainer}
      />
    </Box>
  );
}

function StateTitle({ children }: { children: string }) {
  return <Text style={{ typography: "titleLarge", textAlign: "center" }}>{children}</Text>;
}

function StateBody({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{ typography: "bodyMedium", textAlign: "center" }}
      color={colors.secondaryText}
      modifiers={[padding(0, 8, 0, 0)]}
    >
      {children}
    </Text>
  );
}
