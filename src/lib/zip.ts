import "server-only";
import { deflateRaw } from "zlib";
import { promisify } from "util";

// A ZIP writer, in about a hundred lines and with no dependency.
//
// ---- Why not a library -----------------------------------------------------
//
// This project has ten runtime dependencies and each one is a thing somebody has to keep
// patched. The whole requirement here is "put four text files and a handful of images in
// one archive that Explorer, Finder and `unzip` all open" - which is the oldest, most
// frozen part of the ZIP specification (APPNOTE 6.3.x, sections 4.3.7 and 4.3.12). It has
// not changed since 1993 and it is not going to.
//
// What this deliberately does NOT do is stream, split across disks, encrypt, or handle
// archives over 4 GB. If a site brief ever needs any of those, something has gone wrong
// upstream of here - the per-file upload cap is 5 MB (lib/uploads.ts) and a brief holds
// a handful of files.
//
// ---- The one trap worth naming ---------------------------------------------
//
// Everything in a ZIP is little-endian, and every offset in the central directory is
// counted from the START OF THE FILE - not from the start of the entry. Getting that wrong
// produces an archive that some tools open and others call corrupt, which is the worst
// possible failure mode because it looks like it works.

const deflate = promisify(deflateRaw);

export type ZipEntry = {
  /**
   * The path inside the archive. Forward slashes ALWAYS, even when the zip is built on
   * Windows - a backslash here is a literal character in a filename on every Unix tool
   * that opens it, not a directory separator.
   */
  name: string;
  data: Buffer | string;
};

/** The DOS date/time pair every entry carries. Local time, two-second resolution. */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = d.getFullYear();
  // The epoch is 1980. Anything earlier cannot be represented, so clamp rather than
  // wrap into a date from the far future.
  const y = Math.max(1980, year) - 1980;
  return {
    time:
      (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: (y << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * CRC-32, the one every ZIP entry carries. Table built once, on first use.
 *
 * Node has no crc32 in its standard library, and this is the only reason a zip library
 * would otherwise be pulled in.
 */
let CRC_TABLE: Int32Array | null = null;
function crc32(buf: Buffer): number {
  if (!CRC_TABLE) {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    CRC_TABLE = table;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Build a ZIP archive in memory.
 *
 * Entries are stored in the order given, which is the order they appear in every tool
 * that lists the archive - so put the thing a person should read first, first.
 *
 * Each entry is deflated, and kept STORED (uncompressed) when deflating made it bigger.
 * That happens for real here: a PNG or a JPEG is already compressed, and re-deflating one
 * reliably adds a few bytes for nothing.
 */
export async function buildZip(entries: readonly ZipEntry[]): Promise<Buffer> {
  const now = new Date();
  const { time, date } = dosDateTime(now);

  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const raw = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");

    const deflated = raw.length ? await deflate(raw) : Buffer.alloc(0);
    // 8 = deflate, 0 = stored. Stored wins whenever compression did not pay, which keeps
    // the archive honest about images and costs nothing to support.
    const useDeflate = deflated.length > 0 && deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // local file header signature
    header.writeUInt16LE(20, 4); // version needed: 2.0, which is what deflate wants
    // Bit 11: the filename is UTF-8. Without it a brief for a partner whose name is not
    // ASCII unzips with mojibake for a directory name.
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18); // compressed size
    header.writeUInt32LE(raw.length, 22); // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28); // no extra field

    local.push(header, nameBuf, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // central directory header signature
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0x0800, 8); // same UTF-8 flag as the local header
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30); // extra length
    dir.writeUInt16LE(0, 32); // comment length
    dir.writeUInt16LE(0, 34); // disk number
    dir.writeUInt16LE(0, 36); // internal attributes
    dir.writeUInt32LE(0, 38); // external attributes
    // FROM THE START OF THE ARCHIVE. See the note at the top of this file.
    dir.writeUInt32LE(offset, 42);

    central.push(dir, nameBuf);

    offset += header.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // no archive comment

  return Buffer.concat([...local, centralBuf, end]);
}

/**
 * A filename safe on every filesystem a downloaded zip lands on.
 *
 * Windows is the strict one - it refuses < > : " / \ | ? * outright, and reserves CON,
 * PRN, AUX, NUL and the COM/LPT series regardless of extension. A partner called "AUX" is
 * unlikely; a partner with a colon or a slash in their name is not.
 */
export function safeFilename(name: string, fallback = "file"): string {
  const cleaned = name
    .normalize("NFKD")
    // eslint-disable-next-line no-control-regex -- control bytes are exactly what this
    // is here to strip: a newline in a filename is a header-injection primitive.
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  if (!cleaned) return fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) return `_${cleaned}`;
  return cleaned.slice(0, 120);
}
