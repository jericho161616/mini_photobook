import type { BookSize, Shape } from '../types'

/**
 * The nine standard photobook trims. Larger books can carry denser pages
 * without the images getting too small to read.
 */
export const SIZES: BookSize[] = [
  { id: 'sq-s', name: 'Small Square', widthIn: 6, heightIn: 6, maxPhotosPerPage: 3 },
  { id: 'sq-m', name: 'Medium Square', widthIn: 8, heightIn: 8, maxPhotosPerPage: 4 },
  { id: 'sq-l', name: 'Large Square', widthIn: 10, heightIn: 10, maxPhotosPerPage: 9 },
  { id: 'ls-s', name: 'Small Landscape', widthIn: 7, heightIn: 5, maxPhotosPerPage: 3 },
  { id: 'ls-m', name: 'Standard Landscape', widthIn: 11, heightIn: 8.5, maxPhotosPerPage: 4 },
  { id: 'ls-l', name: 'Large Landscape', widthIn: 14, heightIn: 11, maxPhotosPerPage: 9 },
  { id: 'pt-s', name: 'Small Portrait', widthIn: 5, heightIn: 7, maxPhotosPerPage: 3 },
  { id: 'pt-m', name: 'Standard Portrait', widthIn: 8, heightIn: 10, maxPhotosPerPage: 4 },
  { id: 'pt-l', name: 'Large Portrait', widthIn: 11, heightIn: 14, maxPhotosPerPage: 9 },
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
  // Same sheet as a flat A4, so the same density — and a Split at Fold page
  // goes denser still, since each half carries its own layout on top of this.
  { id: 'a4-folded-portrait', name: 'A4 Folded — Portrait', widthIn: 11.69, heightIn: 8.27, maxPhotosPerPage: 4 },
  { id: 'a4-folded-landscape', name: 'A4 Folded — Landscape', widthIn: 8.27, heightIn: 11.69, maxPhotosPerPage: 4 },
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
 * The four A4 sizes — flat and folded, each in both orientations — treated as
 * one interchangeable family. A page inside an A4-family book can be set to
 * any of the four without changing what size the rest of the book is, so a
 * single "whole sheet" page and a folded-card page can sit side by side.
 */
const A4_FAMILY_IDS = ['a4', 'a4-landscape', 'a4-folded-portrait', 'a4-folded-landscape']

const A4_FAMILY_SHORT_LABELS: Record<string, string> = {
  'a4': 'A4',
  'a4-landscape': 'A4 Landscape',
  'a4-folded-portrait': 'A4 Folded ↕',
  'a4-folded-landscape': 'A4 Folded ↔',
}

/**
 * The other sizes a page could be set to, if `sizeId` belongs to the A4
 * family — undefined if it doesn't, in which case no per-page override is
 * offered at all.
 */
export function a4FamilyOptions(sizeId: string): { id: string; label: string }[] | undefined {
  if (!A4_FAMILY_IDS.includes(sizeId)) return undefined
  return A4_FAMILY_IDS.map((id) => ({ id, label: A4_FAMILY_SHORT_LABELS[id] }))
}

/** Size ids for the two A4 Folded sizes — used to restrict fold-only templates. */
export const FOLD_SIZE_IDS = new Set(BOOKLET_SIZES.map((s) => s.id))

const FOLD_ORIENTATION_BY_SIZE_ID: Record<string, 'vertical' | 'horizontal'> = {
  'a4-folded-portrait': 'vertical',
  'a4-folded-landscape': 'horizontal',
}

/**
 * Where the physical crease falls on this size, regardless of which template
 * is applied — a page's own size decides this, not its layout, so the guide
 * still shows even on a general (non-fold-aware) template.
 */
export function foldOrientationForSize(sizeId: string): 'vertical' | 'horizontal' | undefined {
  return FOLD_ORIENTATION_BY_SIZE_ID[sizeId]
}

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
