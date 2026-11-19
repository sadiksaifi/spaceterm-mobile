import { beforeEach, describe, expect, it, vi } from "vitest";

import { pickThemeFile } from "./pick-file";

/** Desktop reads a theme family of at most 4 MiB. */
const LIMIT = 4 * 1024 * 1024;

/** What the picker hands over next, and what the device's files hold, by URI. */
const device = vi.hoisted(() => ({
  picked: null as { uri: string; name: string; size: number | null } | null,
  files: new Map<string, Uint8Array>(),
  /** Whole reads, which have no limit. */
  wholeReads: 0,
  deleted: [] as string[],
}));

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: async () =>
    device.picked === null
      ? { canceled: true, assets: null }
      : { canceled: false, assets: [device.picked] },
}));

vi.mock("expo-file-system", () => ({
  FileMode: { ReadOnly: "r" },
  File: class {
    constructor(private readonly uri: string) {}
    get exists() {
      return device.files.has(this.uri);
    }
    private get bytes() {
      const bytes = device.files.get(this.uri);
      if (bytes === undefined) throw new Error("No such file");
      return bytes;
    }
    async text() {
      device.wholeReads++;
      return new TextDecoder().decode(this.bytes);
    }
    open() {
      const bytes = this.bytes;
      return { readBytes: async (length: number) => bytes.slice(0, length), close: () => {} };
    }
    delete() {
      device.files.delete(this.uri);
      device.deleted.push(this.uri);
    }
  },
}));

/** A document the picker offers, `length` bytes long, with the size its provider reports. */
function pickDocument(uri: string, length: number, size: number | null) {
  device.files.set(uri, new Uint8Array(length).fill(0x20));
  device.picked = { uri, name: "theme.json", size };
}

beforeEach(() => {
  device.picked = null;
  device.files.clear();
  device.wholeReads = 0;
  device.deleted = [];
});

describe("picking a theme file", () => {
  it("reads a document of unknown size no further than one byte past the limit", async () => {
    // Only the outcome is compared: a diff of 4 MiB of text would take minutes to print.
    const outcome = async () => {
      const picked = await pickThemeFile();
      return picked?.kind === "failed" ? picked.reason : picked?.kind;
    };
    pickDocument("content://docs/1", LIMIT + 1, null);
    expect(await outcome()).toBe("too-large");

    pickDocument("content://docs/2", LIMIT, null);
    expect(await outcome()).toBe("read");

    expect(device.wholeReads).toBe(0);
  });

  it("refuses a document whose reported size is past the limit without reading it", async () => {
    pickDocument("content://docs/3", 10, LIMIT + 1);

    expect(await pickThemeFile()).toMatchObject({ kind: "failed", reason: "too-large" });
    expect(device.wholeReads).toBe(0);
  });

  it("deletes the copy iOS hands over, and never the person's own document", async () => {
    pickDocument("file:///tmp/theme.json", 2, 2);
    expect(await pickThemeFile()).toEqual({ kind: "read", name: "theme.json", text: "  " });

    pickDocument("content://docs/4", 2, 2);
    await pickThemeFile();

    expect(device.deleted).toEqual(["file:///tmp/theme.json"]);
  });

  it("gives nothing when the person cancels", async () => {
    expect(await pickThemeFile()).toBeNull();
  });
});
