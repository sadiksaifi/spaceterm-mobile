import { describe, expect, it } from "vitest";

import { themeInUse } from "./in-use";
import { createPreferencesStore } from "./store";

const preferences = (appearance: "light" | "dark" | "automatic") => {
  const store = createPreferencesStore({ getItemSync: () => null, setItemSync: () => {} });
  store.setAppearance(appearance);
  return store.getSnapshot();
};

describe("the theme in use", () => {
  it("follows the system under Automatic", () => {
    expect(themeInUse(preferences("automatic"), "dark").name).toBe("SpaceTerm Dark");
    expect(themeInUse(preferences("automatic"), "light").name).toBe("SpaceTerm Light");
    expect(themeInUse(preferences("automatic"), null).name).toBe("SpaceTerm Light");
  });

  it("is the chosen appearance's theme whatever the system shows", () => {
    expect(themeInUse(preferences("light"), "dark").name).toBe("SpaceTerm Light");
    expect(themeInUse(preferences("dark"), "light").name).toBe("SpaceTerm Dark");
  });
});
