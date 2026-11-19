import type { ConnectionState } from "@/shared/machines/model";
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
};

/** What a Machine's row and page say about its connection. */
export function machineStatus(connection: ConnectionState): string {
  return connection === "connected" ? "Connected" : connectionStateText(connection);
}
