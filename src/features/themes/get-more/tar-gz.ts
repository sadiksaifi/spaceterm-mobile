import { gunzipSync } from "fflate";

const BLOCK = 512;
const decoder = new TextDecoder();

/**
 * The files in a gzipped tar archive, by path without a leading `./`. It reads the ustar and GNU
 * formats, with GNU and pax long paths; folders and links are left out. Bytes that are not a
 * gzipped tar give null.
 */
export function extractTarGz(bytes: Uint8Array): Map<string, Uint8Array> | null {
  let tar: Uint8Array;
  try {
    tar = gunzipSync(bytes);
  } catch {
    return null;
  }

  const files = new Map<string, Uint8Array>();
  // A long path comes in an entry of its own, just before the file it names.
  let longPath: string | null = null;
  let offset = 0;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    if (!checksumMatches(header)) return null;

    const size = octal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] ?? 0);
    const data = tar.subarray(offset + BLOCK, offset + BLOCK + size);
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;

    if (type === "L") {
      longPath = text(data);
    } else if (type === "x") {
      longPath = paxPath(text(data)) ?? longPath;
    } else {
      const path = longPath ?? headerPath(header);
      longPath = null;
      if (type === "0" || type === "\0") files.set(path.replace(/^(\.\/)+/, ""), data.slice());
    }
  }
  return files;
}

/** The path in a header: the ustar prefix, if any, then the name. */
function headerPath(header: Uint8Array): string {
  const name = text(header.subarray(0, 100));
  const magic = text(header.subarray(257, 263));
  // GNU tar keeps other fields where ustar keeps the prefix.
  const prefix = magic === "ustar" ? text(header.subarray(345, 500)) : "";
  return prefix === "" ? name : `${prefix}/${name}`;
}

/** The `path` record of a pax header, such as `57 path=themes/…\n`. */
function paxPath(records: string): string | null {
  for (const record of records.split("\n")) {
    const match = /^\d+ path=(.*)$/.exec(record);
    if (match !== null) return match[1] ?? null;
  }
  return null;
}

/** The header's checksum: its bytes summed, with the checksum field read as spaces. */
function checksumMatches(header: Uint8Array): boolean {
  let sum = 0;
  for (let index = 0; index < BLOCK; index++) {
    sum += index >= 148 && index < 156 ? 32 : (header[index] ?? 0);
  }
  return sum === octal(header.subarray(148, 156));
}

const octal = (field: Uint8Array) => Number.parseInt(text(field).trim() || "0", 8);

/** A NUL-terminated field as text. */
function text(field: Uint8Array): string {
  const end = field.indexOf(0);
  return decoder.decode(end === -1 ? field : field.subarray(0, end));
}
