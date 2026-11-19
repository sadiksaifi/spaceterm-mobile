import { readFileSync } from "node:fs";

import { gunzipSync, gzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { extractTarGz } from "./tar-gz";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
/** Made with `tar --format gnutar -czf`, as Zed's extension store makes its archives. */
const archive = fixture("extension.tar.gz");

/** The archive with its first header's size field set to `size`, the checksum kept valid. */
function withFirstSize(size: string): Uint8Array {
  const tar = gunzipSync(archive).slice();
  tar.set(new TextEncoder().encode(size.padEnd(11, " ") + "\0"), 124);
  tar.fill(32, 148, 156);
  const sum = tar.subarray(0, 512).reduce((total, byte) => total + byte, 0);
  tar.set(new TextEncoder().encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
  return gzipSync(tar);
}
/** A gzipped tar archive of `entries`, each a header of `type` and `name` followed by `data`. */
function archiveOf(entries: { type: string; name: string; data: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const blocks: number[] = [];
  for (const { type, name, data } of entries) {
    const bytes = encoder.encode(data);
    const header = new Uint8Array(512);
    header.set(encoder.encode(name), 0);
    header.set(encoder.encode(`${bytes.length.toString(8).padStart(11, "0")}\0`), 124);
    header.fill(32, 148, 156);
    header.set(encoder.encode(type), 156);
    header.set(encoder.encode("ustar\u000000"), 257);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.set(encoder.encode(`${sum.toString(8).padStart(6, "0")}\0 `), 148);
    blocks.push(...header, ...bytes, ...new Uint8Array((512 - (bytes.length % 512)) % 512));
  }
  return gzipSync(new Uint8Array([...blocks, ...new Uint8Array(1024)]));
}

/** A pax record, its length in bytes counting the digits that give it. */
function paxRecord(key: string, value: string): string {
  const rest = new TextEncoder().encode(` ${key}=${value}\n`).length;
  let length = rest + 1;
  while (String(length).length + rest !== length) length++;
  return `${length} ${key}=${value}\n`;
}

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
    expect(text("extension.toml")).toBe('id = "paper"\nname = "Paper"\n');
    expect(text(long)).toBe("deep\n");
  });

  it("reads the long paths of pax and ustar archives too", () => {
    for (const name of ["extension-pax.tar.gz", "extension-ustar.tar.gz"]) {
      const paths = [...(extractTarGz(fixture(name))?.keys() ?? [])].sort();
      expect(paths).toEqual(["extension.toml", long, "themes/paper.json"]);
    }
  });

  it("reads a pax path whole, newlines and other records included", () => {
    const path = "themes/papér\nlight.json";
    const files = extractTarGz(
      archiveOf([
        { type: "x", name: "PaxHeader", data: paxRecord("mtime", "1.5") + paxRecord("path", path) },
        { type: "0", name: "short.json", data: "{}" },
      ]),
    );

    expect([...(files?.keys() ?? [])]).toEqual([path]);
  });

  it("gives nothing for bytes that are not a .tar.gz", () => {
    expect(extractTarGz(new TextEncoder().encode("<html>Not Found</html>"))).toBeNull();
  });

  it("gives nothing for an archive whose header is damaged or names an impossible size", () => {
    const tar = gunzipSync(archive).slice();
    tar[0] = 0x58;
    expect(extractTarGz(gzipSync(tar))).toBeNull();
    expect(extractTarGz(withFirstSize("-1000"))).toBeNull();
    expect(extractTarGz(withFirstSize("77777777777"))).toBeNull();
  });

  it("gives nothing for an archive damaged in transit or cut short", () => {
    const corrupt = archive.slice();
    corrupt[corrupt.length - 8] = (corrupt[corrupt.length - 8] ?? 0) ^ 0xff;
    expect(extractTarGz(corrupt)).toBeNull();

    const tar = gunzipSync(archive);
    // Cut partway into the second header, then at the end of the last file, before tar's end.
    const firstSize = Number.parseInt(new TextDecoder().decode(tar.subarray(124, 135)), 8);
    const second = 512 + Math.ceil(firstSize / 512) * 512;
    expect(extractTarGz(gzipSync(tar.subarray(0, second + 100)))).toBeNull();
    expect(extractTarGz(gzipSync(tar.subarray(0, second)))).toBeNull();

    // Cut after the first of the two zero blocks that end it.
    let end = 0;
    for (let offset = 0; offset + 512 <= tar.length;) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every((byte) => byte === 0)) {
        end = offset;
        break;
      }
      const size = Number.parseInt(new TextDecoder().decode(header.subarray(124, 135)), 8);
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    expect(extractTarGz(gzipSync(tar.subarray(0, end + 512)))).toBeNull();
    expect(extractTarGz(gzipSync(tar.subarray(0, end + 1024)))).not.toBeNull();
  });

  it("gives nothing for an archive whose unpacked size is not the one it records", () => {
    const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.length - 4, 4);
    const claimsMore = archive.slice();
    view(claimsMore).setUint32(0, view(archive).getUint32(0, true) + 512, true);
    expect(extractTarGz(claimsMore)).toBeNull();

    // A longer archive under the original's size and CRC.
    const tar = gunzipSync(archive);
    const longer = gzipSync(new Uint8Array([...tar, ...new Uint8Array(1024)]));
    longer.set(archive.subarray(archive.length - 8), longer.length - 8);
    expect(extractTarGz(longer)).toBeNull();
  });

  it("refuses an archive that unpacks to more than any theme extension", () => {
    // 33 MiB of zeros is an empty tar archive, so only the size refuses it.
    expect(extractTarGz(gzipSync(new Uint8Array(33 * 1024 * 1024)))).toBeNull();
  });
});
