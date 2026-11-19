import type { TerminalTheme } from "@/shared/preferences/model";

import { extractTarGz } from "./tar-gz";
import { MAX_THEMES, readZedThemes } from "./zed-theme";

/** A theme extension in Zed's store. Getting it adds every theme it holds. */
export type CatalogExtension = {
  id: string;
  name: string;
  /** Its authors' names, without their email addresses. */
  author: string;
  downloads: number;
};

export type ThemeCatalog = {
  /** The theme extensions whose name matches `query`, most downloaded first. */
  search: (query: string) => Promise<CatalogExtension[] | "unavailable">;
  /** Every theme in an extension: "no-themes" when it holds none SpaceTerm can read. */
  themes: (extension: {
    id: string;
    name: string;
  }) => Promise<TerminalTheme[] | "unavailable" | "no-themes" | "too-large">;
};

const API = "https://api.zed.dev/extensions";
/** The newest extension format SpaceTerm reads, and the range Zed's store serves for it. */
const SCHEMA = { min: "0", max: "1" } as const;
const WASM_API = { min: "0.0.0", max: "0.8.0" } as const;
/** The largest archive SpaceTerm downloads; a theme extension is far smaller. */
export const MAX_ARCHIVE = 16 * 1024 * 1024;
/**
 * How long a search or a download may take, body included. React Native's Android network client
 * has no read timeout, so a store that stops answering would otherwise leave it under way.
 */
const DEADLINE = 30_000;

/** A request that is stopped when it runs past the deadline, or when `abort` is called. */
function deadlined() {
  const request = new AbortController();
  const timer = setTimeout(() => request.abort(), DEADLINE);
  return {
    signal: request.signal,
    abort: () => request.abort(),
    finish: () => clearTimeout(timer),
  };
}

/** A fetch that streams a body and stops its request when aborted, as `expo/fetch` does. */
export type Fetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  headers: { get: (name: string) => string | null };
  body: ReadableStream<Uint8Array> | null;
  json: () => Promise<unknown>;
}>;

/** Zed's extension store, reached with `fetch`. */
export function createZedCatalog(fetch: Fetch): ThemeCatalog {
  return {
    search: async (query) => {
      const params = new URLSearchParams({ provides: "themes", max_schema_version: SCHEMA.max });
      const filter = query.trim();
      if (filter !== "") params.set("filter", filter);
      const request = deadlined();
      try {
        const response = await fetch(`${API}?${params}`, { signal: request.signal });
        if (!response.ok) return "unavailable";
        const body: unknown = await response.json();
        const data = isRecord(body) && Array.isArray(body.data) ? body.data : [];
        return data
          .flatMap(toExtension)
          .sort((first, second) => second.downloads - first.downloads);
      } catch {
        return "unavailable";
      } finally {
        request.finish();
      }
    },
    themes: async (extension) => {
      const params = new URLSearchParams({
        min_schema_version: SCHEMA.min,
        max_schema_version: SCHEMA.max,
        min_wasm_api_version: WASM_API.min,
        max_wasm_api_version: WASM_API.max,
      });
      // Also stops the download when it is refused before its end.
      const request = deadlined();
      let bytes: Uint8Array | "too-large" | "unavailable";
      try {
        const response = await fetch(
          `${API}/${encodeURIComponent(extension.id)}/download?${params}`,
          { signal: request.signal },
        );
        bytes = !response.ok
          ? "unavailable"
          : Number(response.headers.get("content-length") ?? 0) > MAX_ARCHIVE
            ? "too-large"
            : await readAtMost(response.body, MAX_ARCHIVE, request.signal);
      } catch {
        bytes = "unavailable";
      } finally {
        request.finish();
      }
      if (typeof bytes === "string") {
        request.abort();
        return bytes;
      }
      const files = extractTarGz(bytes);
      if (files === null) return "no-themes";
      const decoder = new TextDecoder();
      const origin = { kind: "extension", id: extension.id, name: extension.name } as const;
      const themes: TerminalTheme[] = [];
      for (const [path, file] of files) {
        if (!path.endsWith(".json")) continue;
        // The room left is shared by every file, so the extension's themes stop one past it.
        themes.push(...readZedThemes(decoder.decode(file), origin, MAX_THEMES - themes.length));
        if (themes.length > MAX_THEMES) return "too-large";
      }
      return themes.length === 0 ? "no-themes" : themes;
    },
  };
}

/**
 * The whole body, "too-large" as soon as it runs past `limit` bytes, or "unavailable" when
 * `signal` stops it first.
 */
async function readAtMost(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
): Promise<Uint8Array | "too-large" | "unavailable"> {
  if (body === null) return "unavailable";
  const reader = body.getReader();
  // Canceling ends a read under way, which then looks like the body's end.
  signal.addEventListener("abort", () => void reader.cancel().catch(() => {}), { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.length;
    if (size > limit) {
      void reader.cancel().catch(() => {});
      return "too-large";
    }
    chunks.push(read.value);
  }
  if (signal.aborted) return "unavailable";
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/** An email address, bare or in angle brackets, parentheses or square brackets. */
const EMAIL = /<[^>]*>|\([^)]*@[^)]*\)|\[[^\]]*@[^\]]*\]|\S+@\S+/g;

function toExtension(item: unknown): CatalogExtension[] {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
  const authors = Array.isArray(item.authors) ? item.authors : [];
  return [
    {
      id: item.id,
      name: item.name,
      author: authors
        .filter((author): author is string => typeof author === "string")
        // "Catppuccin <releases@catppuccin.com>" names Catppuccin.
        .map((author) => author.replace(EMAIL, "").trim())
        .filter((author) => author !== "")
        .join(", "),
      downloads: typeof item.download_count === "number" ? item.download_count : 0,
    },
  ];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
