import { Alert, Button, Text } from "@expo/ui/swift-ui";
import { disabled } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { removalAlertText, text } from "../../text";
import type { RemoveWorktree } from "../../use-remove-worktree";

/**
 * Remove Worktree's system alert, attached to `children`: what it deletes on `machine`, to
 * confirm, or why nothing was removed, which may offer Try Again. Cancel comes first. Only the `active` one of several shows
 * it, as with `RowAlertsView`.
 */
export function RemovalAlertsView({
  removal,
  machine,
  active = true,
  children,
}: {
  removal: RemoveWorktree;
  machine: string;
  active?: boolean;
  children: ReactNode;
}) {
  const alert = active ? removal.alert : null;
  const shown = alert && removalAlertText(alert, machine);

  return (
    <Alert
      title={shown?.title ?? ""}
      isPresented={alert !== null}
      onIsPresentedChange={(presented) => !presented && alert && removal.dismiss()}
    >
      <Alert.Trigger>{children}</Alert.Trigger>
      <Alert.Actions>
        {shown?.action === undefined ? (
          <Button label={text.ok} role="cancel" onPress={removal.dismiss} />
        ) : (
          <>
            <Button label={text.cancel} role="cancel" onPress={removal.dismiss} />
            <Button
              label={shown.action}
              role={shown.destructive ? "destructive" : undefined}
              onPress={removal.confirm}
              modifiers={[disabled(!removal.confirm)]}
            />
          </>
        )}
      </Alert.Actions>
      {shown && (
        <Alert.Message>
          <Text>{shown.body}</Text>
        </Alert.Message>
      )}
    </Alert>
  );
}
