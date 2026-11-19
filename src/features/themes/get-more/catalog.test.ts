import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createZedCatalog, MAX_ARCHIVE } from "./catalog";

const archive = readFileSync(new URL("./fixtures/extension.tar.gz", import.meta.url));

/** A fetch that answers from `routes`, by URL, and records the URLs it was asked for. */
function fakeFetch(routes: Record<string, () => Response>) {
  const asked: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = String(input);
    asked.push(url);
    const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    if (route === undefined) throw new TypeError("Network request failed");
    return route[1]();
  };
  return { fetch: fetch as typeof globalThis.fetch, asked };
}

const LIST = "https://api.zed.dev/extensions?";
const DOWNLOAD = "https://api.zed.dev/extensions/paper/download?";

describe("Zed's theme catalog", () => {
  it("lists theme extensions by downloads, with their authors' names", async () => {
    const { fetch, asked } = fakeFetch({
      [LIST]: () =>
        Response.json({
          data: [
            {
              id: "github-theme",
              name: "Github Theme",
              authors: ["Pyae Sone Aung", "Clay Tercek <clay@example.com>"],
              download_count: 304_118,
            },
            {
              id: "catppuccin",
              name: "Catppuccin",
              authors: ["Catppuccin <releases@catppuccin.com>"],
              download_count: 1_233_350,
            },
          ],
        }),
    });

    const result = await createZedCatalog(fetch).search("  git ");

    expect(result).toEqual([
      { id: "catppuccin", name: "Catppuccin", author: "Catppuccin", downloads: 1_233_350 },
      {
        id: "github-theme",
        name: "Github Theme",
        author: "Pyae Sone Aung, Clay Tercek",
        downloads: 304_118,
      },
    ]);
    const url = new URL(asked[0] ?? "");
    expect(url.searchParams.get("provides")).toBe("themes");
    expect(url.searchParams.get("filter")).toBe("git");
  });

  it("leaves out authors' email addresses however they are written", async () => {
    const { fetch } = fakeFetch({
      [LIST]: () =>
        Response.json({
          data: [
            {
              id: "nord",
              name: "Nord",
              authors: [
                "Evgenii Kislichenko (evgenii@example.com)",
                "Ana [ana@example.org]",
                "only@example.net",
                "Kai Lee",
              ],
              download_count: 1,
            },
          ],
        }),
    });

    const result = await createZedCatalog(fetch).search("");

    expect(Array.isArray(result) && result[0]?.author).toBe("Evgenii Kislichenko, Ana, Kai Lee");
  });

  it("asks for every theme extension when the search is empty", async () => {
    const { fetch, asked } = fakeFetch({ [LIST]: () => Response.json({ data: [] }) });
    await createZedCatalog(fetch).search("");
    expect(new URL(asked[0] ?? "").searchParams.has("filter")).toBe(false);
  });

  it("is unavailable when the store cannot be reached or answers with an error", async () => {
    const offline = fakeFetch({});
    expect(await createZedCatalog(offline.fetch).search("")).toBe("unavailable");

    const failing = fakeFetch({ [LIST]: () => new Response("Bad Gateway", { status: 502 }) });
    expect(await createZedCatalog(failing.fetch).search("")).toBe("unavailable");
  });

  it("gets every theme in an extension's archive", async () => {
    const { fetch } = fakeFetch({ [DOWNLOAD]: () => new Response(archive) });

    const result = await createZedCatalog(fetch).themes({ id: "paper", name: "Paper" });

    expect(result).not.toBe("unavailable");
    expect(result).not.toBe("no-themes");
    expect(Array.isArray(result) && result.map((theme) => theme.id)).toEqual(["paper/Paper Light"]);
    expect(Array.isArray(result) && result[0]?.source).toEqual({
      kind: "extension",
      id: "paper",
      name: "Paper",
    });
  });

  it("refuses an archive larger than any theme extension, declared or not", async () => {
    const declared = fakeFetch({
      [DOWNLOAD]: () =>
        new Response("", { headers: { "content-length": String(MAX_ARCHIVE + 1) } }),
    });
    expect(await createZedCatalog(declared.fetch).themes({ id: "paper", name: "Paper" })).toBe(
      "too-large",
    );

    const undeclared = fakeFetch({
      [DOWNLOAD]: () => new Response(new Uint8Array(MAX_ARCHIVE + 1)),
    });
    expect(await createZedCatalog(undeclared.fetch).themes({ id: "paper", name: "Paper" })).toBe(
      "too-large",
    );
  });

  it("stops a download once it runs past the limit, without reading the rest", async () => {
    let pulled = 0;
    let signal: AbortSignal | undefined;
    const endless = async (_url: string, init?: { signal?: AbortSignal }) => {
      signal = init?.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          pull: (controller) => {
            pulled++;
            controller.enqueue(new Uint8Array(1024 * 1024));
          },
        }),
      );
    };

    expect(await createZedCatalog(endless).themes({ id: "paper", name: "Paper" })).toBe(
      "too-large",
    );
    expect(pulled * 1024 * 1024).toBeLessThan(MAX_ARCHIVE + 4 * 1024 * 1024);
    expect(signal?.aborted).toBe(true);
  });

  it("tells an archive with no theme from a download that failed", async () => {
    const empty = fakeFetch({ [DOWNLOAD]: () => new Response("not an archive") });
    expect(await createZedCatalog(empty.fetch).themes({ id: "paper", name: "Paper" })).toBe(
      "no-themes",
    );

    const offline = fakeFetch({});
    expect(await createZedCatalog(offline.fetch).themes({ id: "paper", name: "Paper" })).toBe(
      "unavailable",
    );
  });
});
