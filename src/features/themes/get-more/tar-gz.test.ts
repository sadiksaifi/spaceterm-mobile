import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { extractTarGz } from "./tar-gz";

/** Made with `tar --format gnutar -czf`, as Zed's extension store makes its archives. */
const archive = new Uint8Array(
  readFileSync(new URL("./fixtures/extension.tar.gz", import.meta.url)),
);
const long =
  "themes/a-folder-whose-name-is-long-enough-that-the-whole-path-passes-one-hundred-characters/deep.json";

describe("extracting a .tar.gz", () => {
  it("gives each file by its path, long ones included", () => {
    const files = extractTarGz(archive);
    const text = (path: string) => {
      const bytes = files?.get(path);
      return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
    };

    expect([...(files?.keys() ?? [])].sort()).toEqual([
      "extension.toml",
      long,
      "themes/paper.json",
    ]);
    expect(text("themes/paper.json")).toBe('{"name": "Paper", "themes": []}\n');
    expect(text(long)).toBe("deep\n");
  });

  it("gives nothing for bytes that are not a .tar.gz", () => {
    expect(extractTarGz(new TextEncoder().encode("<html>Not Found</html>"))).toBeNull();
  });
});
