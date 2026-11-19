import { Box, Column, LoadingIndicator, useMaterialColors } from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  padding,
  semantics,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/shared/theme/colors";
import { ConfirmDialog } from "@/shared/ui/android/confirm-dialog";
import { GROUPED_GAP } from "@/shared/ui/android/grouped";
import { GroupedRow } from "@/shared/ui/android/grouped-row";
import { ScreenHost } from "@/shared/ui/android/screen-host";
import { SnackbarSlot, useSnackbar } from "@/shared/ui/android/snackbar";

import { Gap, GROUP_SPACE, PageTopBar } from "@/shared/ui/android/page";
import { machineStatus, restartBody, text } from "../text";
import type ScreenContract from "./screen";
import type { MachinePageProps } from "./screen";

/** Material's loading indicator in a row, as the design draws it. */
const INDICATOR_SIZE = 32;

/**
 * The page of one Machine. Its actions are plain rows, as the design draws them; the dialogs have
 * an outlined Cancel and a filled confirming button, none of them red.
 */
export default function MachinePageScreen({ machine, terminalSessions, page }: MachinePageProps) {
  const colors = useColors();
  const material = useMaterialColors();
  const insets = useSafeAreaInsets();
  const { connection } = machine;
  const connected = connection === "connected";
  const reconnecting = connection === "reconnecting";
  const snackbar = useSnackbar(
    page.failure,
    () => ({ message: text.restartFailed, actionLabel: text.tryAgain }),
    page.retry,
    page.dismissFailure,
  );
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHost>
        <Box modifiers={[fillMaxSize(), background(colors.groupedBackground)]}>
          <Column modifiers={[fillMaxSize()]}>
            <PageTopBar title={machine.name} backLabel={text.back} />
            <Column
              verticalArrangement={{ spacedBy: GROUPED_GAP }}
              modifiers={[
                weight(1),
                verticalScroll(),
                padding(16, 0, 16, insets.bottom + GROUP_SPACE),
              ]}
            >
              <GroupedRow
                first
                last={false}
                headline={text.status}
                supporting={machineStatus(connection)}
                trailing={
                  reconnecting ? (
                    <LoadingIndicator
                      color={material.primary}
                      modifiers={[
                        size(INDICATOR_SIZE, INDICATOR_SIZE),
                        semantics({ contentDescription: text.loading }),
                      ]}
                    />
                  ) : undefined
                }
              />
              <GroupedRow first={false} last headline={text.connection} supporting={text.network} />
              <Gap />
              {connected ? (
                <GroupedRow
                  first
                  last={false}
                  headline={text.disconnect}
                  onClick={page.disconnect}
                />
              ) : (
                <GroupedRow
                  first
                  last={false}
                  headline={text.connect}
                  enabled={!reconnecting}
                  onClick={page.connect}
                />
              )}
              <GroupedRow
                first={false}
                last={false}
                headline={text.restartCore}
                enabled={connected && !page.restarting}
                onClick={page.askRestart}
              />
              <GroupedRow first={false} last headline={text.unpair} onClick={page.askUnpair} />
            </Column>
          </Column>
          <SnackbarSlot {...snackbar} bottom={insets.bottom + GROUP_SPACE} />
        </Box>

        {page.alert === "restart" && (
          <ConfirmDialog
            cancel={text.cancel}
            title={text.restartTitle}
            body={restartBody(terminalSessions, machine.name)}
            action={text.restart}
            onCancel={page.cancel}
            onConfirm={page.restart}
          />
        )}
        {page.alert === "unpair" && (
          <ConfirmDialog
            cancel={text.cancel}
            title={text.unpairTitle}
            body={text.unpairBody(machine.name)}
            action={text.unpairAction}
            onCancel={page.cancel}
            onConfirm={page.unpair}
          />
        )}
      </ScreenHost>
    </>
  );
}

MachinePageScreen satisfies typeof ScreenContract;
