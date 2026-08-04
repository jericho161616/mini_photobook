import { FOLD_SIZE_IDS } from './sizes'
import type { BookSize, Shape, Template } from '../types'

/**
 * Two families, deliberately different in voice:
 *
 * Minimal — one to three photos with room around them, the quiet coffee-table look.
 * Portfolio — editorial rows, covers, and collages, closer to a photographer's book.
 *
 * `fits` tags which page shapes a layout reads well in, so the shape filter can
 * offer square, tall, and wide options that can be mixed page by page.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'full',
    label: '1 · Full',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'fullBleed',
    label: '1 · Full Bleed',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    bleed: true,
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'grid4',
    label: '4 · Grid',
    family: 'Minimal',
    fits: ['square'],
    // Same 2×2 idea as Portfolio's grid, but with a wider gutter — the
    // minimalist read is in the extra breathing room between photos.
    slots: [
      { x: 0, y: 0, w: 46, h: 46 },
      { x: 54, y: 0, w: 46, h: 46 },
      { x: 0, y: 54, w: 46, h: 46 },
      { x: 54, y: 54, w: 46, h: 46 },
    ],
  },
  {
    id: 'fullNote',
    label: '1 · Photo + Note',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    slots: [{ x: 0, y: 0, w: 100, h: 78 }],
    textSlot: { x: 6, y: 84, w: 88, h: 12 },
  },
  {
    id: 'duoNote',
    label: '2 · Side + Note',
    family: 'Minimal',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 47, h: 82 },
      { x: 53, y: 0, w: 47, h: 82 },
    ],
    textSlot: { x: 6, y: 88, w: 88, h: 10 },
  },
  {
    id: 'duoV',
    label: '2 · Side',
    family: 'Minimal',
    fits: ['wide', 'square'],
    slots: [
      { x: 0, y: 0, w: 47, h: 100 },
      { x: 53, y: 0, w: 47, h: 100 },
    ],
  },
  {
    id: 'duoH',
    label: '2 · Stack',
    family: 'Minimal',
    fits: ['tall', 'square'],
    slots: [
      { x: 0, y: 0, w: 100, h: 47 },
      { x: 0, y: 53, w: 100, h: 47 },
    ],
  },
  {
    id: 'duoHNote',
    label: '2 · Stack + Note',
    family: 'Minimal',
    fits: ['tall', 'square'],
    // "2 · Side + Note" already covers wide pages; this is the same idea for
    // tall/square ones, where a horizontal stack reads better than side-by-side.
    slots: [
      { x: 0, y: 0, w: 100, h: 38 },
      { x: 0, y: 42, w: 100, h: 38 },
    ],
    textSlot: { x: 6, y: 84, w: 88, h: 12 },
  },
  {
    id: 'trioT',
    label: '3 · Feature',
    family: 'Minimal',
    fits: ['square', 'wide'],
    slots: [
      { x: 0, y: 0, w: 100, h: 58 },
      { x: 0, y: 64, w: 47, h: 36 },
      { x: 53, y: 64, w: 47, h: 36 },
    ],
  },
  {
    id: 'trioS',
    label: '3 · Column',
    family: 'Minimal',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 63, h: 100 },
      { x: 67, y: 0, w: 33, h: 47 },
      { x: 67, y: 53, w: 33, h: 47 },
    ],
  },
  {
    id: 'bleedDuo',
    label: '2 · Bleed Diptych',
    family: 'Portfolio',
    fits: ['wide'],
    // No gutter and no margin — the two photos touch edge to edge and edge
    // to page, reading as one continuous spread rather than two frames.
    bleed: true,
    slots: [
      { x: 0, y: 0, w: 50, h: 100 },
      { x: 50, y: 0, w: 50, h: 100 },
    ],
  },
  {
    id: 'cover',
    label: '1 · Cover',
    family: 'Portfolio',
    fits: ['square', 'tall'],
    slots: [{ x: 18, y: 10, w: 64, h: 58 }],
    caption: { x: 10, y: 74, w: 80, h: 12 },
  },
  {
    id: 'wideBanner',
    label: '1 · Banner',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [{ x: 4, y: 18, w: 92, h: 58 }],
    caption: { x: 10, y: 82, w: 80, h: 10 },
  },
  {
    id: 'row3',
    label: '3 · Row',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 31, h: 100 },
      { x: 34.5, y: 0, w: 31, h: 100 },
      { x: 69, y: 0, w: 31, h: 100 },
    ],
  },
  {
    id: 'row5',
    label: '5 · Row',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 18, h: 100 },
      { x: 20.5, y: 0, w: 18, h: 100 },
      { x: 41, y: 0, w: 18, h: 100 },
      { x: 61.5, y: 0, w: 18, h: 100 },
      { x: 82, y: 0, w: 18, h: 100 },
    ],
  },
  {
    id: 'bigStack',
    label: '4 · Collage',
    family: 'Portfolio',
    fits: ['wide', 'square'],
    slots: [
      { x: 0, y: 0, w: 58, h: 100 },
      { x: 61, y: 0, w: 39, h: 31 },
      { x: 61, y: 34.5, w: 39, h: 31 },
      { x: 61, y: 69, w: 39, h: 31 },
    ],
  },
  {
    id: 'asymGrid',
    label: '5 · Editorial',
    family: 'Portfolio',
    fits: ['square', 'wide'],
    slots: [
      { x: 0, y: 0, w: 48, h: 48 },
      { x: 51, y: 0, w: 22, h: 48 },
      { x: 76, y: 0, w: 24, h: 48 },
      { x: 0, y: 51, w: 32, h: 48 },
      { x: 35, y: 51, w: 65, h: 48 },
    ],
  },
  {
    id: 'squareGrid4',
    label: '4 · Grid',
    family: 'Portfolio',
    fits: ['square'],
    slots: [
      { x: 0, y: 0, w: 48, h: 48 },
      { x: 52, y: 0, w: 48, h: 48 },
      { x: 0, y: 52, w: 48, h: 48 },
      { x: 52, y: 52, w: 48, h: 48 },
    ],
  },
  {
    id: 'tallTrio',
    label: '3 · Tiers',
    family: 'Portfolio',
    fits: ['tall'],
    slots: [
      { x: 0, y: 0, w: 100, h: 31 },
      { x: 0, y: 34.5, w: 100, h: 31 },
      { x: 0, y: 69, w: 100, h: 31 },
    ],
  },
  {
    id: 'polaroid',
    label: '1 · Polaroid',
    family: 'Portfolio',
    fits: ['square', 'tall'],
    // The photo leaves the classic instant-photo frame empty at the bottom.
    slots: [{ x: 0, y: 0, w: 100, h: 74 }],
  },
  {
    id: 'polaroidNote',
    label: '1 · Polaroid + Note',
    family: 'Portfolio',
    fits: ['square', 'tall'],
    // Same frame as Polaroid, but the blank strip actually holds your own
    // note now rather than being purely decorative — the "handwritten"
    // caption a real Polaroid has.
    slots: [{ x: 0, y: 0, w: 100, h: 74 }],
    textSlot: { x: 10, y: 82, w: 80, h: 14 },
  },
  {
    id: 'tallFeature',
    label: '2 · Tall Feature',
    family: 'Portfolio',
    fits: ['tall'],
    slots: [
      { x: 0, y: 0, w: 100, h: 68 },
      { x: 0, y: 72, w: 100, h: 28 },
    ],
  },
  {
    id: 'tiersWide',
    label: '2 · Tiers',
    family: 'Portfolio',
    fits: ['wide'],
    // The app's only other 2-photo stack (Minimal's "2 · Stack") is tall/square
    // only — a landscape book had no stacked-pair option until this.
    slots: [
      { x: 0, y: 0, w: 100, h: 47 },
      { x: 0, y: 53, w: 100, h: 47 },
    ],
  },
  {
    id: 'tiersWide3',
    label: '3 · Tiers (Wide)',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 100, h: 31 },
      { x: 0, y: 34.5, w: 100, h: 31 },
      { x: 0, y: 69, w: 100, h: 31 },
    ],
  },
  {
    id: 'squareDuo',
    label: '2 · Square Duo',
    family: 'Portfolio',
    // Restricted to square trims: the slots are true squares (equal width and
    // height percentages), which only reads as a square once the page itself
    // is roughly 1:1 — on a true landscape page these would come out tall.
    fits: ['square'],
    slots: [
      { x: 4, y: 27, w: 42, h: 42 },
      { x: 54, y: 27, w: 42, h: 42 },
    ],
  },
  {
    id: 'squareRow3',
    label: '3 · Square Row',
    family: 'Portfolio',
    fits: ['square'],
    slots: [
      { x: 4, y: 36, w: 28, h: 28 },
      { x: 36, y: 36, w: 28, h: 28 },
      { x: 68, y: 36, w: 28, h: 28 },
    ],
  },
  {
    id: 'foldSplitPortrait',
    label: '2 · Split at Fold',
    family: 'Minimal',
    fits: ['wide'],
    onlyFor: ['a4-folded-portrait'],
    // Edge-to-edge and no gutter: the two halves are the same physical sheet,
    // meeting exactly at the fold rather than a designed page margin. Each
    // "slot" here is a region holding its own independent layout, not a photo.
    bleed: true,
    halfSplit: true,
    slots: [
      { x: 0, y: 0, w: 50, h: 100 },
      { x: 50, y: 0, w: 50, h: 100 },
    ],
  },
  {
    id: 'foldFullPortrait',
    label: '1 · Full Sheet',
    family: 'Minimal',
    fits: ['wide'],
    onlyFor: ['a4-folded-portrait'],
    bleed: true,
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'foldSplitLandscape',
    label: '2 · Split at Fold',
    family: 'Minimal',
    fits: ['tall'],
    onlyFor: ['a4-folded-landscape'],
    bleed: true,
    halfSplit: true,
    slots: [
      { x: 0, y: 0, w: 100, h: 50 },
      { x: 0, y: 50, w: 100, h: 50 },
    ],
  },
  {
    id: 'foldFullLandscape',
    label: '1 · Full Sheet',
    family: 'Minimal',
    fits: ['tall'],
    onlyFor: ['a4-folded-landscape'],
    bleed: true,
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'instantGrid',
    label: '6 · Instant Grid',
    family: 'Minimal',
    fits: ['square', 'wide'],
    // A contact-sheet wall of small framed shots — each slot leaves room for
    // its own white card mount, drawn around the photo rather than cropped into it.
    slots: [
      { x: 2, y: 2, w: 30, h: 30 },
      { x: 35, y: 2, w: 30, h: 30 },
      { x: 68, y: 2, w: 30, h: 30 },
      { x: 2, y: 35, w: 30, h: 30 },
      { x: 35, y: 35, w: 30, h: 30 },
      { x: 68, y: 35, w: 30, h: 30 },
    ],
  },
  {
    id: 'posterOverlay',
    label: '2 · Poster Overlay',
    family: 'Portfolio',
    fits: ['square', 'tall', 'wide'],
    bleed: true,
    // The background fills the page; the second slot is drawn taped on top at
    // an angle by PageView/exportPdf rather than sitting in a fixed rect.
    decoration: 'poster',
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 26, y: 16, w: 46, h: 56 },
    ],
  },
  {
    id: 'circleInset',
    label: '2 · Circle Inset',
    family: 'Portfolio',
    fits: ['square', 'tall', 'wide'],
    bleed: true,
    // The second photo is drawn as a centered circle with a white ring by
    // PageView/exportPdf — its slot rect below just bounds that circle, the
    // actual diameter is the smaller of the rect's own width and height so
    // it's a true circle regardless of the book's own aspect ratio.
    decoration: 'circle',
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 28, y: 28, w: 44, h: 44 },
    ],
  },
  {
    id: 'fullCaption',
    label: '1 · Full + Caption',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    slots: [{ x: 0, y: 0, w: 100, h: 82 }],
    textSlot: { x: 10, y: 86, w: 80, h: 10 },
    captionStyle: 'centered',
  },
  {
    id: 'noteCover',
    label: '1 · Note Cover',
    family: 'Portfolio',
    fits: ['square', 'tall'],
    // A quiet closing page: one small centered photo, your own note beneath
    // it instead of the book title — the "so the point is" cover in mind.
    slots: [{ x: 32, y: 14, w: 36, h: 44 }],
    textSlot: { x: 15, y: 64, w: 70, h: 20 },
    captionStyle: 'centered',
  },
]

export const SHAPE_FILTERS: { id: Shape | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'square', label: 'Square' },
  { id: 'tall', label: 'Tall' },
  { id: 'wide', label: 'Wide' },
]

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

/**
 * Templates that stay composed at the given book size.
 *
 * On the A4 Folded sizes this is only ever the two fold-aware templates —
 * how the sheet is divided, not what goes in it. A general layout applied
 * across a folded sheet would put its slots straight over the crease, and
 * folding the print would ruin whatever sits there. The general library is
 * still fully available on a folded page, just one half at a time, via
 * templatesForHalf.
 */
export function templatesForSize(size: BookSize): Template[] {
  return TEMPLATES.filter((t) => {
    if (t.slots.length > size.maxPhotosPerPage) return false
    if (t.onlyFor) return t.onlyFor.includes(size.id)
    return !FOLD_SIZE_IDS.has(size.id)
  })
}

/** A folded sheet's half is roughly A5-sized — room for a 2×2 collage of its own. */
export const MAX_PHOTOS_PER_HALF = 4

/**
 * Layout choices for one side of a "Split at Fold" page — the whole
 * general-purpose library, exactly as a standalone page would offer it, so a
 * half really is its own little page rather than a restricted version of one.
 * Only the fold-aware templates are held back: nesting another fold inside
 * half of an already-folded sheet has no physical meaning.
 *
 * Shape isn't filtered here — the shape chips do that, the same way they do
 * for a whole page.
 */
export function templatesForHalf(): Template[] {
  return TEMPLATES.filter(
    (t) => !t.onlyFor && !t.halfSplit && t.slots.length <= MAX_PHOTOS_PER_HALF,
  )
}
