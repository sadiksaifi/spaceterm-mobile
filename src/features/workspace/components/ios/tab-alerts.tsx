import { Alert, Button, Text } from "@expo/ui/swift-ui";
import type { ReactNode } from "react";

import { closeAlertText, failureText, text } from "../../text";
import type { TabCommands } from "../../use-tab-commands";

/**
 * The system alerts of Close Tab and Close Pane, and of a refused Tab or Pane command, attached to
 * `children`. Cancel comes first. A failure waits for an open alert to close. Only the `active`
 * one of several shows them, as with `RowAlertsView`.
 */
export function TabAlertsView({
  commands,
  active = true,
  children,
}: {
  commands: TabCommands;
  active?: boolean;
  children: ReactNode;
}) {
  const alert = active ? commands.alert : null;
  const failure = active && alert === null ? commands.failure : null;
  const asked = alert && closeAlertText(alert);

  return (
    <Alert
      title={failure ? failureText(failure) : ""}
      isPresented={failure !== null}
      onIsPresentedChange={(shown) => !shown && failure && commands.dismissFailure(failure)}
    >
      <Alert.Trigger>
        <Alert
          title={asked?.title ?? ""}
          isPresented={alert !== null}
          onIsPresentedChange={(shown) => !shown && alert && commands.cancel()}
        >
          <Alert.Trigger>{children}</Alert.Trigger>
          <Alert.Actions>
            <Button label={text.cancel} role="cancel" onPress={commands.cancel} />
            <Button label={asked?.action ?? ""} role="destructive" onPress={commands.confirm} />
          </Alert.Actions>
          {asked && (
            <Alert.Message>
              <Text>{asked.body}</Text>
            </Alert.Message>
          )}
        </Alert>
      </Alert.Trigger>
      <Alert.Actions>
        <Button
          label={text.cancel}
          role="cancel"
          onPress={() => failure && commands.dismissFailure(failure)}
        />
        <Button label={text.tryAgain} onPress={() => failure && commands.retry(failure)} />
      </Alert.Actions>
    </Alert>
  );
}
