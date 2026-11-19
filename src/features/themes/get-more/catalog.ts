import type { TerminalTheme } from "@/shared/preferences/model";

import { extractTarGz } from "./tar-gz";
import { readZedThemes } from "./zed-theme";

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
  }) => Promise<TerminalTheme[] | "unavailable" | "no-themes">;
};

const API = "https://api.zed.dev/extensions";
/** The newest extension format SpaceTerm reads, and the range Zed's store serves for it. */
const SCHEMA = { min: "0", max: "1" } as const;
const WASM_API = { min: "0.0.0", max: "0.8.0" } as const;

/** Zed's extension store, reached with `fetch`. */
export function createZedCatalog(fetch: typeof globalThis.fetch = globalThis.fetch): ThemeCatalog {
  return {
    search: async (query) => {
      const params = new URLSearchParams({ provides: "themes", max_schema_version: SCHEMA.max });
      const filter = query.trim();
      if (filter !== "") params.set("filter", filter);
      try {
        const response = await fetch(`${API}?${params}`);
        if (!response.ok) return "unavailable";
        const body: unknown = await response.json();
        const data = isRecord(body) && Array.isArray(body.data) ? body.data : [];
        return data
          .flatMap(toExtension)
          .sort((first, second) => second.downloads - first.downloads);
      } catch {
        return "unavailable";
      }
    },
    themes: async (extension) => {
      const params = new URLSearchParams({
        min_schema_version: SCHEMA.min,
        max_schema_version: SCHEMA.max,
        min_wasm_api_version: WASM_API.min,
        max_wasm_api_version: WASM_API.max,
      });
      let bytes: Uint8Array;
      try {
        const response = await fetch(
          `${API}/${encodeURIComponent(extension.id)}/download?${params}`,
        );
        if (!response.ok) return "unavailable";
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch {
        return "unavailable";
      }
      const files = extractTarGz(bytes);
      if (files === null) return "no-themes";
      const decoder = new TextDecoder();
      const themes = [...files]
        .filter(([path]) => path.endsWith(".json"))
        .flatMap(([, file]) =>
          readZedThemes(decoder.decode(file), {
            kind: "extension",
            id: extension.id,
            name: extension.name,
          }),
        );
      return themes.length === 0 ? "no-themes" : themes;
    },
  };
}

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
        .map((author) => author.replace(/<[^>]*>/g, "").trim())
        .filter((author) => author !== "")
        .join(", "),
      downloads: typeof item.download_count === "number" ? item.download_count : 0,
    },
  ];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
