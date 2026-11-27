import { invitationLinkIn } from "@/shared/machines/invitation";

/**
 * An Invitation Link opened in another app opens Add Machine on its Invitation Link step, over the
 * screen the app was on. Every other link goes where its path says.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const link = invitationLinkIn(path);
  if (link === null) return path;
  // Each delivery is new, so the Invitation Link step resets even for the same link again.
  return `/add-machine/link?link=${encodeURIComponent(link)}&delivery=${Date.now()}`;
}
