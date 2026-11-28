import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSearchExit, NAVIGATION_TIMEOUT_MS } from "./search-exit";

function setup() {
  const effects = { cover: vi.fn(), uncover: vi.fn() };
  return { effects, exit: createSearchExit(effects) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSearchExit", () => {
  it("lets only the first selection lead away, and covers Home at once", () => {
    const { effects, exit } = setup();
    expect(exit.select()).toBe(true);
    expect(effects.cover).toHaveBeenCalledOnce();
    expect(exit.select()).toBe(false);
    exit.blur(true);
    expect(exit.select()).toBe(false);
    expect(effects.cover).toHaveBeenCalledOnce();
  });

  it("uncovers Home once the next screen covers it, and takes no selection until focus", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur(true);
    exit.hidden();
    expect(effects.uncover).toHaveBeenCalledOnce();
    expect(exit.select()).toBe(false);
    exit.focus();
    expect(effects.uncover).toHaveBeenCalledOnce();
    expect(exit.select()).toBe(true);
  });

  it("uncovers Home when it has focus again before the next screen covers it", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur(true);
    exit.focus();
    expect(effects.uncover).toHaveBeenCalledOnce();
    expect(exit.select()).toBe(true);
  });

  it("uncovers Home when the selection leads nowhere", () => {
    const { effects, exit } = setup();
    exit.select();
    vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS - 1);
    expect(effects.uncover).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(effects.uncover).toHaveBeenCalledOnce();
    expect(exit.select()).toBe(true);
  });

  it("keeps Home covered while the navigation runs, whatever its length", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur(true);
    vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS * 10);
    expect(effects.uncover).not.toHaveBeenCalled();
  });

  it("uncovers Home on resume when the transition's events never came", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.blur(true);
    exit.resume();
    expect(effects.uncover).toHaveBeenCalledOnce();
  });

  it("keeps Home covered on resume while Home has focus", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.resume();
    expect(effects.uncover).not.toHaveBeenCalled();
  });

  it("uncovers nothing when Home goes away", () => {
    const { effects, exit } = setup();
    exit.select();
    exit.dispose();
    vi.advanceTimersByTime(NAVIGATION_TIMEOUT_MS);
    expect(effects.uncover).not.toHaveBeenCalled();
  });

  it("covers Home once for a navigation that is no selection while search is open", () => {
    const { effects, exit } = setup();
    exit.blur(true);
    expect(effects.cover).toHaveBeenCalledOnce();
    exit.hidden();
    expect(effects.uncover).toHaveBeenCalledOnce();
    exit.focus();
    expect(effects.uncover).toHaveBeenCalledOnce();
  });

  it("does nothing for a navigation while search is closed", () => {
    const { effects, exit } = setup();
    exit.blur(false);
    exit.hidden();
    exit.resume();
    exit.focus();
    expect(effects.uncover).not.toHaveBeenCalled();
    expect(effects.cover).not.toHaveBeenCalled();
  });
});
