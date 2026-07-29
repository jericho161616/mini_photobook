import type { BookSize, Shape } from '../types'

/**
 * The nine standard photobook trims. Larger books can carry denser pages
 * without the images getting too small to read.
 */
export const SIZES: BookSize[] = [
  { id: 'sq-s', name: 'Small Square', widthIn: 6, heightIn: 6, maxPhotosPerPage: 3 },
  { id: 'sq-m', name: 'Medium Square', widthIn: 8, heightIn: 8, maxPhotosPerPage: 4 },
  { id: 'sq-l', name: 'Large Square', widthIn: 10, heightIn: 10, maxPhotosPerPage: 5 },
  { id: 'ls-s', name: 'Small Landscape', widthIn: 7, heightIn: 5, maxPhotosPerPage: 3 },
  { id: 'ls-m', name: 'Standard Landscape', widthIn: 11, heightIn: 8.5, maxPhotosPerPage: 4 },
  { id: 'ls-l', name: 'Large Landscape', widthIn: 14, heightIn: 11, maxPhotosPerPage: 5 },
  { id: 'pt-s', name: 'Small Portrait', widthIn: 5, heightIn: 7, maxPhotosPerPage: 3 },
  { id: 'pt-m', name: 'Standard Portrait', widthIn: 8, heightIn: 10, maxPhotosPerPage: 4 },
  { id: 'pt-l', name: 'Large Portrait', widthIn: 11, heightIn: 14, maxPhotosPerPage: 5 },
]

/**
 * ISO 216 paper, portrait — sized for a home printer rather than a print lab.
 * A4 is what most inkjets take without adjusting the tray; A3 needs a
 * printer that supports it, A5/A6 are what a normal sheet cuts down to.
 */
export const PAPER_SIZES: BookSize[] = [
  { id: 'a6', name: 'A6', widthIn: 4.13, heightIn: 5.83, maxPhotosPerPage: 2 },
  { id: 'a5', name: 'A5', widthIn: 5.83, heightIn: 8.27, maxPhotosPerPage: 3 },
  { id: 'a4', name: 'A4', widthIn: 8.27, heightIn: 11.69, maxPhotosPerPage: 4 },
  { id: 'a4-landscape', name: 'A4 Landscape', widthIn: 11.69, heightIn: 8.27, maxPhotosPerPage: 4 },
  { id: 'a3', name: 'A3', widthIn: 11.69, heightIn: 16.54, maxPhotosPerPage: 5 },
]

/** A single instant-photo frame — deliberately tiny and single-shot per page. */
export const NOVELTY_SIZES: BookSize[] = [
  { id: 'polaroid', name: 'Polaroid', widthIn: 3.5, heightIn: 4.2, maxPhotosPerPage: 1 },
]

/** The standard 4×6 in photo-lab print, in both orientations. */
export const PRINT_SIZES: BookSize[] = [
  { id: '4r', name: '4R', widthIn: 4, heightIn: 6, maxPhotosPerPage: 1 },
  { id: '4r-landscape', name: '4R Landscape', widthIn: 6, heightIn: 4, maxPhotosPerPage: 1 },
]

/**
 * An A4 sheet, folded once down the middle into a small card. The size here
 * is the whole sheet, not one half — a page in these sizes is one physical
 * sheet with a fold line running through the middle, carrying either two
 * different photos (one per half) or one photo spanning the whole thing.
 *
 * "Portrait" folds a landscape A4 sheet top-to-bottom into a page that reads
 * portrait; "Landscape" folds a portrait A4 sheet left-to-right into a page
 * that reads landscape once opened out flat like a tent card.
 */
export const BOOKLET_SIZES: BookSize[] = [
  { id: 'a4-folded-portrait', name: 'A4 Folded — Portrait', widthIn: 11.69, heightIn: 8.27, maxPhotosPerPage: 2 },
  { id: 'a4-folded-landscape', name: 'A4 Folded — Landscape', widthIn: 8.27, heightIn: 11.69, maxPhotosPerPage: 2 },
]

export const SIZE_GROUPS: { label: string; sizes: BookSize[] }[] = [
  { label: 'Photobook', sizes: SIZES },
  { label: 'Printer Paper', sizes: PAPER_SIZES },
  { label: 'Photo Prints', sizes: PRINT_SIZES },
  { label: 'Booklet (A4 Folded)', sizes: BOOKLET_SIZES },
  { label: 'Novelty', sizes: NOVELTY_SIZES },
]

const ALL_SIZES = [...SIZES, ...PAPER_SIZES, ...PRINT_SIZES, ...BOOKLET_SIZES, ...NOVELTY_SIZES]

/**
 * Pairs of sizes that are the same physical paper, just rotated — lets a
 * single page within an A4-family book be flipped to the other orientation
 * without changing what size the rest of the book is.
 */
const ORIENTATION_PAIRS: [string, string][] = [
  ['a4', 'a4-landscape'],
  ['a4-folded-portrait', 'a4-folded-landscape'],
]

/** The size id a page could flip to, or undefined if this size has no pair. */
export function pairedOrientationSizeId(sizeId: string): string | undefined {
  for (const [a, b] of ORIENTATION_PAIRS) {
    if (sizeId === a) return b
    if (sizeId === b) return a
  }
  return undefined
}

/** Every size id that belongs to an A4 orientation pair. */
export const ORIENTATION_TOGGLE_SIZE_IDS = new Set(ORIENTATION_PAIRS.flat())

/** Short label for the toggle button — which way this size reads. */
export function orientationLabel(sizeId: string): 'Portrait' | 'Landscape' {
  return sizeId.includes('landscape') ? 'Landscape' : 'Portrait'
}

/** Size ids for the two A4 Folded sizes — used to restrict fold-only templates. */
export const FOLD_SIZE_IDS = new Set(BOOKLET_SIZES.map((s) => s.id))

export const DEFAULT_SIZE_ID = 'sq-m'

export function getSize(id: string): BookSize {
  return ALL_SIZES.find((s) => s.id === id) ?? SIZES[1]
}

export function sizeRatio(size: BookSize): number {
  return size.widthIn / size.heightIn
}

/** Which layout family a trim naturally belongs to. */
export function bookShape(size: BookSize): Shape {
  const ratio = sizeRatio(size)
  if (ratio > 1.15) return 'wide'
  if (ratio < 0.87) return 'tall'
  return 'square'
}

export function formatDims(size: BookSize): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return `${fmt(size.widthIn)}×${fmt(size.heightIn)} in`
}
