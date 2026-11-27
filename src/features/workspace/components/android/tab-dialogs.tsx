import { ConfirmDialog } from "@/shared/ui/android/confirm-dialog";

import { closeAlertText, text } from "../../text";
import type { TabCommands } from "../../use-tab-commands";

/** The Material dialogs of Close Tab and Close Pane: an outlined Cancel and a filled Close. */
export function TabDialogs({ commands }: { commands: TabCommands }) {
  const { alert } = commands;
  if (alert === null) return null;
  const { title, body, action } = closeAlertText(alert);
  return (
    <ConfirmDialog
      title={title}
      body={body}
      cancel={text.cancel}
      action={action}
      onCancel={commands.cancel}
      onConfirm={commands.confirm}
    />
  );
}
