import { expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { MachinesProvider } from "@/shared/machines/client";
import { createMockClient } from "@/shared/machines/mock";

import { useMachinePage } from "./use-machine-page";

const mac = {
  id: "mac",
  name: "MacBook Pro",
  connection: "connected" as const,
  home: "/Users/you",
  directories: {},
  workspaces: [],
};

/** Lets the mock Machine's answers, which come on a timer, arrive. */
const answers = () => new Promise((resolve) => setTimeout(resolve, 1));

async function render(client = createMockClient([mac], { refuse: true })) {
  const onUnpaired = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MachinesProvider client={client}>{children}</MachinesProvider>
  );
  const hook = await renderHook(() => useMachinePage("mac", onUnpaired), { wrapper });
  return { ...hook, client, onUnpaired };
}

it("offers Try Again when the Machine refuses Restart, and Try Again asks to restart again", async () => {
  const { result, client } = await render();
  const restartCore = jest.spyOn(client, "restartCore");

  await act(async () => result.current.askRestart());
  await act(async () => {
    result.current.restart();
    await answers();
  });
  expect(result.current.alert).toBeNull();
  expect(result.current.failure).not.toBeNull();

  // Terminal Sessions may have started since, so Try Again confirms before it ends them.
  const failure = result.current.failure;
  await act(async () => {
    if (failure) result.current.retry(failure);
    await answers();
  });
  expect(restartCore).toHaveBeenCalledTimes(1);
  expect(result.current.failure).toBeNull();
  expect(result.current.alert).toBe("restart");

  await act(async () => {
    result.current.restart();
    await answers();
  });
  expect(restartCore).toHaveBeenCalledTimes(2);
  expect(result.current.failure).toBeNull();
});

it("takes away a refused Restart once the Machine is not connected, since it cannot restart", async () => {
  const { result } = await render();
  await act(async () => {
    result.current.restart();
    await answers();
  });
  expect(result.current.failure).not.toBeNull();

  await act(async () => {
    result.current.disconnect();
    await answers();
  });

  expect(result.current.failure).toBeNull();
});

it("restarts once when Restart is tapped twice before the Machine answers", async () => {
  const { result, client } = await render(createMockClient([mac]));
  const restartCore = jest.spyOn(client, "restartCore");

  const shown = result.current;
  await act(async () => {
    shown.restart();
    shown.restart();
  });
  expect(restartCore).toHaveBeenCalledTimes(1);
});

it("unpairs and leaves once, however often Unpair is reported", async () => {
  const { result, client, onUnpaired } = await render();

  const shown = result.current;
  await act(async () => {
    shown.unpair();
    shown.unpair();
  });
  expect(client.getSnapshot().machines).toEqual([]);
  expect(onUnpaired).toHaveBeenCalledTimes(1);
});
