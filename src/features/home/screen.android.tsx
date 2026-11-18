import addIcon from "@expo/material-symbols/add.xml";
import notConnectedIcon from "@expo/material-symbols/desktop_access_disabled.xml";
import machineIcon from "@expo/material-symbols/desktop_windows.xml";
import branchIcon from "@expo/material-symbols/graph_1.xml";
import moreIcon from "@expo/material-symbols/more_vert.xml";
import workspacesIcon from "@expo/material-symbols/stacks.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Column,
  ExtendedFloatingActionButton,
  FilledTonalButton,
  Icon,
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

import { homeView, isSearchable, type HomeView, type WorkspaceRow } from "./model";
import type { HomeActions, HomeScreenProps } from "./props";
import { rowStateText, text, unreachableText } from "./text";

/** Grouped cards: 16 outside corners, 4 inside, 2 between rows. */
const OUTER_CORNER = 16;
const INNER_CORNER = 4;
const ROW_GAP = 2;
/** Material gives a not connected row the disabled look. */
const DIMMED = 0.5;

export default function HomeScreen({ snapshot, ...actions }: HomeScreenProps) {
  const [query, setQuery] = useState("");
  const view = homeView(snapshot, query);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const canCreateWorkspace = isSearchable(view) && view.canCreateWorkspace;

  return (
    <>
      <Stack.Screen options={{ headerShadowVisible: false }} />
      <Stack.Screen.Title>{text.title}</Stack.Screen.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={moreIcon} accessibilityLabel={text.more}>
          <Stack.Toolbar.MenuAction
            disabled={!canCreateWorkspace || !actions.onNewWorkspace}
            onPress={actions.onNewWorkspace}
          >
            {text.newWorkspace}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction disabled={!actions.onAddMachine} onPress={actions.onAddMachine}>
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
      {isSearchable(view) && (
        <Stack.SearchBar
          placeholder={text.searchWorkspaces}
          onChangeText={(event) => setQuery(event.nativeEvent.text)}
          onClose={() => setQuery("")}
          textColor={colors.text}
          hintTextColor={colors.secondaryText}
          headerIconColor={colors.secondaryText}
        />
      )}

      <Host style={{ flex: 1 }}>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          {view.kind === "workspaces" ? (
            <WorkspaceList
              rows={view.rows}
              onOpen={actions.onOpenWorkspace}
              bottomPadding={insets.bottom + (canCreateWorkspace ? 96 : 16)}
            />
          ) : (
            <EmptyState view={view} actions={actions} />
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
}: {
  view: Exclude<HomeView, { kind: "workspaces" }>;
  actions: HomeActions;
}) {
  switch (view.kind) {
    case "loading":
      return (
        <Centered>
          <LoadingIndicator modifiers={[semantics({ contentDescription: text.loading })]} />
        </Centered>
      );

    case "no-machines": {
      const [before, command, after] = text.noMachinesBody;
      return (
        <Centered>
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
        <Centered>
          <StateTile icon={workspacesIcon} />
          <StateTitle>{text.noWorkspaces}</StateTitle>
          <StateBody>{text.noWorkspacesBody}</StateBody>
        </Centered>
      );

    case "no-results":
      return (
        <Centered>
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

      return (
        <Centered>
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement="center"
      modifiers={[fillMaxSize(), padding(40, 0, 40, 120)]}
    >
      {children}
    </Column>
  );
}

/** A state's icon on a tile: the error container after an attempt failed, the primary container otherwise. */
function StateTile({ icon, failed = false }: { icon: number; failed?: boolean }) {
  const colors = useMaterialColors();
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        padding(0, 0, 0, 20),
        size(80, 80),
        clip(Shapes.RoundedCorner(28)),
        background(failed ? colors.errorContainer : colors.primaryContainer),
      ]}
    >
      <Icon
        source={icon}
        size={40}
        tint={failed ? colors.onErrorContainer : colors.onPrimaryContainer}
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
