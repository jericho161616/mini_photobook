import type { CustomFont } from '../types'

/**
 * Fonts a book brings with it, on top of the eight built-ins.
 *
 * Two ways in, because neither alone is good enough:
 *
 * - **A dropped-in file** works in every browser and travels with the book, so
 *   opening it on another machine still shows the right typeface. This is the
 *   main route.
 * - **Scanning the machine** (queryLocalFonts) is far less work when the font
 *   you want is already installed — but it is Chromium-only and needs the
 *   user's permission, so it is offered as a bonus, never depended on. A
 *   scanned font stores only its family name: the book will fall back to serif
 *   if opened somewhere that hasn't got it.
 *
 * Nothing here reaches the network. An uploaded file is read locally and kept
 * in the book's own record; a scanned name is just a string.
 */

export const FONT_FILE_TYPES = ['.ttf', '.otf', '.woff', '.woff2']

/**
 * id -> CSS family for every font the open book has registered.
 *
 * Kept here rather than threaded through as an argument because fontStack is
 * called from eight places across two render paths, and every one of them
 * would have had to grow a parameter it doesn't otherwise care about. The
 * open book is a singleton anyway — there is only ever one set of fonts live.
 */
const registry = new Map<string, string>()

/** The CSS family for a book font id, or undefined if it isn't one. */
export function fontFamilyById(id: string): string | undefined {
  return registry.get(id)
}

let fontSeq = 0
function nextFontId(): string {
  fontSeq += 1
  return `font-${Date.now().toString(36)}-${fontSeq}`
}

/**
 * A CSS family unique to this entry, so two files both calling themselves
 * "Script" don't overwrite one another.
 */
function familyFor(id: string, name: string): string {
  return `mb-${id}-${name.replace(/[^\w-]/g, '')}`
}

/** True when this browser can list the machine's installed fonts (Chromium only, today). */
export function canScanLocalFonts(): boolean {
  return typeof (window as { queryLocalFonts?: unknown }).queryLocalFonts === 'function'
}

interface LocalFontEntry {
  family: string
  fullName: string
  postscriptName: string
}

/**
 * Asks the browser for the machine's installed families. Throws if the user
 * declines — the caller decides what to say about that.
 */
export async function scanLocalFonts(): Promise<string[]> {
  const query = (window as { queryLocalFonts?: () => Promise<LocalFontEntry[]> }).queryLocalFonts
  if (!query) throw new Error('This browser cannot list local fonts.')
  const entries = await query()
  return [...new Set(entries.map((e) => e.family))].sort((a, b) => a.localeCompare(b))
}

/** Reads a dropped font file into a book-ready record. Rejects anything that isn't a font. */
export async function fontFromFile(file: File): Promise<CustomFont> {
  const lower = file.name.toLowerCase()
  if (!FONT_FILE_TYPES.some((ext) => lower.endsWith(ext))) {
    throw new Error(`${file.name} isn't a font file. Use ${FONT_FILE_TYPES.join(', ')}.`)
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
  const id = nextFontId()
  // The filename minus its extension is the best name available without
  // parsing the font's own tables, and it's the name the user recognises.
  const name = file.name.replace(/\.[^.]+$/, '')
  return { id, name, family: familyFor(id, name), data }
}

/** Wraps a scanned family name — no file, since the machine already has it. */
export function fontFromLocalFamily(family: string): CustomFont {
  const id = nextFontId()
  return { id, name: family, family, local: true }
}

/**
 * Makes a font usable — by the editor and, because the export draws to a
 * canvas, by the PDF too. A local font needs nothing: its family is already
 * resolvable by name.
 */
export async function registerFont(font: CustomFont): Promise<void> {
  registry.set(font.id, font.family)
  // A local font needs no loading — the machine already resolves it by name.
  if (font.local || !font.data) return
  if ([...document.fonts].some((f) => f.family === font.family)) return
  const face = new FontFace(font.family, `url(${font.data})`)
  await face.load()
  document.fonts.add(face)
}

export function unregisterFont(font: CustomFont): void {
  registry.delete(font.id)
  for (const face of [...document.fonts]) {
    if (face.family === font.family) document.fonts.delete(face)
  }
}

/**
 * Registers everything a freshly opened book carries. Failures are per-font
 * and non-fatal: one unreadable file shouldn't stop the book from opening.
 */
export async function registerAll(fonts: CustomFont[]): Promise<void> {
  registry.clear()
  await Promise.all(
    fonts.map((font) =>
      registerFont(font).catch(() => {
        /* a font that won't load just falls back to serif */
      }),
    ),
  )
}

/** The CSS stack for a book font — the family, then the same serif fallback everything else uses. */
export function customFontStack(font: CustomFont): string {
  return `"${font.family}", Georgia, serif`
}
