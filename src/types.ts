/** Layout character of a template's slots — lets pages mix freely within one book. */
export type Shape = 'square' | 'tall' | 'wide'

export type TemplateFamily = 'Minimal' | 'Portfolio'

/** A slot rect in page-relative percentages, measured inside the page margin. */
export interface SlotRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Template {
  id: string
  label: string
  family: TemplateFamily
  fits: Shape[]
  slots: SlotRect[]
  /** Optional area for the book title, e.g. beneath a cover photo. */
  caption?: SlotRect
  /**
   * Optional area for the designer's own note on this page — a date, a place,
   * a line of text. Only templates that reserve room for it offer the option;
   * everywhere else, there's nowhere for text to go.
   */
  textSlot?: SlotRect
  /** Edge-to-edge: the page margin is skipped for this template. */
  bleed?: boolean
  /**
   * Restricts this template to specific book-size ids — used for the A4
   * Folded templates, which only make sense on the folded-sheet sizes they
   * were designed for.
   */
  onlyFor?: string[]
  /**
   * Marks the two "Split at Fold" templates — each of their two slots isn't a
   * photo slot itself, but a region holding its own independent HalfLayout
   * (own template, own photos), so each side of the fold can be composed
   * differently rather than always being one photo per side.
   */
  halfSplit?: boolean
}

export interface BookSize {
  id: string
  name: string
  /** Trim width in inches. */
  widthIn: number
  /** Trim height in inches. */
  heightIn: number
  /** Above this, pages start to feel crowded rather than composed. */
  maxPhotosPerPage: number
}

export interface Photo {
  id: string
  /** Which book this photo belongs to — books keep fully separate photo sets. */
  projectId: string
  name: string
  /** Full-resolution original, kept as a blob so nothing leaves the machine. */
  blob: Blob
  /** Downscaled once at import — used everywhere the photo appears at thumbnail size. */
  thumbBlob: Blob
  width: number
  height: number
  addedAt: number
}

/**
 * How a photo sits inside its slot. The photo is scaled to cover the slot at
 * zoom 1; offsets pan it within the overflow, in units of the slack available
 * on each axis (-1 = flush against one edge, 1 = the other, 0 = centered).
 */
export interface Placement {
  photoId: string
  zoom: number
  offsetX: number
  offsetY: number
}

/** One side of a "Split at Fold" page — its own independent layout and photos. */
export interface HalfLayout {
  templateId: string
  /** One entry per this half's own template slot; null means the slot is empty. */
  placements: (Placement | null)[]
}

export interface Page {
  id: string
  templateId: string
  /** One entry per template slot; null means the slot is empty. Unused (and
   *  stale) while `halves` is set — a Split at Fold page's photos live there. */
  placements: (Placement | null)[]
  /** Locked pages ignore template changes, photo drops, panning, and reordering. */
  locked: boolean
  /** The designer's own note for this page — blank unless the template has a textSlot. */
  text: string
  /**
   * Overrides the book's size for this one page — used to mix portrait and
   * landscape pages within the A4 family. Undefined means "use the book's
   * own size," which is true for every page outside that family.
   */
  sizeId?: string
  /** Set only when this page's template is one of the two "Split at Fold" ones. */
  halves?: [HalfLayout, HalfLayout]
}

export interface Project {
  id: string
  title: string
  sizeId: string
  pages: Page[]
  createdAt: number
  updatedAt: number
}

export const MIN_PAGES = 10
export const MAX_PAGES = 30
