import { FEED_SIZE_IDS, FOLD_SIZE_IDS } from './sizes'
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
    // Also the standard "four-square" story layout — the grid stays evenly
    // split whether the cells land square (on a square page) or tall (on a
    // narrow one like Instagram Story).
    fits: ['square', 'tall'],
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
    id: 'sixGrid',
    label: '6 · Grid',
    family: 'Minimal',
    // The 6-photo option of the story grid family — three even rows of two,
    // plain crops with no card mount, sized for a narrow tall page.
    fits: ['tall'],
    slots: [
      { x: 0, y: 0, w: 46, h: 30 },
      { x: 54, y: 0, w: 46, h: 30 },
      { x: 0, y: 35, w: 46, h: 30 },
      { x: 54, y: 35, w: 46, h: 30 },
      { x: 0, y: 70, w: 46, h: 30 },
      { x: 54, y: 70, w: 46, h: 30 },
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
    // Reads as a narrow left/right split on a tall page too — the other
    // half of "2-photo grid: side-by-side or stacked" (duoH is the stack).
    fits: ['wide', 'square', 'tall'],
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
    // The "one large box, two smaller ones" of the 3-photo grid family — a
    // big top photo with room to breathe reads fine narrow-tall too.
    fits: ['square', 'wide', 'tall'],
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
    // Also the "split vertically" option of the 3-photo grid family — three
    // narrow columns read fine on a tall page, same idea as duoV's split.
    fits: ['wide', 'tall'],
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
    id: 'contactSheet',
    label: '9 · Contact Sheet',
    family: 'Minimal',
    fits: ['square', 'wide'],
    // A dense wall of small even prints, like a lab contact sheet — plain
    // crops, no card mount (pair with the per-photo Frame option for that).
    slots: [
      { x: 0, y: 0, w: 31, h: 31 },
      { x: 34.5, y: 0, w: 31, h: 31 },
      { x: 69, y: 0, w: 31, h: 31 },
      { x: 0, y: 34.5, w: 31, h: 31 },
      { x: 34.5, y: 34.5, w: 31, h: 31 },
      { x: 69, y: 34.5, w: 31, h: 31 },
      { x: 0, y: 69, w: 31, h: 31 },
      { x: 34.5, y: 69, w: 31, h: 31 },
      { x: 69, y: 69, w: 31, h: 31 },
    ],
  },
  {
    id: 'diaryTimeline',
    label: '3 · Diary',
    family: 'Minimal',
    fits: ['wide', 'square'],
    // Three small photos down the left third, a ruled note column beside
    // them — a day in photos plus room to actually write about it.
    slots: [
      { x: 0, y: 0, w: 31, h: 31 },
      { x: 0, y: 34.5, w: 31, h: 31 },
      { x: 0, y: 69, w: 31, h: 31 },
    ],
    textSlot: { x: 35, y: 2, w: 65, h: 96 },
    captionStyle: 'ruled',
  },
  {
    id: 'confettiScatter',
    label: '7 · Confetti Scatter',
    family: 'Portfolio',
    fits: ['square', 'wide'],
    // Denser and looser than Loose Collage — each slot carries its own fixed
    // tilt (slotRotations, in the same slot order), like tossed prints.
    slots: [
      { x: 4, y: 6, w: 30, h: 24 },
      { x: 36, y: 3, w: 26, h: 21 },
      { x: 64, y: 9, w: 32, h: 26 },
      { x: 8, y: 38, w: 28, h: 23 },
      { x: 40, y: 35, w: 34, h: 28 },
      { x: 12, y: 66, w: 30, h: 24 },
      { x: 50, y: 68, w: 32, h: 26 },
    ],
    slotRotations: [-8, 6, -4, 5, -10, 9, -6],
  },
  {
    id: 'beforeAfter',
    label: '2 · Before & After',
    family: 'Portfolio',
    fits: ['wide'],
    bleed: true,
    // A clean diptych with a divider and small labels, drawn by
    // PageView/exportPdf rather than being part of either slot.
    decoration: 'beforeAfter',
    slots: [
      { x: 0, y: 0, w: 50, h: 100 },
      { x: 50, y: 0, w: 50, h: 100 },
    ],
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
  {
    id: 'polaroidStrip',
    label: '3 · Polaroid Strip',
    family: 'Portfolio',
    fits: ['tall', 'square'],
    // Each slot gets the Polaroid frame automatically, like Instant Grid —
    // meant to be paired with the Night page background for a contact-strip look.
    slots: [
      { x: 22, y: 3, w: 56, h: 28 },
      { x: 22, y: 36, w: 56, h: 28 },
      { x: 22, y: 69, w: 56, h: 28 },
    ],
  },
  {
    id: 'overlappingDuo',
    label: '3 · Overlapping Duo',
    family: 'Portfolio',
    fits: ['square', 'wide', 'tall'],
    bleed: true,
    // Same taped-on-top idea as Poster Overlay, generalized to every slot
    // after the first — each one keeps its own tilt from slotRotations
    // instead of sharing one fixed angle.
    decoration: 'poster',
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 8, y: 14, w: 52, h: 50 },
      { x: 36, y: 38, w: 52, h: 50 },
    ],
    slotRotations: [0, -7, 6],
  },
  {
    id: 'postageStampDuo',
    label: '1 · Postage Stamp Duo',
    family: 'Portfolio',
    fits: ['wide'],
    // The photo slot always gets the Stamp frame (see PageView/exportPdf);
    // the note sits in a matching scalloped card of its own beside it.
    slots: [{ x: 6, y: 14, w: 40, h: 72 }],
    textSlot: { x: 54, y: 14, w: 40, h: 72 },
    captionStyle: 'stamp',
  },
  {
    id: 'quoteCard',
    label: '1 · Quote Card',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    slots: [{ x: 8, y: 8, w: 40, h: 40 }],
    textSlot: { x: 8, y: 54, w: 84, h: 38 },
    captionStyle: 'quote',
  },
  {
    id: 'photoWindow',
    label: '2 · Photo Window',
    family: 'Portfolio',
    fits: ['square', 'tall', 'wide'],
    bleed: true,
    // The background is forced to grayscale and a sharp color window is cut
    // through it at the second slot — no tape, no rotation, no border.
    decoration: 'window',
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 26, y: 30, w: 48, h: 34 },
    ],
  },
  {
    id: 'textDivider',
    label: '0 · Text Divider',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    // No photo at all — a title/quote page to open or close a section of the book.
    slots: [],
    textSlot: { x: 12, y: 38, w: 76, h: 24 },
    captionStyle: 'divider',
  },

  // ---- Instagram Story only — see data/sizes.ts's SOCIAL_SIZES ----
  {
    id: 'igAsymCol',
    label: '5 · Asymmetric Column',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    slots: [
      { x: 0, y: 0, w: 48, h: 58 },
      { x: 0, y: 62, w: 48, h: 36 },
      { x: 52, y: 0, w: 48, h: 22 },
      { x: 52, y: 26, w: 48, h: 40 },
      { x: 52, y: 70, w: 48, h: 28 },
    ],
  },
  {
    id: 'igFeatureStrip',
    label: '4 · Feature + Strip',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    slots: [
      { x: 0, y: 0, w: 38, h: 100 },
      { x: 42, y: 0, w: 58, h: 30 },
      { x: 42, y: 35, w: 58, h: 30 },
      { x: 42, y: 70, w: 58, h: 30 },
    ],
  },
  {
    id: 'igStripFeature',
    label: '5 · Strip + Feature',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    slots: [
      { x: 0, y: 0, w: 38, h: 22 },
      { x: 0, y: 26, w: 38, h: 22 },
      { x: 0, y: 52, w: 38, h: 22 },
      { x: 0, y: 78, w: 38, h: 22 },
      { x: 42, y: 0, w: 58, h: 100 },
    ],
  },
  {
    id: 'igMixedRows',
    label: '5 · Mixed Rows',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    slots: [
      { x: 0, y: 0, w: 42, h: 26 },
      { x: 46, y: 6, w: 54, h: 24 },
      { x: 0, y: 34, w: 100, h: 30 },
      { x: 0, y: 68, w: 48, h: 30 },
      { x: 52, y: 68, w: 48, h: 30 },
    ],
  },
  {
    id: 'igStaggered',
    label: '4 · Staggered',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    slots: [
      { x: 0, y: 0, w: 52, h: 44 },
      { x: 56, y: 0, w: 44, h: 56 },
      { x: 0, y: 62, w: 38, h: 36 },
      { x: 42, y: 64, w: 58, h: 34 },
    ],
  },
  {
    id: 'igContactStrip',
    label: '4 · Contact Strip',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    // Framed like Instant Grid / Polaroid Strip (see resolveSlotStyle) — a
    // narrow centered column with generous margin on both sides, reading as
    // a photo-booth strip rather than an edge-to-edge grid.
    slots: [
      { x: 30, y: 2, w: 40, h: 22 },
      { x: 30, y: 26, w: 40, h: 22 },
      { x: 30, y: 50, w: 40, h: 22 },
      { x: 30, y: 74, w: 40, h: 22 },
    ],
  },
  {
    id: 'igPosterDuo',
    label: '3 · Poster Duo',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    bleed: true,
    decoration: 'poster',
    // Straight, not tossed-on — unlike Poster Overlay/Overlapping Duo, these
    // insets stack cleanly rather than tilting.
    posterAttachment: 'none',
    slotRotations: [0, 0, 0],
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 22, y: 18, w: 56, h: 28 },
      { x: 22, y: 50, w: 56, h: 28 },
    ],
  },
  {
    id: 'igPaperclipNote',
    label: '2 · Paperclip Note',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    bleed: true,
    decoration: 'poster',
    posterAttachment: 'paperclip',
    slotRotations: [0, 0],
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 14, y: 24, w: 72, h: 46 },
    ],
  },
  {
    id: 'igScattered',
    label: '4 · Scattered',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: ['ig-story'],
    bleed: true,
    decoration: 'poster',
    posterAttachment: 'none',
    slotRotations: [0, 0, 0, 0],
    slots: [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 22, y: 14, w: 22, h: 14 },
      { x: 64, y: 34, w: 22, h: 14 },
      { x: 44, y: 56, w: 22, h: 14 },
    ],
  },

  // ---- Feed formats only — see data/sizes.ts's FEED_SIZE_IDS ----
  // A carousel slide carries more text than a book page does: the picture
  // stops the scroll, the words are why anyone swipes. So most of these give
  // real room to a note rather than treating it as a caption afterthought.
  {
    id: 'feedHook',
    label: '1 · Hook',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    // The opening slide: one photo doing the work, the line underneath saying
    // what the rest of the carousel is about.
    slots: [{ x: 0, y: 0, w: 100, h: 66 }],
    textSlot: { x: 4, y: 72, w: 92, h: 24 },
    captionStyle: 'centered',
  },
  {
    id: 'feedSplit',
    label: '1 · Split Note',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    // The workhorse body slide — photo over paragraph, in even halves.
    slots: [{ x: 0, y: 0, w: 100, h: 50 }],
    textSlot: { x: 4, y: 56, w: 92, h: 40 },
  },
  {
    id: 'feedQuote',
    label: '1 · Quote',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    slots: [{ x: 14, y: 4, w: 72, h: 52 }],
    textSlot: { x: 10, y: 62, w: 80, h: 32 },
    captionStyle: 'quote',
  },
  {
    id: 'feedDuo',
    label: '2 · Stacked',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    slots: [
      { x: 0, y: 0, w: 100, h: 48 },
      { x: 0, y: 52, w: 100, h: 48 },
    ],
  },
  {
    id: 'feedTrio',
    label: '3 · Feature + Pair',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    slots: [
      { x: 0, y: 0, w: 100, h: 56 },
      { x: 0, y: 60, w: 48, h: 40 },
      { x: 52, y: 60, w: 48, h: 40 },
    ],
  },
  {
    id: 'feedContact',
    label: '6 · Contact Sheet',
    family: 'Instagram',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    // The dump slide near the end of a carousel — six frames, even gutters.
    // Excluded from Landscape on its own, which caps at four photos.
    slots: [
      { x: 0, y: 0, w: 48, h: 31 },
      { x: 52, y: 0, w: 48, h: 31 },
      { x: 0, y: 34.5, w: 48, h: 31 },
      { x: 52, y: 34.5, w: 48, h: 31 },
      { x: 0, y: 69, w: 48, h: 31 },
      { x: 52, y: 69, w: 48, h: 31 },
    ],
  },

  // ---- Seamless: one artboard cut into several slides ----
  //
  // Every rect below is a percentage of the *whole strip*, not of one slide,
  // and the cuts fall at even fractions of it (a 3-wide strip is cut at 33.3%
  // and 66.7%). Slots are placed to straddle those numbers on purpose: a
  // photo lying across a cut arrives as two halves on two consecutive slides,
  // and swiping reassembles it. That is the entire trick — there is no
  // special-casing anywhere, only rectangles that happen to overlap a cut.
  //
  // All of them bleed, because a margin would draw a visible frame around
  // each slide and undo the effect.
  {
    id: 'seamPano3',
    label: '1 · Panorama — 3 slides',
    family: 'Seamless',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    span: 3,
    bleed: true,
    // The simplest case, and the one to try first: a single wide photo cut
    // into three. Best with something genuinely panoramic.
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'seamPano2',
    label: '1 · Panorama — 2 slides',
    family: 'Seamless',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    span: 2,
    bleed: true,
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'seamBand3',
    label: '4 · Band — 3 slides',
    family: 'Seamless',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    span: 3,
    bleed: true,
    // A wide photo running the full height behind, with three portraits laid
    // over the middle band. The second and third straddle the two cuts.
    slots: [
      { x: 0, y: 0, w: 30, h: 100 },
      { x: 24, y: 18, w: 22, h: 64 },
      { x: 52, y: 12, w: 24, h: 76 },
      { x: 78, y: 20, w: 22, h: 60 },
    ],
  },
  {
    id: 'seamStagger3',
    label: '6 · Staggered — 3 slides',
    family: 'Seamless',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    span: 3,
    bleed: true,
    // Two rows at different heights, offset so the seams land inside photos
    // rather than in the gaps between them.
    slots: [
      { x: 0, y: 4, w: 24, h: 52 },
      { x: 26, y: 14, w: 26, h: 52 },
      { x: 54, y: 2, w: 22, h: 54 },
      { x: 78, y: 12, w: 22, h: 52 },
      { x: 8, y: 60, w: 30, h: 38 },
      { x: 44, y: 68, w: 34, h: 32 },
    ],
  },
  {
    id: 'seamFilm3',
    label: '6 · Film Strip — 3 slides',
    family: 'Seamless',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    span: 3,
    bleed: true,
    // An even run of frames at one height, like a contact strip unrolled
    // across the whole carousel. Every seam falls mid-frame.
    slots: [
      { x: 1, y: 26, w: 15, h: 48 },
      { x: 17.5, y: 26, w: 15, h: 48 },
      { x: 34, y: 26, w: 15, h: 48 },
      { x: 50.5, y: 26, w: 15, h: 48 },
      { x: 67, y: 26, w: 15, h: 48 },
      { x: 83.5, y: 26, w: 15, h: 48 },
    ],
  },
  {
    id: 'seamMinimal3',
    label: '4 · Quiet Band — 3 slides',
    family: 'Seamless',
    fits: ['instagram'],
    onlyFor: FEED_SIZE_IDS,
    span: 3,
    bleed: true,
    // The minimalist read: small photos in a narrow band with most of the
    // frame left empty, so the ground does the work. Pair it with a page
    // background colour from the Decorate panel.
    slots: [
      { x: 4, y: 38, w: 12, h: 24 },
      { x: 27, y: 30, w: 18, h: 40 },
      { x: 56, y: 36, w: 13, h: 28 },
      { x: 78, y: 32, w: 17, h: 36 },
    ],
  },
]

