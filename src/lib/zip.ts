/**
 * A minimal ZIP writer — stored (uncompressed) entries only.
 *
 * A carousel exports as one file per slide, and handing someone twelve
 * separate downloads is worse than handing them one archive. That normally
 * means pulling in a zip library, which is a dependency, a licence, and a
 * few hundred kilobytes for a format whose "just store it" mode is about
 * sixty lines. PNGs are already DEFLATE-compressed internally, so running
 * them through DEFLATE a second time saves almost nothing — storing them
 * costs a percent or two of size and keeps the app dependency-free.
 *
 * Everything here is the 1989 base format: local headers, a central
 * directory, and an end-of-central-directory record. No zip64, so this tops
 * out at 4GB and 65535 entries — a carousel is at most 20 images.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  /** The name the file will have inside the archive. */
  name: string
  /**
   * Backed by a plain ArrayBuffer rather than the wider ArrayBufferLike —
   * Blob won't accept a view onto a SharedArrayBuffer, and this is where the
   * bytes end up.
   */
  bytes: Uint8Array<ArrayBuffer>
}

/** Bit 11 of the general-purpose flags: file names are UTF-8, not the ancient default. */
const UTF8_NAMES = 0x0800
/** Method 0 — stored. See the note at the top of the file. */
const METHOD_STORE = 0

/**
 * MS-DOS packed date and time, which is what ZIP stores. Two-second
 * resolution, and years count from 1980. A zero date is technically invalid
 * (there's no month 0), so this always writes a real one.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

export function zipStore(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const stamp = dosDateTime(new Date())
  const parts: BlobPart[] = []
  const directory: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.bytes)
    const size = entry.bytes.length

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // local file header signature
    lv.setUint16(4, 20, true) // version needed to extract — 2.0
    lv.setUint16(6, UTF8_NAMES, true)
    lv.setUint16(8, METHOD_STORE, true)
    lv.setUint16(10, stamp.time, true)
    lv.setUint16(12, stamp.date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true) // compressed size — same as raw, stored
    lv.setUint32(22, size, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true) // extra field length
    local.set(name, 30)

    parts.push(local, entry.bytes)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true) // central directory header signature
    cv.setUint16(4, 20, true) // version made by
    cv.setUint16(6, 20, true) // version needed
    cv.setUint16(8, UTF8_NAMES, true)
    cv.setUint16(10, METHOD_STORE, true)
    cv.setUint16(12, stamp.time, true)
    cv.setUint16(14, stamp.date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, name.length, true)
    cv.setUint16(30, 0, true) // extra field length
    cv.setUint16(32, 0, true) // comment length
    cv.setUint16(34, 0, true) // disk number
    cv.setUint16(36, 0, true) // internal attributes
    cv.setUint32(38, 0, true) // external attributes
    cv.setUint32(42, offset, true) // where this entry's local header starts
    central.set(name, 46)
    directory.push(central)

    offset += local.length + size
  }

  const directorySize = directory.reduce((total, record) => total + record.length, 0)

  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true) // end of central directory signature
  ev.setUint16(4, 0, true) // this disk
  ev.setUint16(6, 0, true) // disk the directory starts on
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, directorySize, true)
  ev.setUint32(16, offset, true) // directory offset
  ev.setUint16(20, 0, true) // archive comment length

  return new Blob([...parts, ...directory, end], { type: 'application/zip' })
}
