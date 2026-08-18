/**
 * Colour parsing shared by every colour control and by the canvas export.
 *
 * The app's palettes aren't uniformly hex: tape is deliberately translucent
 * rgba, so that a photo shows through it the way real washi tape does. A
 * colour field that handed a raw hex straight through would quietly make tape
 * opaque, which stops it reading as tape at all — hence applyHexKeepingAlpha.
 */

/** Accepts 3- or 6-digit hex, with or without the leading hash, any case. Null if it isn't one. */
export function normaliseHex(raw: string): string | null {
  const s = raw.trim().replace(/^#/, '')
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return null
  const full =
    s.length === 3
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s
  return `#${full.toLowerCase()}`
}

/** The alpha carried by a colour string — 1 for hex and for anything unparseable. */
export function alphaOf(color: string | undefined): number {
  if (!color) return 1
  const m = /^rgba?\([^)]*?,\s*([0-9.]+)\s*\)$/.exec(color.trim())
  return m ? Number(m[1]) : 1
}

/** A colour's hex form, for seeding a hex box or a native colour input from an rgba value. */
export function hexOf(color: string | undefined, fallback = '#000000'): string {
  if (!color) return fallback
  const direct = normaliseHex(color)
  if (direct) return direct
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color.trim())
  if (!m) return fallback
  const hex = [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

/**
 * Applies `hex` while keeping whatever transparency `reference` had. Returns a
 * plain hex when the reference was opaque, so nothing gains a pointless
 * rgba() wrapper.
 */
export function applyHexKeepingAlpha(reference: string | undefined, hex: string): string {
  const alpha = alphaOf(reference)
  if (alpha >= 1) return hex
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** How many colours a book remembers. Enough to get back to a small working palette, not a history. */
export const MAX_RECENT_COLORS = 8

/** Ink colours for page notes and text boxes. */
export const TEXT_COLORS = [
  { id: 'ink', color: '#2b2722', label: 'Ink' },
  { id: 'charcoal', color: '#4a4a4a', label: 'Charcoal' },
  { id: 'sepia', color: '#6b5f4a', label: 'Sepia' },
  { id: 'parchment', color: '#f2ead2', label: 'Parchment' },
  { id: 'white', color: '#ffffff', label: 'White' },
  { id: 'brass', color: '#a9822f', label: 'Brass' },
  { id: 'clay', color: '#a8574a', label: 'Clay' },
  { id: 'navy', color: '#33495c', label: 'Navy' },
]
