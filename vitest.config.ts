import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // The aliases in tsconfig.json, most specific first.
  resolve: {
    alias: [
      { find: /^@\/modules\//, replacement: path("./modules/") },
      { find: /^@\/assets\//, replacement: path("./assets/") },
      { find: /^@\//, replacement: path("./src/") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts", "modules/**/*.test.ts"],
  },
});
