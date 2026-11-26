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
        usePanePreviews({ panePreviews }, "mac", ["a", "b"], reading),
      { initialProps: { reading: true } },
    );
    await act(async () => {});
    expect(result.current).toEqual({ a: screen("a1"), b: screen("b1") });

    await act(async () => {
      jest.advanceTimersByTime(PREVIEW_EVERY);
    });
    expect(panePreviews).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ a: screen("a2"), b: screen("b1") });

    await rerender({ reading: false });
    await act(async () => {
      jest.advanceTimersByTime(PREVIEW_EVERY * 3);
    });
    expect(panePreviews).toHaveBeenCalledTimes(2);
  });
});
