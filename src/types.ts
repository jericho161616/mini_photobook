/**
 * Layout character of a template's slots — lets pages mix freely within one
 * book. 'instagram' isn't ratio-derived like the other three (see
 * data/sizes.ts's bookShape) — it's a manual tag on the Instagram Story-only
 * templates, so they can be filtered to as their own group.
 */
export type Shape = 'square' | 'tall' | 'wide' | 'instagram'

export type TemplateFamily = 'Minimal' | 'Portfolio' | 'Instagram'

/**
 * The eight built-ins are on every computer already (nothing downloaded,
 * ever). Beyond those, a FontId can also name one of this book's own added
 * fonts — a file you dropped in, or one picked off your machine — which is
 * why this is a plain string rather than a closed union. Unknown ids fall
 * back to the default serif, so a book opened without its fonts still reads.
 */
export type BuiltInFontId = 'serif' | 'sans' | 'mono' | 'hand1' | 'hand2' | 'brush' | 'condensed' | 'slab'
export type FontId = BuiltInFontId | (string & {})

/**
 * A font added to this book — either a file dropped in, or one read off the
 * machine with the Local Font Access API. `data` is kept so the book still
 * has the font on another computer; `local` marks the ones that came from an
 * installed family, where the name alone is enough.
 */
export interface CustomFont {
  id: string
  /** What to show in the picker — the family name. */
  name: string
  /** The CSS family this registers as, unique per font so two "Script" faces can't collide. */
  family: string
  /** The font file, base64 in a data URL. Absent for a `local` font, which needs no file. */
  data?: string
  /** True when this is an installed family found by scanning, not an uploaded file. */
  local?: boolean
}

/**
 * A percentage of the size the layout would pick on its own — 100 is that
 * default, 150 is half again. Relative rather than absolute because the real
 * size is always computed from the space available, so the same book reads
 * correctly at any page size.
 *
 * The four old presets are still accepted so books made before this keep
 * their sizing; fontSizeScale maps them.
 */
export type FontSize = number | 'sm' | 'md' | 'lg' | 'xl'

export const MIN_FONT_SIZE = 50
export const MAX_FONT_SIZE = 300

export interface TextStyle {
  font: FontId
  bold: boolean
  /**
   * An explicit ink colour. Undefined keeps the automatic behaviour, where a
   * note flips between dark ink and light parchment to stay legible against
   * the page. Setting one turns that off: an explicit choice wins, even where
   * it lands dark-on-dark.
   */
  color?: string
  /** Undefined means 'md', the original default size. */
  size?: FontSize
}

/** Applied to a photo in its slot — the print itself is untouched, only the placement. */
export type PhotoFilter = 'bw' | 'sepia' | 'negative' | 'film' | 'paper'

/**
 * The built-ins are drawn with CSS/SVG at render time — nothing downloaded,
 * nothing to license. 'custom' is the user's own drawing (see CustomSticker)
 * — still never downloaded or shared anywhere, just kept on this device.
 */
export type StickerType = 'tape-yellow' | 'tape-pink' | 'tape-sage' | 'heart' | 'star' | 'arrow' | 'custom'

/** A decorative element placed freely on a page (or one half of a folded page). */
export interface Sticker {
  id: string
  type: StickerType
  /** Which drawing from the book's custom sticker library — set only when type is 'custom'. */
  customId?: string
  /** Percent of the page/half's own width and height. */
  x: number
  y: number
  w: number
  h: number
  /** Tilt in degrees. Undefined means untilted. */
  rotation?: number
  /** Mirrored left-to-right. Undefined means not mirrored. */
  flipX?: boolean
  /**
   * Overrides the built-in glyph's own fixed color — a flat fill for tape, the
   * stroke for the line-drawn icons. Deliberately not offered for 'custom'
   * drawings: recoloring a multi-color drawing to one flat hue looks wrong, so
   * the toolbar offers opacity there instead.
   */
  color?: string
  /** 0–100. Undefined means fully opaque. */
  opacity?: number
}

