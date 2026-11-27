import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import type { MachineClient, PaneScreen } from "@/shared/machines/model";

import { PREVIEW_EVERY, usePanePreviews } from "./use-pane-previews";

const screen = (text: string): PaneScreen => ({
  rows: [
    [
      {
        text,
        foreground: null,
        background: null,
        inverse: false,
        bold: false,
        faint: false,
        italic: false,
        underline: false,
        strikethrough: false,
      },
    ],
  ],
});

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("Pane previews", () => {
  it("reads the screens again while reading, keeping one a read leaves out", async () => {
    const panePreviews = jest.fn<MachineClient["panePreviews"]>();
    panePreviews
      .mockResolvedValueOnce({ a: screen("a1"), b: screen("b1") })
      .mockResolvedValueOnce({ a: screen("a2") });
    const { result, rerender } = await renderHook(
      ({ reading }: { reading: boolean }) =>
        usePanePreviews({ panePreviews }, [{ machineId: "mac", panes: ["a", "b"] }], reading),
      { initialProps: { reading: true } },
    );
    await act(async () => {});
    expect(result.current).toEqual({ mac: { a: screen("a1"), b: screen("b1") } });

    await act(async () => {
      jest.advanceTimersByTime(PREVIEW_EVERY);
    });
    expect(panePreviews).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ mac: { a: screen("a2"), b: screen("b1") } });

    await rerender({ reading: false });
    await act(async () => {
      jest.advanceTimersByTime(PREVIEW_EVERY * 3);
    });
    expect(panePreviews).toHaveBeenCalledTimes(2);
  });

  it("starts a read only once the one under way answers", async () => {
    let answer: (screens: Record<string, PaneScreen>) => void = () => {};
    const panePreviews = jest.fn<MachineClient["panePreviews"]>();
    panePreviews
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
      .mockResolvedValue({ c: screen("c1") });
    const { result, rerender } = await renderHook(
      ({ panes }: { panes: string[] }) =>
        usePanePreviews({ panePreviews }, [{ machineId: "mac", panes }], true),
      { initialProps: { panes: ["a"] } },
    );

    await rerender({ panes: ["c"] });
    expect(panePreviews).toHaveBeenCalledTimes(1);

    await act(async () => answer({ a: screen("a1") }));
    expect(panePreviews).toHaveBeenLastCalledWith("mac", ["c"]);
    expect(result.current).toEqual({ mac: { c: screen("c1") } });
  });

  it("reads each Machine's Panes from that Machine and keeps their screens apart", async () => {
    const panePreviews = jest.fn<MachineClient["panePreviews"]>(async (machineId, panes) =>
      Object.fromEntries(panes.map((pane) => [pane, screen(`${machineId} ${pane}`)])),
    );
    const { result } = await renderHook(() =>
      usePanePreviews(
        { panePreviews },
        [
          { machineId: "mac", panes: ["a"] },
          { machineId: "box", panes: ["a"] },
          { machineId: "mac", panes: ["b"] },
        ],
        true,
      ),
    );
    await act(async () => {});

    expect(panePreviews).toHaveBeenCalledTimes(2);
    expect(panePreviews).toHaveBeenCalledWith("mac", ["a", "b"]);
    expect(panePreviews).toHaveBeenCalledWith("box", ["a"]);
    expect(result.current).toEqual({
      mac: { a: screen("mac a"), b: screen("mac b") },
      box: { a: screen("box a") },
    });
  });
});
