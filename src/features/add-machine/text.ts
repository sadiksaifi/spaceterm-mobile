import { cased } from "@/shared/text";

import type { PairingView } from "./use-pairing";

export const text = {
  title: "Add Machine",
  cancel: "Cancel",
  close: "Close",
  back: "Back",
  join: "Join",
  loading: "Loading",

  cameraPreview: "Camera preview",
  pasteInvitationLink: "Paste Invitation Link",
  cameraOff: cased("Camera Access Is Off", "Camera access is off"),
  cameraOffBody: "Allow camera access in Settings to scan the QR code.",
  openSettings: cased("Open Settings", "Open settings"),

  invitationLink: "Invitation Link",
  paste: "Paste",
  machine: "Machine",
  address: "Address",
  networkAddress: cased("Network Address (Optional)", "Network address (optional)"),
  networkAddressFooter: "Only if this device reaches the Machine at another address.",
  /** iOS alert titles, for a link from a scan, a paste or another app. */
  unusableTitle: "This Invitation Link Can’t Be Used",
  alreadyPairedTitle: (machine: string) => `“${machine}” Is Already Paired`,
  /** Text under the link: Android's error text, and iOS's footer for a link typed in the field. */
  unusable: "This Invitation Link can’t be used.",
  alreadyPaired: (machine: string) => `${machine} is already paired.`,
  ok: "OK",

  comparisonCode: "Comparison Code",
  /** What a screen reader says for the code, which it would otherwise read as two numbers. */
  codeLabel: (code: string) => `Comparison Code ${code}`,
  sameCode: (machine: string) => `Make sure ${machine} shows the same code.`,
  waiting: (machine: string) => `Waiting for approval on ${machine}…`,

  couldNotPair: (machine: string) =>
    cased(`Couldn’t Pair with ${machine}`, `Couldn’t pair with ${machine}`),
  declined: "The request was declined or the Comparison Code expired.",
  unreachable: (machine: string) => `Make sure ${machine} is on and SpaceTerm Core is running.`,
  tryAgain: cased("Try Again", "Try again"),
  /** This device has no room for another pairing, as cancelled pairings still hold some. */
  unfinished: "This device has too many unfinished pairings.",
  /**
   * This device has no room, and no cancelled pairing holds any: paired Machines do, and Machines
   * unpaired while away, until they answer.
   */
  noRoom:
    "This device has no room for another Machine. Unpair one in Settings, or wait for Machines you unpaired to answer.",
  stopUnfinished: cased("Stop Unfinished Pairings", "Stop unfinished pairings"),
  stopTitle: (count: number) =>
    count === 1
      ? cased("Stop the Unfinished Pairing?", "Stop the unfinished pairing?")
      : cased(`Stop ${count} Unfinished Pairings?`, `Stop ${count} unfinished pairings?`),
  stopBody:
    "This device stops waiting for those Machines to cancel. A Machine that approved this device may still list it until you unpair it there.",
  stop: "Stop",
  paired: (machine: string) => `Paired with ${machine}`,
  done: "Done",
};

/** Why a pairing failed, under "Couldn’t Pair". */
export function failedBody(
  pairing: Extract<PairingView, { kind: "declined" | "unreachable" | "full" }>,
  machine: string,
): string {
  switch (pairing.kind) {
    case "declined":
      return text.declined;
    case "unreachable":
      return text.unreachable(machine);
    case "full":
      return pairing.unfinished > 0 ? text.unfinished : text.noRoom;
  }
}
