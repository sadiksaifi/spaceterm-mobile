import { Gunzip } from "fflate";

const BLOCK = 512;
/** Theme extensions are kilobytes; an archive that unpacks to more is refused as it unpacks. */
const MAX_UNPACKED = 32 * 1024 * 1024;
/** The archive is unpacked this many bytes at a time, so a refused one stops soon after the limit. */
const SLICE = 16 * 1024;
const decoder = new TextDecoder();

/**
 * The files in a gzipped tar archive, by path without a leading `./`. It reads the ustar and GNU
 * formats, with GNU and pax long paths; folders and links are left out. Bytes that are not a
 * gzipped tar give null.
 */
export function extractTarGz(bytes: Uint8Array): Map<string, Uint8Array> | null {
  const tar = gunzip(bytes);
  if (tar === null) return null;

  const files = new Map<string, Uint8Array>();
  // A long path comes in an entry of its own, just before the file it names.
  let longPath: string | null = null;
  let offset = 0;
  // An archive ends with a block of zeros; one that stops before it was cut short.
  let ended = false;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) {
      ended = true;
      break;
    }
    if (!checksumMatches(header)) return null;

    const size = octal(header.subarray(124, 136));
    // A size that is not a whole count, or runs past the archive, means it is damaged.
    if (!Number.isSafeInteger(size) || size < 0 || offset + BLOCK + size > tar.length) {
      return null;
    }
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
  return ended ? files : null;
}

/**
 * What gzip packs, or null when it is damaged or unpacks past the limit. gzip ends with the CRC-32
 * of what it packs, then its size modulo 4 GiB. fflate checks neither, and its one-call gunzip
 * trusts the size, so the archive is unpacked as a stream and both are checked here.
 */
function gunzip(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 18) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const stream = new Gunzip((chunk) => {
    size += chunk.length;
    if (size > MAX_UNPACKED) throw new RangeError("unpacks past the limit");
    chunks.push(chunk);
  });
  try {
    for (let start = 0; start < bytes.length; start += SLICE) {
      const end = Math.min(start + SLICE, bytes.length);
      stream.push(bytes.subarray(start, end), end === bytes.length);
    }
  } catch {
    return null;
  }
  const trailer = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 8, 8);
  if (size !== trailer.getUint32(4, true)) return null;
  const tar = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    tar.set(chunk, offset);
    offset += chunk.length;
  }
  return crc32(tar) === trailer.getUint32(0, true) ? tar : null;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value;
});

/** The CRC-32 gzip records for the bytes it packs. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
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

/** An octal field; anything but octal digits, such as a sign, reads as NaN. */
function octal(field: Uint8Array): number {
  const digits = text(field).trim();
  return /^[0-7]*$/.test(digits) ? Number.parseInt(digits || "0", 8) : Number.NaN;
}

/** A NUL-terminated field as text. */
function text(field: Uint8Array): string {
  const end = field.indexOf(0);
  return decoder.decode(end === -1 ? field : field.subarray(0, end));
}
