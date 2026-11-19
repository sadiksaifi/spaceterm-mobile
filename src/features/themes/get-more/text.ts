import { cased } from "@/shared/text";

export const text = {
  title: cased("Get More Themes", "Get more themes"),
  close: "Close",
  intro: "Get a theme made for Zed, then select it in Themes.",
  importFromFile: cased("Import from File…", "Import from file"),
  /** The iOS search field placeholder; the toolbar has no room for more. */
  search: "Search",
  searchThemes: "Search themes",
  clearText: "Clear text",
  get: "Get",
  getLabel: (name: string) => `Get ${name}`,
  installing: (name: string) => `Installing ${name}`,
  remove: "Remove",
  removeLabel: (name: string) => `Remove ${name}`,
  details: (author: string, downloads: number) =>
    author === ""
      ? `${downloadCount(downloads)} downloads`
      : `${author} · ${downloadCount(downloads)} downloads`,
  loading: "Loading",
  unavailableTitle: cased("Couldn’t Load Themes", "Couldn’t load themes"),
  checkConnection: "Check your internet connection.",
  tryAgain: cased("Try Again", "Try again"),
  /** iOS sets a name in an alert title in quotation marks; Android does not. */
  removeTitle: (name: string) => cased(`Remove “${name}”?`, `Remove ${name}?`),
  removeBody: "This removes its themes from this device.",
  cancel: "Cancel",
  noResults: (query: string) => cased(`No Results for “${query}”`, `No results for ${query}`),
  noResultsBody: "Check the spelling or try a new search.",
  getFailed: (name: string) => cased(`Couldn’t Get “${name}”`, `Couldn’t get ${name}`),
  noThemes: "It has no theme SpaceTerm can use.",
  importFailed: (file: string) => cased(`Couldn’t Import “${file}”`, `Couldn’t import ${file}`),
  notATheme: "The file is not a Zed theme.",
};

const UNITS = ["", "K", "M", "B"] as const;

/** A download count as the store lists it: 950, 1.2K, 517K, 1.2M. */
export function downloadCount(count: number): string {
  let value = count;
  let unit = 0;
  while (unit < UNITS.length - 1 && round(value) >= 1000) {
    value /= 1000;
    unit++;
  }
  return `${round(value)}${UNITS[unit]}`;
}

/** One decimal below ten, none above; a trailing .0 is dropped. */
const round = (value: number) => (value < 10 ? Math.round(value * 10) / 10 : Math.round(value));