/**
 * A doodle drawn in the Decorate panel and saved so it can be stamped onto
 * any number of pages, like the built-in stickers — kept at the book level
 * rather than per-page since the same drawing is meant to be reused.
 */
export interface CustomSticker {
  id: string
  /** A small transparent PNG data URL, trimmed to the drawing's own bounds. */
  dataUrl: string
}

/** A free-form text box placed anywhere on a page — not tied to a template's textSlot. */
export interface TextBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  font: FontId
  bold: boolean
  /** An explicit ink colour — undefined keeps the automatic light/dark choice. */
  color?: string
  /** Undefined means not italic. */
  italic?: boolean
  align: 'left' | 'center' | 'right'
  /** Undefined means 'md', the original default size. */
  size?: FontSize
}

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
  /**
   * Centers the note instead of the usual left-aligned strip under a photo;
   * 'ruled' draws faint lines behind it, like a diary page; 'quote' sets it
   * large and italic with a decorative opening mark, anchored near the
   * bottom; 'divider' sets it large and centered with a rule beneath, for a
   * text-only page; 'stamp' gives it the same scalloped card as the Stamp
   * frame, so a caption can sit in its own "stamp" beside a photo.
   */
  captionStyle?: 'centered' | 'ruled' | 'quote' | 'divider' | 'stamp'
  /**
   * Second-slot-onward styling for an overlay template: 'poster' tapes each
   * slot after the first on top at an angle (their own tilts come from
   * slotRotations); 'circle' insets the second slot as a centered circular
   * portrait; 'beforeAfter' draws a divider and small "before"/"after"
   * labels between the two slots; 'window' forces the first slot to
   * grayscale and cuts a sharp color window through it at the second slot —
   * no tape, no rotation, no border.
   */
  decoration?: 'poster' | 'circle' | 'beforeAfter' | 'window'
  /**
   * What a 'poster'-decorated overlay slot (index 1 onward) is pinned with —
   * undefined/'tape' matches the original look (Poster Overlay, Overlapping
   * Duo); 'paperclip' swaps in the paperclip graphic instead; 'none' drops
   * the attachment entirely for a plain bordered card with no pin.
   */
  posterAttachment?: 'tape' | 'paperclip' | 'none'
  /**
   * A fixed tilt per slot, baked into the design (Confetti Scatter) rather
   * than user-adjustable — same idea as Poster Overlay's fixed -6°, just one
   * angle per slot instead of only the second one.
   */
  slotRotations?: number[]
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
  /** Floor for this size's own page count — undefined means the book-wide MIN_PAGES applies. Lets a digital-only size like Instagram Story start (and shrink back down to) a single page. */
  minPages?: number
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
  /** SHA-256 of the file's own bytes — lets a re-imported copy of the same file be caught and skipped. Undefined for photos imported before this existed. */
  hash?: string
  /** Fingerprint of what the picture looks like, so a re-export or screenshot of the same shot is recognised even though its bytes differ. */
  pHash?: string
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
  /** Undefined means full color. */
  filter?: PhotoFilter
  /** How solid this photo is, 0–100 — undefined means fully opaque. Same control the page background already had. */
  opacity?: number
  /** Film-grain speckle over this photo, 0–100. Undefined means none; the Film filter brings its own regardless. */
  grain?: number
  /** Undefined means no frame — a plain crop. 'stamp' cuts a scalloped postage-stamp edge. */
  frame?: 'hairline' | 'polaroid' | 'stamp'
  /**
   * The frame's own colour — the card for a polaroid or stamp, the rule for a
   * hairline. Undefined keeps each frame's default, which for a polaroid is
   * white and so nearly invisible against white paper.
   */
  frameColor?: string
  /** Manual tilt in degrees, on top of any fixed rotation the template itself applies. Undefined means 0. */
  rotation?: number
  /** A piece of tape, a binder clip, or a paperclip pinning the photo to the page — independent of, and combinable with, any frame. */
  attachment?: 'tape' | 'clip' | 'paperclip'
  /** Tape's own color — meaningless (and ignored) for clip/paperclip, which are always the same neutral material. */
  attachmentColor?: string
  /**
   * Where a 'poster' or 'window' decoration's second-and-later slot actually
   * sits — one of a 3×3 grid of preset spots, overriding that slot's default
   * template position while keeping its size. Undefined uses the template's
   * own position.
   */
  overlayPosition?: 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'
}

