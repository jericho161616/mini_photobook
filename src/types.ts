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
  /** Edge-to-edge: the page margin is skipped for this template. */
  bleed?: boolean
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

export interface Page {
  id: string
  templateId: string
  /** One entry per template slot; null means the slot is empty. */
  placements: (Placement | null)[]
  /** Locked pages ignore template changes, photo drops, panning, and reordering. */
  locked: boolean
}

export interface Project {
  id: string
  title: string
  sizeId: string
  pages: Page[]
  updatedAt: number
}

export const MIN_PAGES = 10
export const MAX_PAGES = 30
