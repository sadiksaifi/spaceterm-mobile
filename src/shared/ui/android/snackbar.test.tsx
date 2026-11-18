import { expect, it, jest } from "@jest/globals";
import type { SnackbarHostRef } from "@expo/ui/jetpack-compose";
import { act, renderHook } from "@testing-library/react-native";

import { useSnackbar } from "./snackbar";

// The hook drives a host through its ref; the Compose views themselves are not under test.
jest.mock("@expo/ui/jetpack-compose", () => ({ SnackbarHost: () => null }));
jest.mock("@expo/ui/jetpack-compose/modifiers", () => ({ align: jest.fn(), padding: jest.fn() }));

type Item = { name: string };
type Answer = "actionPerformed" | "dismissed";

/** A host whose snackbars stay until the test answers them, or which refuses a few times first. */
function host(refusals = 0) {
  const answers: ((answer: Answer) => void)[] = [];
  const showSnackbar = jest.fn<SnackbarHostRef["showSnackbar"]>(() => {
    if (refusals > 0) {
      refusals -= 1;
      return Promise.reject(new Error("No handler registered"));
    }
    return new Promise<Answer>((resolve) => answers.push(resolve));
  });
  return {
    ref: { showSnackbar } as unknown as SnackbarHostRef,
    showSnackbar,
    answer: (answer: Answer) => act(async () => answers.shift()?.(answer)),
  };
}

const content = (item: Item) => ({
  message: `Couldn't kill ${item.name}`,
  actionLabel: "Try again",
});
const frames = () => act(() => new Promise((resolve) => setTimeout(resolve, 100)));

async function render(onAction = jest.fn(), onDismiss = jest.fn()) {
  const hook = await renderHook(
    ({ shown }: { shown: Item | null }) => useSnackbar(shown, content, onAction, onDismiss),
    { initialProps: { shown: null as Item | null } },
  );
  return { ...hook, onAction, onDismiss };
}

const app = { name: "app" };
const web = { name: "web" };

it("shows the item, and Try again answers it", async () => {
  const page = host();
  const { result, rerender, onAction } = await render();

  await act(async () => result.current.attach(page.ref));
  await rerender({ shown: app });
  expect(page.showSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Couldn't kill app", actionLabel: "Try again" }),
  );

  await page.answer("actionPerformed");
  expect(onAction).toHaveBeenCalledWith(app);
});

it("replaces the snackbar of an item that is out of date, and ignores how that one ended", async () => {
  const first = host();
  const { result, rerender, onDismiss } = await render();

  await act(async () => result.current.attach(first.ref));
  await rerender({ shown: app });
  const generation = result.current.generation;
  await rerender({ shown: web });
  expect(result.current.generation).toBe(generation + 1);

  // The new host is not drawn yet, and shows once it is.
  const second = host(2);
  await act(async () => result.current.attach(second.ref));
  await first.answer("dismissed");
  await frames();
  expect(second.showSnackbar).toHaveBeenCalledTimes(3);
  expect(second.showSnackbar).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: "Couldn't kill web" }),
  );
  expect(onDismiss).not.toHaveBeenCalled();
});

it("moves to another host without being dismissed", async () => {
  const page = host();
  const search = host();
  const { result, rerender, onDismiss } = await render();

  await act(async () => result.current.attach(page.ref));
  await rerender({ shown: app });
  await act(async () => result.current.attach(search.ref));
  await page.answer("dismissed");

  expect(onDismiss).not.toHaveBeenCalled();
  expect(search.showSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Couldn't kill app" }),
  );
  await search.answer("dismissed");
  expect(onDismiss).toHaveBeenCalledWith(app);
});
