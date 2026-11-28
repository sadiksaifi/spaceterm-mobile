/**
 * How long a selection waits for Home to lose focus. Without it, the navigation did not happen,
 * and Home shows and takes input again.
 */
export const NAVIGATION_TIMEOUT_MS = 1000;

export type SearchExitEffects = {
  /** Closes search at once and leaves a picture of it over Home, which takes no touch under it. */
  cover: () => void;
  /** Removes the picture from Home. */
  uncover: () => void;
};

/**
 * Leaving Home from search: the first selection wins, and search closes at once behind a picture
 * of itself, so Home never shows before the next screen covers it. Home's events drive it in the
 * order the stack sends them.
 */
export type SearchExit = {
  /** A result was selected. Returns whether it may lead away; only the first does. */
  select: () => boolean;
  /** Home lost focus: a navigation started. `searching` is whether search is open. */
  blur: (searching: boolean) => void;
  /** Home's transition to the next screen ended, so that screen covers Home. */
  hidden: () => void;
  /** Home has focus again. */
  focus: () => void;
  /** The app came back to the foreground. */
  resume: () => void;
  /** Home is going away. */
  dispose: () => void;
};

export function createSearchExit(effects: SearchExitEffects): SearchExit {
  let focused = true;
  /** A selection leads away, so later ones do nothing. */
  let leaving = false;
  let covered = false;
  let navigationTimer: ReturnType<typeof setTimeout> | undefined;

  const stopTimer = () => {
    clearTimeout(navigationTimer);
    navigationTimer = undefined;
  };
  const uncover = () => {
    if (!covered) return;
    covered = false;
    effects.uncover();
  };
  // Home shows again, so it takes selections again without the picture.
  const release = () => {
    stopTimer();
    leaving = false;
    uncover();
  };

  return {
    select: () => {
      if (leaving || !focused) return false;
      leaving = true;
      covered = true;
      effects.cover();
      navigationTimer = setTimeout(release, NAVIGATION_TIMEOUT_MS);
      return true;
    },
    blur: (searching) => {
      focused = false;
      stopTimer();
      // Every navigation ends search, not only a selection: an Invitation Link opened in another
      // app, for example, opens Add Machine over Home.
      if (searching && !covered) {
        covered = true;
        effects.cover();
      }
    },
    hidden: () => {
      if (!focused) uncover();
    },
    focus: () => {
      focused = true;
      release();
    },
    // Android can skip the transition's events, for example when the app goes to the background
    // during it. An unfocused Home is under the next screen once the app is back.
    resume: () => {
      if (!focused) uncover();
    },
    dispose: stopTimer,
  };
}
