import { expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { MachinesProvider } from "@/shared/machines/client";
import { createMockClient } from "@/shared/machines/mock";
import type { MachineClient, PairingOutcome } from "@/shared/machines/model";

import { usePairing } from "./use-pairing";

const request = { link: "spaceterm://pair/abc", machineName: "Mac mini", networkAddress: null };

/**
 * A Machine that answers with `482 915` when the test calls `reach`, and approves or declines when
 * it calls `answer`.
 */
function machine() {
  let reach: () => void = () => {};
  let answer: (outcome: PairingOutcome) => void = () => {};
  const cancel = jest.fn();
  const client: MachineClient = {
    ...createMockClient([]),
    pair: async () => {
      await new Promise<void>((resolve) => (reach = resolve));
      return {
        kind: "comparing",
        code: "482 915",
        outcome: new Promise<PairingOutcome>((resolve) => (answer = resolve)),
        cancel,
      };
    },
  };
  return {
    client,
    cancel,
    reach: () => reach(),
    answer: (outcome: PairingOutcome) => answer(outcome),
  };
}

async function render(client: MachineClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MachinesProvider client={client}>{children}</MachinesProvider>
  );
  return renderHook(({ showing }: { showing: boolean }) => usePairing(request, showing), {
    wrapper,
    initialProps: { showing: true },
  });
}

it("shows the Comparison Code, then Paired once the Machine approves", async () => {
  const { client, reach, answer } = machine();
  const { result } = await render(client);
  expect(result.current.view).toEqual({ kind: "reaching" });
  await act(async () => reach());
  expect(result.current.view).toEqual({ kind: "comparing", code: "482 915" });

  await act(async () => answer({ kind: "paired", machine: { id: "mini", name: "Mac mini" } }));
  expect(result.current.view).toEqual({ kind: "paired" });
});

it("shows that this device has no room, and how many unfinished pairings hold it", async () => {
  const client: MachineClient = {
    ...createMockClient([]),
    pair: async () => ({ kind: "full", unfinished: 3 }),
  };
  const { result } = await render(client);
  await act(async () => {});
  expect(result.current.view).toEqual({ kind: "full", unfinished: 3 });
});

it("pairs again with the same link when asked", async () => {
  const pair = jest
    .fn<MachineClient["pair"]>()
    .mockResolvedValueOnce({ kind: "full", unfinished: 1 })
    .mockResolvedValueOnce({
      kind: "comparing",
      code: "482 915",
      outcome: new Promise<PairingOutcome>(() => {}),
      cancel: () => {},
    });
  const { result } = await render({ ...createMockClient([]), pair });
  await act(async () => {});
  expect(result.current.view).toEqual({ kind: "full", unfinished: 1 });

  await act(async () => result.current.again());
  expect(result.current.view).toEqual({ kind: "comparing", code: "482 915" });
  expect(pair).toHaveBeenCalledTimes(2);
  expect(pair).toHaveBeenLastCalledWith(request.link, request.networkAddress, expect.anything());
});

it("ends the pairing when the person leaves before the Machine approves", async () => {
  const { client, cancel, reach } = machine();
  const { unmount } = await render(client);
  await act(async () => reach());
  await act(async () => unmount());
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("ends the pairing as soon as the person cancels, before the step closes", async () => {
  const { client, cancel, reach, answer } = machine();
  const { result } = await render(client);
  await act(async () => reach());

  await act(async () => result.current.end());
  await act(async () => answer({ kind: "paired", machine: { id: "mini", name: "Mac mini" } }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(result.current.view).toEqual({ kind: "comparing", code: "482 915" });
});

it("ends a pairing that the Machine starts after the person left", async () => {
  const { client, cancel, reach } = machine();
  const { unmount } = await render(client);
  await act(async () => unmount());
  await act(async () => reach());
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("ends the pairing when another step covers this one, and starts anew when it shows again", async () => {
  const { client, cancel, reach } = machine();
  const { result, rerender } = await render(client);
  await act(async () => reach());
  await act(async () => rerender({ showing: false }));
  expect(cancel).toHaveBeenCalledTimes(1);

  await act(async () => rerender({ showing: true }));
  expect(result.current.view).toEqual({ kind: "reaching" });
  await act(async () => reach());
  expect(result.current.view).toEqual({ kind: "comparing", code: "482 915" });
});
