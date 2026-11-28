import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSearchExit, FALLBACK_MS, NAVIGATION_TIMEOUT_MS } from "./search-exit";

function setup() {
  const effects = { fadeOut: vi.fn(), collapse: vi.fn(), setLeaving: vi.fn() };
  return { effects, exit: createSearchExit(effects) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSearchExit", () => {
  it("lets only the first selection lead away", () => {
    const { effects, exit } = setup();
    expect(exit.select()).toBe(true);
    expect(exit.select()).toBe(false);
    exit.blur();
    expect(exit.select()).toBe(false);
    expect(effects.setLeaving.mock.calls).toEqual([[true]]);
  });

  it("fades search out once Home's transition starts, and never closes it at once", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur();
    exit.coverStart();
    vi.advanceTimersByTime(FALLBACK_MS * 2);
    expect(effects.fadeOut).toHaveBeenCalledOnce();
    expect(effects.collapse).not.toHaveBeenCalled();
  });

  it("takes selections again when Home has focus again", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur();
    exit.coverStart();
    exit.focus();
    expect(effects.setLeaving).toHaveBeenLastCalledWith(false);
    expect(exit.select()).toBe(true);
  });

  it("takes selections again when the selection leads nowhere", () => {
    const { effects, exit } = setup();
    exit.select();
    vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS - 1);
    expect(exit.select()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(effects.setLeaving).toHaveBeenLastCalledWith(false);
    expect(exit.select()).toBe(true);
  });

  it("closes search when Home's transition never starts", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur();
    vi.advanceTimersByTime(FALLBACK_MS - 1);
    expect(effects.collapse).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(effects.collapse).toHaveBeenCalledOnce();
    expect(effects.fadeOut).not.toHaveBeenCalled();
  });

  it("closes search on resume when Home's transition never started", () => {
    const { effects, exit } = setup();
    exit.blur();
    exit.resume();
    expect(effects.collapse).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(FALLBACK_MS);
    expect(effects.collapse).toHaveBeenCalledOnce();
  });

  it("leaves search alone on resume while Home has focus", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.resume();
    expect(effects.collapse).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS);
    expect(exit.select()).toBe(true);
  });

  it("closes nothing after Home has focus again or goes away", () => {
    const refocused = setup();
    refocused.exit.blur();
    refocused.exit.focus();
    const disposed = setup();
    disposed.exit.blur();
    disposed.exit.dispose();
    vi.advanceTimersByTime(FALLBACK_MS);
    expect(refocused.effects.collapse).not.toHaveBeenCalled();
    expect(disposed.effects.collapse).not.toHaveBeenCalled();
  });
});
