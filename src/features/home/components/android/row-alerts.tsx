import {
  AlertDialog,
  Button,
  OutlinedButton,
  OutlinedTextField,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

import { renameOutcome } from "../../actions";
import type { RowAlert, RowAlerts } from "../../row-alerts";
import { killBody, text } from "../../text";

/**
 * The Material dialogs of Rename Workspace and Kill Workspace: an outlined Cancel and a filled
 * confirming button, none of them red.
 */
export function RowAlertsView({ alerts }: { alerts: RowAlerts }) {
  const { alert } = alerts;
  if (alert === null) return null;
  switch (alert.kind) {
    case "kill":
      return <KillDialog alert={alert} alerts={alerts} />;
    case "rename":
      return <RenameDialog key={alerts.closed} alert={alert} alerts={alerts} />;
  }
}

function KillDialog({
  alert,
  alerts,
}: {
  alert: Extract<RowAlert, { kind: "kill" }>;
  alerts: RowAlerts;
}) {
  const sessions = killBody(alert.row.workspace.terminalSessions);
  return (
    <AlertDialog onDismissRequest={alerts.cancel}>
      <AlertDialog.Title>
        <Text style={{ typography: "headlineSmall" }}>
          {text.killTitle(alert.row.workspace.name)}
        </Text>
      </AlertDialog.Title>
      {sessions && (
        <AlertDialog.Text>
          <Text style={{ typography: "bodyMedium" }}>{sessions}</Text>
        </AlertDialog.Text>
      )}
      <AlertDialog.DismissButton>
        <OutlinedButton onClick={alerts.cancel}>
          <Text>{text.cancel}</Text>
        </OutlinedButton>
      </AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton>
        <Button onClick={alerts.kill}>
          <Text>{text.killWorkspace}</Text>
        </Button>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  );
}

function RenameDialog({
  alert,
  alerts,
}: {
  alert: Extract<RowAlert, { kind: "rename" }>;
  alerts: RowAlerts;
}) {
  const { name } = alert.row.workspace;
  const initial = alert.initial ?? name;
  const field = useNativeState(initial);
  // The cursor starts after the name.
  const selection = useNativeState({ start: initial.length, end: initial.length });
  const [typed, setTyped] = useState(initial);
  return (
    <AlertDialog onDismissRequest={alerts.cancel}>
      <AlertDialog.Title>
        <Text style={{ typography: "headlineSmall" }}>{text.renameWorkspace}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <OutlinedTextField
          value={field}
          selection={selection}
          autoFocus
          singleLine
          onValueChange={setTyped}
          keyboardOptions={{ autoCorrectEnabled: false, imeAction: "done" }}
          keyboardActions={{ onDone: alerts.rename }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>{text.name}</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>
      </AlertDialog.Text>
      <AlertDialog.DismissButton>
        <OutlinedButton onClick={alerts.cancel}>
          <Text>{text.cancel}</Text>
        </OutlinedButton>
      </AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton>
        {/* The field's own text: the last keystroke's event can still be on its way to React. */}
        <Button
          onClick={() => alerts.rename(field.get())}
          enabled={renameOutcome(name, typed).kind !== "unavailable"}
        >
          <Text>{text.rename}</Text>
        </Button>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  );
}
