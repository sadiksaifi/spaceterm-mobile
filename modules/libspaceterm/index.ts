import { NativeModule, requireNativeModule } from "expo";

/** The Machine an Invitation Link names. `machineId` stays the same for the same SpaceTerm Core. */
export type InvitedMachine = { machineId: string; machineName: string; address: string };

export type NativeInvitationReading =
  | ({ kind: "invitation" } & InvitedMachine)
  /** Not an Invitation Link, one for another edition of SpaceTerm, or an expired one. */
  | { kind: "unusable" }
  | ({ kind: "already-paired" } & InvitedMachine);

export type NativeJoinStart =
  | { kind: "joining"; join: string }
  | { kind: "unusable" }
  /** The network address is no DNS name or IP address with an optional port. */
  | { kind: "invalid-address" }
  | { kind: "unavailable" };

export type NativeJoinState =
  | { kind: "reaching" }
  /** The six digits the Machine shows too. */
  | { kind: "comparing"; code: string }
  /** The Machine did not answer. The join waits for `retryJoin` or `cancelJoin`. */
  | { kind: "paused" }
  | { kind: "paired"; machineId: string }
  /** The Machine declined, or the Comparison Code expired. */
  | { kind: "declined" }
  | { kind: "unreachable" };

export type NativePairedMachine = {
  id: string;
  name: string;
  address: string;
  connection: "connected" | "connecting" | "disconnected" | "unavailable";
};

type LibspacetermEvents = {
  /** Something about the paired Machines or a join changed. Read them again to see what. */
  onChange: () => void;
};

/**
 * libspaceterm on this device: Invitation Links, pairing, and the paired Machines. Its Saved
 * Connections and pairing secrets stay in native storage; JavaScript never sees a secret.
 */
export declare class LibspacetermModule extends NativeModule<LibspacetermEvents> {
  readInvitation(link: string): NativeInvitationReading;
  /** Starts pairing with the Machine of `link`, at `networkAddress` when it is not `null`. */
  join(link: string, networkAddress: string | null): NativeJoinStart;
  joinState(join: string): NativeJoinState;
  /**
   * Asks for access to Machines on the local network where the system wants the app to ask, and
   * resolves whether the app has it.
   */
  allowLocalNetwork(): Promise<boolean>;
  /** Tries a paused join again. `false` when the join is not paused or has expired. */
  retryJoin(join: string): boolean;
  /** Ends a join. A join the Machine approved meanwhile is unpaired again. */
  cancelJoin(join: string): Promise<void>;
  /** The paired Machines, in the order they were paired. */
  paired(): NativePairedMachine[];
  /** Each resolves `false` when no paired Machine has the id, or the change failed. */
  connect(machineId: string): Promise<boolean>;
  disconnect(machineId: string): Promise<boolean>;
  unpair(machineId: string): Promise<boolean>;
}

export default requireNativeModule<LibspacetermModule>("Libspaceterm");
