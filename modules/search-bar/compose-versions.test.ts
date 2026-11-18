import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

/** Each `androidx.compose.*` artifact a build.gradle depends on, with its version. */
function composeVersions(gradleFile: string): Map<string, string> {
  const gradle = readFileSync(gradleFile, "utf8");
  const versions = new Map<string, string>();
  for (const [, artifact, version] of gradle.matchAll(
    /['"](androidx\.compose\.[^:'"]+:[^:'"]+):([^'"]+)['"]/g,
  )) {
    versions.set(artifact, version);
  }
  return versions;
}

it("compiles against the Compose versions Expo UI uses", () => {
  const expoUi = composeVersions(
    join(dirname(require.resolve("@expo/ui/package.json")), "android/build.gradle"),
  );
  const ours = composeVersions(join(import.meta.dirname, "android/build.gradle"));

  expect(ours.size).toBeGreaterThan(0);
  for (const [artifact, version] of ours) {
    expect({ artifact, version }).toEqual({ artifact, version: expoUi.get(artifact) });
  }
});
