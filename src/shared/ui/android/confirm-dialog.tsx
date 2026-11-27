import { AlertDialog, Button, OutlinedButton, Text } from "@expo/ui/jetpack-compose";

/**
 * A dialog that asks before an action: an outlined Cancel and a filled action button. Material
 * keeps the action in the primary color, even when it removes something. Without `cancel`, it
 * tells something and its one button, such as OK, closes it. `enabled` false holds the action
 * until it can run.
 */
export function ConfirmDialog({
  title,
  body,
  cancel,
  action,
  enabled = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  body?: string | null;
  cancel?: string;
  action: string;
  enabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog onDismissRequest={onCancel}>
      <AlertDialog.Title>
        <Text style={{ typography: "headlineSmall" }}>{title}</Text>
      </AlertDialog.Title>
      {body != null && (
        <AlertDialog.Text>
          <Text style={{ typography: "bodyMedium" }}>{body}</Text>
        </AlertDialog.Text>
      )}
      {cancel !== undefined && (
        <AlertDialog.DismissButton>
          <OutlinedButton onClick={onCancel}>
            <Text>{cancel}</Text>
          </OutlinedButton>
        </AlertDialog.DismissButton>
      )}
      <AlertDialog.ConfirmButton>
        <Button enabled={enabled} onClick={onConfirm}>
          <Text>{action}</Text>
        </Button>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  );
}