/** One side of a "Split at Fold" page — its own independent layout and photos. */
export interface HalfLayout {
  templateId: string
  /** One entry per this half's own template slot; null means the slot is empty. */
  placements: (Placement | null)[]
  /** This half's own note — blank unless its template reserves a textSlot. */
  text: string
  /** Undefined means the default font (serif) at normal weight. */
  textStyle?: TextStyle
  /** Freely placed decorations, confined to this half so nothing crosses the fold. */
  stickers?: Sticker[]
  textBoxes?: TextBox[]
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
  /** Undefined means the default font (serif) at normal weight. */
  textStyle?: TextStyle
  /**
   * Overrides the book's size for this one page — used to mix portrait and
   * landscape pages within the A4 family. Undefined means "use the book's
   * own size," which is true for every page outside that family.
   */
  sizeId?: string
  /** Set only when this page's template is one of the two "Split at Fold" ones. */
  halves?: [HalfLayout, HalfLayout]
  /** Freely placed decorations — unused while `halves` is set; see HalfLayout. */
  stickers?: Sticker[]
  textBoxes?: TextBox[]
  /** A tinted "cardstock" page background. Undefined means the default paper color. Mutually exclusive with backgroundPhotoId. */
  backgroundColor?: string
  /** A full-bleed photo behind this page's slots. Any photo can be reused here even if it's also placed in a slot. Unavailable on Full Bleed / Full Sheet templates, which are already entirely one photo. */
  backgroundPhotoId?: string
  /** How much to darken backgroundPhotoId for legibility, 0–100. Meaningless without one. */
  backgroundDim?: number
  /**
   * How solid backgroundPhotoId is, 0–100 — undefined means fully opaque.
   * Distinct from backgroundDim: this fades the photo towards the paper
   * underneath, where Darken lays a black scrim over it.
   */
  backgroundPhotoOpacity?: number
  /** Standalone film-grain speckle over backgroundPhotoId, 0–100. Undefined means none — the Film filter brings its own regardless. */
  backgroundGrain?: number
  /** How much of the page backgroundPhotoId covers — undefined (or 'full') means edge to edge. */
  backgroundPhotoCoverage?: 'full' | 'left' | 'right' | 'top' | 'bottom'
  /** Same B&W/sepia/negative treatment as a slotted photo's filter, applied to backgroundPhotoId. */
  backgroundPhotoFilter?: PhotoFilter
  /** Multiplies the template's own margin — 1 is the default, smaller is tighter, larger is looser. */
  marginScale?: number
}

export interface Project {
  id: string
  title: string
  sizeId: string
  pages: Page[]
  createdAt: number
  updatedAt: number
  /** Set when the book is sitting in Trash — undefined means it's active. */
  deletedAt?: number
  /** This book's own library of hand-drawn stickers — undefined on older books means none yet. */
  customStickers?: CustomSticker[]
  /** Fonts added to this book, by upload or by scanning the machine. Undefined on older books means none. */
  customFonts?: CustomFont[]
  /** Colours mixed by hand in this book, most recent first — the palettes are always one click away and aren't kept here. */
  recentColors?: string[]
}

/** How long a trashed book is kept before it's purged for good. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export const MIN_PAGES = 10
export const MAX_PAGES = 30