export const SHAPE_FILTERS: { id: Shape | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'square', label: 'Square' },
  { id: 'tall', label: 'Tall' },
  { id: 'wide', label: 'Wide' },
  { id: 'instagram', label: 'Instagram' },
]

/**
 * A second, orthogonal way to narrow the template list, once picking by
 * shape alone stopped being enough to find anything in ~40 options. Derived
 * from each template's own existing fields rather than a new one on
 * `Template`, so this is purely a browsing aid, not a data change.
 */
export type StyleCategory = 'seamless' | 'classic' | 'grids' | 'overlays' | 'text' | 'novelty'

const GRID_IDS = new Set([
  'grid4',
  'squareGrid4',
  'instantGrid',
  'contactSheet',
  'asymGrid',
  'igAsymCol',
  'igFeatureStrip',
  'igStripFeature',
  'igMixedRows',
  'igStaggered',
  'feedContact',
  'feedTrio',
])
const NOVELTY_IDS = new Set(['polaroid', 'polaroidNote', 'polaroidStrip', 'confettiScatter', 'igContactStrip'])
const TEXT_FORWARD_CAPTION_STYLES = new Set<Template['captionStyle']>(['quote', 'divider', 'stamp', 'ruled'])

export function templateStyleCategory(template: Template): StyleCategory {
  // Spanning comes first: how many slides a layout covers matters more than
  // what it puts on them, and it's the one thing you can't get any other way.
  if (template.span && template.span > 1) return 'seamless'
  if (template.decoration) return 'overlays'
  if (GRID_IDS.has(template.id)) return 'grids'
  if (NOVELTY_IDS.has(template.id)) return 'novelty'
  if (template.captionStyle && TEXT_FORWARD_CAPTION_STYLES.has(template.captionStyle)) return 'text'
  return 'classic'
}

