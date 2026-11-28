/**
 * How long a selection waits for Home to lose focus. Without it, the navigation did not happen
 * and the results take input again.
 */
export const NAVIGATION_TIMEOUT_MS = 1000;

/**
 * How long after Home loses focus the search closes when Home's transition never starts. Android
 * can cancel the transition, for example when the app goes to the background, and report nothing.
 */
export const FALLBACK_MS = 1500;

export type SearchExitEffects = {
  /** Fades the search out over the next screen once that screen covers Home. */
  fadeOut: () => void;
  /** Closes the search at once. */
  collapse: () => void;
  /** Whether a selection is leaving Home, so the results take no input. */
  setLeaving: (leaving: boolean) => void;
};

/**
 * Leaving Home from search: the first selection wins, and search closes over the screen that
 * opens. Home's events drive it in the order the stack sends them.
 */
export type SearchExit = {
  /** A result was selected. Returns whether it may lead away; only the first does. */
  select: () => boolean;
  /** Home lost focus: a navigation started. */
  blur: () => void;
  /** Home's transition to the next screen started. */
  coverStart: () => void;
  /** Home has focus again. */
  focus: () => void;
  /** The app came back to the foreground. */
  resume: () => void;
  /** Home is going away. */
  dispose: () => void;
};

export function createSearchExit(effects: SearchExitEffects): SearchExit {
  let leaving = false;
  let focused = true;
  /** Home lost focus and its transition has not started. */
  let uncovered = false;
  let navigationTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  const setLeaving = (next: boolean) => {
    if (leaving === next) return;
    leaving = next;
    effects.setLeaving(next);
  };
  const clearTimers = () => {
    clearTimeout(navigationTimer);
    clearTimeout(fallbackTimer);
    navigationTimer = undefined;
    fallbackTimer = undefined;
  };
  const fallBack = () => {
    clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
    if (focused || !uncovered) return;
    uncovered = false;
    effects.collapse();
  };

  return {
    select: () => {
      if (leaving || !focused) return false;
      setLeaving(true);
      navigationTimer = setTimeout(() => {
        navigationTimer = undefined;
        if (focused) setLeaving(false);
      }, NAVIGATION_TIMEOUT_MS);
      return true;
    },
    blur: () => {
      focused = false;
      uncovered = true;
      clearTimers();
      fallbackTimer = setTimeout(fallBack, FALLBACK_MS);
    },
    coverStart: () => {
      if (focused) return;
      uncovered = false;
      clearTimers();
      effects.fadeOut();
    },
    focus: () => {
      focused = true;
      uncovered = false;
      clearTimers();
      setLeaving(false);
    },
    resume: fallBack,
    dispose: clearTimers,
  };
}
