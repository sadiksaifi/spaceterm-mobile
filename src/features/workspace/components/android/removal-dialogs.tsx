import { ConfirmDialog } from "@/shared/ui/android/confirm-dialog";

import { removalAlertText, text } from "../../text";
import type { RemoveWorktree } from "../../use-remove-worktree";

/**
 * Remove Worktree's Material dialogs: what it deletes on `machine`, with Cancel and the action, or
 * why nothing was removed, with OK, or with Cancel and Try Again when the Machine didn't answer.
 */
export function RemovalDialogs({ removal, machine }: { removal: RemoveWorktree; machine: string }) {
  const { alert } = removal;
  if (alert === null) return null;
  const { title, body, action } = removalAlertText(alert, machine);
  return action === undefined ? (
    <ConfirmDialog
      title={title}
      body={body}
      action={text.ok}
      onCancel={removal.dismiss}
      onConfirm={removal.dismiss}
    />
  ) : (
    <ConfirmDialog
      title={title}
      body={body}
      cancel={text.cancel}
      action={action}
      enabled={removal.confirm !== undefined}
      onCancel={removal.dismiss}
      onConfirm={() => removal.confirm?.()}
    />
  );
}