export const STYLE_FILTERS: { id: StyleCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All styles' },
  { id: 'seamless', label: 'Seamless' },
  { id: 'classic', label: 'Classic' },
  { id: 'grids', label: 'Grids' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'text', label: 'Text-forward' },
  { id: 'novelty', label: 'Novelty' },
]

/**
 * True for a template whose one slot already covers the entire page edge to
 * edge (Full Bleed, and A4 Folded's Full Sheet) — a background photo would
 * sit entirely hidden behind it, so the option isn't offered there.
 */
export function isFullSheetTemplate(template: Template): boolean {
  return (
    !!template.bleed &&
    template.slots.length === 1 &&
    template.slots[0].w === 100 &&
    template.slots[0].h === 100
  )
}

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
    // A spanning layout's slots are spread over several slides, so its density
    // is judged per slide rather than against the whole strip at once.
    const perSlide = t.slots.length / (t.span ?? 1)
    if (perSlide > size.maxPhotosPerPage) return false
    if (t.onlyFor) return t.onlyFor.includes(size.id)
    return !FOLD_SIZE_IDS.has(size.id)
  })
}

/**
 * Narrows templatesForSize to what this particular page could actually take.
 * The only thing that gets excluded is a spanning layout wide enough to push
 * the carousel past its slide limit — offering one and then silently refusing
 * it would be worse than not offering it.
 */
export function templatesForPage(
  size: BookSize,
  currentSpan: number,
  otherSlides: number,
  maxSlides: number,
): Template[] {
  return templatesForSize(size).filter((t) => {
    const span = t.span ?? 1
    if (span === currentSpan) return true
    return otherSlides + span <= maxSlides
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
