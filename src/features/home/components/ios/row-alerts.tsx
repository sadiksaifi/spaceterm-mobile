import { Alert, Button, Text, TextField, useNativeState } from "@expo/ui/swift-ui";
import { disabled } from "@expo/ui/swift-ui/modifiers";
import { useState, type ReactNode } from "react";

import { renameOutcome } from "../../actions";
import type { RowAlerts } from "../../row-alerts";
import { killBody, text } from "../../text";

/**
 * The system alerts of Rename Workspace and Kill Workspace, and of a failure, attached to
 * `children`, the view they appear over. Cancel comes first; a button closes its alert.
 */
export function RowAlertsView({ alerts, children }: { alerts: RowAlerts; children: ReactNode }) {
  const { alert } = alerts;
  const kill = alert?.kind === "kill" ? alert.row : null;
  const rename = alert?.kind === "rename" ? alert : null;
  // A failure waits for an open alert to close.
  const failure = alert === null ? alerts.failure : null;
  const sessions = kill && killBody(kill.workspace.terminalSessions);

  return (
    <Alert
      title={failure ? text.failedTitle(failure.command, failure.row.workspace.name) : ""}
      isPresented={failure !== null}
      onIsPresentedChange={(shown) => !shown && failure && alerts.dismissFailure(failure)}
    >
      <Alert.Trigger>
        <Alert
          title={kill ? text.killTitle(kill.workspace.name) : ""}
          isPresented={kill !== null}
          onIsPresentedChange={(shown) => !shown && kill && alerts.cancel()}
        >
          <Alert.Trigger>
            <Alert
              title={text.renameWorkspace}
              isPresented={rename !== null}
              onIsPresentedChange={(shown) => !shown && rename && alerts.cancel()}
            >
              <Alert.Trigger>{children}</Alert.Trigger>
              <Alert.Actions>
                {/* A new field for each alert, holding the name it renames. */}
                {rename && (
                  <RenameActions
                    key={alerts.closed}
                    name={rename.row.workspace.name}
                    initial={rename.initial ?? rename.row.workspace.name}
                    onCancel={alerts.cancel}
                    onRename={alerts.rename}
                  />
                )}
              </Alert.Actions>
            </Alert>
          </Alert.Trigger>
          <Alert.Actions>
            <Button label={text.cancel} role="cancel" onPress={alerts.cancel} />
            <Button label={text.killWorkspace} role="destructive" onPress={alerts.kill} />
          </Alert.Actions>
          {sessions && (
            <Alert.Message>
              <Text>{sessions}</Text>
            </Alert.Message>
          )}
        </Alert>
      </Alert.Trigger>
      <Alert.Actions>
        <Button
          label={text.cancel}
          role="cancel"
          onPress={() => failure && alerts.dismissFailure(failure)}
        />
        <Button label={text.tryAgain} onPress={() => failure && alerts.retry(failure)} />
      </Alert.Actions>
    </Alert>
  );
}

/** The field starts with `initial`. Rename is unavailable while the field holds no name. */
function RenameActions({
  name,
  initial,
  onCancel,
  onRename,
}: {
  name: string;
  initial: string;
  onCancel: () => void;
  onRename: (typed: string) => void;
}) {
  const field = useNativeState(initial);
  const [typed, setTyped] = useState(initial);
  return (
    <>
      <TextField text={field} placeholder={text.name} autoFocus onTextChange={setTyped} />
      <Button label={text.cancel} role="cancel" onPress={onCancel} />
      <Button
        label={text.rename}
        onPress={() => onRename(typed)}
        modifiers={[disabled(renameOutcome(name, typed).kind === "unavailable")]}
      />
    </>
  );
}
