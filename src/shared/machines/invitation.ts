/** Where every Invitation Link starts. Invite Device and `spaceterm pair` make them. */
const INVITATION_LINK_START = "spaceterm://pair/";

/**
 * The Invitation Link that `text` holds, such as text from the clipboard, or `null` when it holds
 * something else. A link that starts right can still be one this device cannot use.
 */
export function invitationLinkIn(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.startsWith(INVITATION_LINK_START) && trimmed.length > INVITATION_LINK_START.length
    ? trimmed
    : null;
}
