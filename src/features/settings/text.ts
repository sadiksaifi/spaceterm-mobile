import type { ConnectionState } from "@/shared/machines/model";
import type { PrivacySetting } from "@/shared/preferences/model";
import { connectionStateText } from "@/shared/machines/text";
import { cased } from "@/shared/text";

export const text = {
  title: "Settings",
  machines: "Machines",
  addMachine: cased("Add Machine…", "Add Machine"),
  themes: "Themes",
  fontSize: cased("Font Size", "Font size"),
  points: (points: number) => `${points} pt`,
  privacy: "Privacy",
  notifications: "Notifications",
  terminalAttention: cased("Terminal Attention Notifications", "Terminal attention notifications"),
  programsCopyText: cased("Allow Programs to Copy Text", "Allow programs to copy text"),
  programsReadClipboard: cased(
    "Allow Programs to Read Clipboard",
    "Allow programs to read clipboard",
  ),
  back: "Back",

  status: "Status",
  connection: "Connection",
  /** This device reaches a paired Machine over the network, through its Saved Connection. */
  network: "Network",
  disconnect: "Disconnect",
  connect: "Connect",
  restartCore: "Restart SpaceTerm Core",
  unpair: cased("Unpair This Device", "Unpair this device"),
  /** What screen readers say for the spinner beside Reconnecting. */
  loading: "Loading",
  cancel: "Cancel",
  restart: "Restart",
  restartTitle: "Restart SpaceTerm Core?",
  unpairTitle: cased("Unpair This Device?", "Unpair this device?"),
  unpairBody: (machine: string) => `Connecting to ${machine} again needs a new Invitation Link.`,
  unpairAction: "Unpair",
  restartFailed: cased("Couldn’t Restart SpaceTerm Core", "Couldn’t restart SpaceTerm Core"),
  tryAgain: cased("Try Again", "Try again"),
};

/** The Privacy switches, in the order they show. */
export const privacySwitches: readonly { setting: PrivacySetting; label: string }[] = [
  { setting: "notifications", label: text.notifications },
  { setting: "terminalAttention", label: text.terminalAttention },
  { setting: "programsCopyText", label: text.programsCopyText },
  { setting: "programsReadClipboard", label: text.programsReadClipboard },
];

/** The sentence under Restart SpaceTerm Core's title: what is lost. `null` when nothing runs. */
export function restartBody(terminalSessions: number, machine: string): string | null {
  if (terminalSessions === 0) return null;
  const noun = terminalSessions === 1 ? "Terminal Session" : "Terminal Sessions";
  return `This ends ${terminalSessions} ${noun} on ${machine}.`;
}

/** What a Machine's row and page say about its connection. */
export function machineStatus(connection: ConnectionState): string {
  return connection === "connected" ? "Connected" : connectionStateText(connection);
}
