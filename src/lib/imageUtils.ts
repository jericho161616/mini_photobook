import { looksLikeSame, perceptualHash } from './perceptualHash'
import type { Photo, PhotoFilter, Placement, SlotRect, Template } from '../types'

type OverlayPosition = NonNullable<Placement['overlayPosition']>

let photoSeq = 0
function nextPhotoId(): string {
  photoSeq += 1
  return `photo-${Date.now().toString(36)}-${photoSeq}`
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Frame colours, shared by the editor and the export.
 *
 * A polaroid frame defaults to white, which on white paper reads as no frame
 * at all — the point of choosing one is lost. These give it something to be.
 */
export const FRAME_COLORS: { id: string; color: string; label: string }[] = [
  { id: 'white', color: '#ffffff', label: 'White' },
  { id: 'cream', color: '#f2ead2', label: 'Cream' },
  { id: 'kraft', color: '#c9a87c', label: 'Kraft' },
  { id: 'sage', color: '#b9c4a8', label: 'Sage' },
  { id: 'blush', color: '#e3b8b0', label: 'Blush' },
  { id: 'slate', color: '#5c7992', label: 'Slate' },
  { id: 'ink', color: '#2b2722', label: 'Ink' },
]

/** What each frame falls back to when no colour has been picked. */
export const FRAME_DEFAULT_COLOR: Record<string, string> = {
  polaroid: '#ffffff',
  stamp: '#f2ead2',
  hairline: '#6b5f4a',
}

/** The frame colour actually in force for a placement. */
export function frameColorFor(
  frame: 'hairline' | 'polaroid' | 'stamp' | undefined,
  frameColor: string | undefined,
  fallbackKey: string,
): string {
  return frameColor ?? FRAME_DEFAULT_COLOR[frame ?? fallbackKey] ?? FRAME_DEFAULT_COLOR[fallbackKey]
}

/** Shared with SlotView and PageView so a photo's filter reads identically whether it's in a slot or a page background. */
export const PHOTO_FILTER_CSS: Record<PhotoFilter, string> = {
  bw: 'grayscale(1)',
  sepia: 'sepia(0.75) saturate(1.1)',
  negative: 'invert(1) hue-rotate(180deg)',
  film: 'sepia(0.22) saturate(1.4) contrast(1.08) brightness(1.05) hue-rotate(-8deg)',
  // Paper carries no color adjustment of its own — see PHOTO_FILTER_OVERLAY,
  // its whole effect is the crease texture layered on top.
  paper: 'none',
}

function svgDataUrl(inner: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(inner)}")`
}

/**
 * A rendered (not referenced-as-filter) noise/crease texture, laid over a
 * photo with mix-blend-mode rather than applied via the CSS `filter`
 * property — `filter: url(#svgFilter)` is unreliable across browsers
 * (notably Safari), where it silently no-ops and the photo looks untouched.
 * A background-image + blend-mode overlay has none of that risk; every
 * browser that can show an <img> can show this. exportPdf.ts's canvas
 * export draws the same idea with actual composite operations.
 */
/** The tileable speckle the Film filter shades with, and the Grain slider dials up on its own. */
export const GRAIN_OVERLAY_IMAGE = svgDataUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
    "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter>" +
    "<rect width='100%' height='100%' filter='url(#g)'/></svg>",
)

/** How wide the tile is laid out — matched by the canvas pattern in exportPdf. */
export const GRAIN_TILE_PX = 140

/**
 * Ceilings for the standalone Grain slider's 0–100.
 *
 * The two render paths need different numbers: a CSS `mix-blend-mode:
 * overlay` layer and a canvas `globalCompositeOperation = 'overlay'` fill
 * don't land in the same place at equal alpha. The Film preset already
 * carries that discrepancy (0.22 in CSS reads like 0.16 on canvas), so these
 * keep the same ratio — a slider at 100% is heavy but still short of
 * obliterating the photo.
 */
export const GRAIN_MAX_CSS = 0.45
export const GRAIN_MAX_CANVAS = 0.33

export const PHOTO_FILTER_OVERLAY: Partial<
  Record<PhotoFilter, { image: string; blend: 'multiply' | 'overlay'; opacity: number; tile?: boolean }>
> = {
  paper: {
    image: svgDataUrl(
      "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
        "<filter id='c'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.018' numOctaves='2' seed='11'/>" +
        "<feColorMatrix type='matrix' values='0 0 0 0 0.42 0 0 0 0 0.37 0 0 0 0 0.3 0.55 0.55 0.55 0 -0.5'/></filter>" +
        "<rect width='100%' height='100%' filter='url(#c)'/></svg>",
    ),
    blend: 'multiply',
    opacity: 0.65,
  },
  film: {
    image: GRAIN_OVERLAY_IMAGE,
    blend: 'overlay',
    opacity: 0.22,
    tile: true,
  },
}

/**
 * Shared with exportPdf so the editor and the printed page agree exactly on
 * how much white mat surrounds an Instant Grid photo, and how much border and
 * rotation the Poster Overlay's taped-on second photo gets.
 */
export const FRAME_INSET_RATIO = 0.1
export const POSTER_BORDER_RATIO = 0.05
export const POSTER_ROTATION_DEG = -6
/** Thickness of the white ring around Circle Inset's second photo, relative to its own diameter. */
export const CIRCLE_BORDER_RATIO = 0.045
/** Margin between a Stamp-framed photo and its scalloped cut edge, relative to the shorter side. */
export const STAMP_INSET_RATIO = 0.05

/**
 * Tape/clip/paperclip geometry, relative to the attaching slot's own size —
 * shared so the editor's CSS (styles.css's .attachment-* / .poster-tape
 * rules, expressed the same way in percent) and exportPdf's canvas drawing
 * agree on proportions. CSS can't import these directly, so keep the two in
 * sync by hand if either changes.
 */
export const TAPE_ROTATION_DEG = -3
export const TAPE_WIDTH_RATIO = 0.4
export const TAPE_HEIGHT_RATIO = 0.16
export const CLIP_WIDTH_RATIO = 0.15
export const CLIP_ASPECT = 34 / 26
export const PAPERCLIP_WIDTH_RATIO = 0.11
export const PAPERCLIP_ASPECT = 44 / 20

type DecorationTemplate = Pick<Template, 'decoration' | 'slotRotations'>

/** True for a 'poster'/'window' decoration's overlay slot(s) — every slot after the first. */
export function isOverlaySlot(template: DecorationTemplate, slotIndex: number): boolean {
  return (template.decoration === 'poster' || template.decoration === 'window') && slotIndex >= 1
}

/**
 * A poster slot falls back to the classic fixed tilt when the template
 * doesn't define its own per-slot angle — shared so the editor and exportPdf
 * agree on exactly what "no explicit rotation" means for that one case.
 */
export function slotRotationDeg(
  template: DecorationTemplate,
  slotIndex: number,
  placement: Placement | null | undefined,
): number {
  const isPoster = template.decoration === 'poster' && slotIndex >= 1
  const base = template.slotRotations?.[slotIndex] ?? (isPoster ? POSTER_ROTATION_DEG : 0)
  return base + (placement?.rotation ?? 0)
}

export interface SlotStyle {
  framed: boolean
  poster: boolean
  circle: boolean
  hairline: boolean
  stamp: boolean
  windowSlot: boolean
  forceFilter: PhotoFilter | undefined
  /** Meaningless unless `poster` is true — which pin a poster-decorated overlay slot draws, if any. */
  posterAttachment: 'tape' | 'paperclip' | 'none'
}

/**
 * Every decorative slot style in one place — which frame/decoration a given
 * slot gets, from the template's own design (Instant Grid, Polaroid Strip,
 * Instagram Contact Strip, Postage Stamp Duo's forced frames; poster/circle/
 * window decorations) and the photo's own placement (frame/hairline/stamp
 * choice). Shared by PageView's two render branches (whole-page and Split at
 * Fold half) and exportPdf's matching two loops, so all four agree on
 * exactly the same rules.
 */
export function resolveSlotStyle(
  template: Pick<Template, 'id' | 'decoration' | 'posterAttachment'>,
  slotIndex: number,
  placement: Placement | null | undefined,
): SlotStyle {
  const poster = template.decoration === 'poster' && slotIndex >= 1
  return {
    framed:
      template.id === 'instantGrid' ||
      template.id === 'polaroidStrip' ||
      template.id === 'igContactStrip' ||
      placement?.frame === 'polaroid',
    poster,
    posterAttachment: poster ? (template.posterAttachment ?? 'tape') : 'tape',
    circle: template.decoration === 'circle' && slotIndex === 1,
    hairline: placement?.frame === 'hairline',
    stamp: template.id === 'postageStampDuo' || placement?.frame === 'stamp',
    windowSlot: template.decoration === 'window' && slotIndex >= 1,
    forceFilter: template.decoration === 'window' && slotIndex === 0 ? 'bw' : undefined,
  }
}

/**
 * True for a background dark enough that the usual dark-ink caption/note text
 * would be unreadable on it — used to flip to light parchment text instead.
 * Shared between the editor and exportPdf so both make the same call.
 */
export function isDarkColor(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // Perceived luminance (ITU-R BT.601) — cheap and good enough for a on/off text-color call.
  const luminance = (r * 299 + g * 587 + b * 114) / 1000
  return luminance < 128
}

/** Read a file's intrinsic pixel dimensions without decoding it into the DOM. */
async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(blob)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dims
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

/** Longest edge of the stored thumbnail — plenty for a tray or filmstrip cell. */
const THUMB_MAX_EDGE = 320

/**
 * Downscale once at import time. Without this, every tray/filmstrip/library
 * cell would decode the full-resolution original just to shrink it into a
 * 60px square — the thing making scrolling feel laggy with real photos.
 */
async function makeThumbnail(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return blob
  }
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const thumbBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.82),
  )
  return thumbBlob ?? blob
}

/** SHA-256 of the file's own bytes, as hex — identical files hash identically regardless of name. */
async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Why an incoming file looks like one already in the book. */
export type DuplicateReason = 'identical' | 'sameName' | 'looksSame'

export interface DuplicateCandidate {
  /** Fully prepared, so accepting it costs nothing more than saving it. */
  photo: Photo
  reason: DuplicateReason
  /** The photo already in the book that it matched — undefined when the match was another file in the same batch. */
  existingId?: string
  /** The name of whatever it matched, for saying so in the dialog. */
  matchedName: string
}

export interface ImportResult {
  /** Files with nothing like them already here — added without asking. */
  photos: Photo[]
  /** Files that resemble something already here. The caller decides. */
  duplicates: DuplicateCandidate[]
}

/**
 * Prepares every accepted file, then sorts them into "new" and "looks like
 * something you already have".
 *
 * Three kinds of resemblance, in descending confidence: the same bytes, the
 * same picture (different bytes — a re-export, a screenshot, a messaging-app
 * copy), and merely the same filename. Every file is prepared either way, so
 * accepting a flagged one afterwards is instant rather than a second decode.
 */
export async function importFiles(
  files: File[],
  projectId: string,
  existing: Photo[],
): Promise<ImportResult> {
  const images = files.filter((f) => ACCEPTED_TYPES.includes(f.type))

  const prepared = await Promise.all(
    images.map(async (file) => {
      const [hash, pHash, { width, height }, thumbBlob] = await Promise.all([
        hashBlob(file),
        perceptualHash(file),
        measure(file),
        makeThumbnail(file),
      ])
      const photo: Photo = {
        id: nextPhotoId(),
        projectId,
        name: file.name,
        blob: file,
        thumbBlob,
        width,
        height,
        addedAt: Date.now() + Math.random(),
        hash,
        pHash,
      }
      return photo
    }),
  )

  const photos: Photo[] = []
  const duplicates: DuplicateCandidate[] = []
  // Files accepted so far this batch count as "already here" for the ones
  // after them, so selecting the same picture twice in one go is caught too.
  const pool: Photo[] = [...existing]

  for (const photo of prepared) {
    const identical = pool.find((p) => p.hash && p.hash === photo.hash)
    const looksSame = identical ? undefined : pool.find((p) => looksLikeSame(p.pHash, photo.pHash))
    const sameName = identical || looksSame ? undefined : pool.find((p) => p.name === photo.name)
    const match = identical ?? looksSame ?? sameName
    if (match) {
      duplicates.push({
        photo,
        reason: identical ? 'identical' : looksSame ? 'looksSame' : 'sameName',
        existingId: match.id,
        matchedName: match.name,
      })
    } else {
      photos.push(photo)
      pool.push(photo)
    }
  }

  return { photos, duplicates }
}


/**
 * Object URLs are handed out per photo and reused, so the same blob isn't
 * decoded once per slot it appears in. Full-resolution and thumbnail URLs are
 * cached separately: the editing canvas and PDF export need the original,
 * everything else (tray, filmstrip, library grid) only ever needs the thumb.
 */
const urlCache = new Map<string, string>()
const thumbUrlCache = new Map<string, string>()

export function photoUrl(photo: Photo): string {
  const cached = urlCache.get(photo.id)
  if (cached) return cached
  const url = URL.createObjectURL(photo.blob)
  urlCache.set(photo.id, url)
  return url
}

/** Small preview URL for anywhere the photo is shown at thumbnail size. */
export function photoThumbUrl(photo: Photo): string {
  const cached = thumbUrlCache.get(photo.id)
  if (cached) return cached
  const url = URL.createObjectURL(photo.thumbBlob ?? photo.blob)
  thumbUrlCache.set(photo.id, url)
  return url
}

export function releasePhotoUrl(photoId: string): void {
  const url = urlCache.get(photoId)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(photoId)
  }
  const thumb = thumbUrlCache.get(photoId)
  if (thumb) {
    URL.revokeObjectURL(thumb)
    thumbUrlCache.delete(photoId)
  }
}

/**
 * Work out how a photo covers its slot. Returns the drawn size and the offset
 * range available for panning, in the slot's own coordinate space.
 *
 * Shared by the on-screen editor and the PDF exporter so what you arrange is
 * exactly what gets printed.
 */
export function coverGeometry(
  photoAspect: number,
  slotWidth: number,
  slotHeight: number,
  placement: Pick<Placement, 'zoom' | 'offsetX' | 'offsetY'>,
) {
  const slotAspect = slotWidth / slotHeight

  let drawWidth: number
  let drawHeight: number
  if (photoAspect > slotAspect) {
    // Photo is wider than the slot: match heights, overflow horizontally.
    drawHeight = slotHeight
    drawWidth = slotHeight * photoAspect
  } else {
    drawWidth = slotWidth
    drawHeight = slotWidth / photoAspect
  }

  drawWidth *= placement.zoom
  drawHeight *= placement.zoom

  const slackX = Math.max(0, drawWidth - slotWidth)
  const slackY = Math.max(0, drawHeight - slotHeight)

  // offset -1..1 maps across the available slack, 0 being centered.
  const x = -slackX / 2 + (placement.offsetX * slackX) / 2
  const y = -slackY / 2 + (placement.offsetY * slackY) / 2

  return { drawWidth, drawHeight, x, y, slackX, slackY }
}

export function clampOffset(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

/** How far a repositioned overlay slot keeps from the page edge, in percent. */
const OVERLAY_MARGIN_PCT = 4

/**
 * Where a 'poster'/'window' decoration's overlay slot actually lands, as a
 * percentage rect — a 3x3 grid of preset spots (the overlay's own size, from
 * the template, is kept; only its position moves). Undefined position keeps
 * the template's own default rect untouched.
 */
export function resolveOverlayPosition(base: SlotRect, position: OverlayPosition | undefined): SlotRect {
  if (!position) return base
  const leftX = OVERLAY_MARGIN_PCT
  const centerX = (100 - base.w) / 2
  const rightX = 100 - base.w - OVERLAY_MARGIN_PCT
  const topY = OVERLAY_MARGIN_PCT
  const middleY = (100 - base.h) / 2
  const bottomY = 100 - base.h - OVERLAY_MARGIN_PCT
  const xByPosition: Record<OverlayPosition, number> = {
    tl: leftX, ml: leftX, bl: leftX,
    tc: centerX, mc: centerX, bc: centerX,
    tr: rightX, mr: rightX, br: rightX,
  }
  const yByPosition: Record<OverlayPosition, number> = {
    tl: topY, tc: topY, tr: topY,
    ml: middleY, mc: middleY, mr: middleY,
    bl: bottomY, bc: bottomY, br: bottomY,
  }
  return { ...base, x: xByPosition[position], y: yByPosition[position] }
}

/**
 * A scalloped "postage stamp" edge as a sequence of points — straight lines
 * rather than true arcs, so the exact same points draw identically as an SVG
 * polygon on screen and as a canvas path in exportPdf, pixel for pixel.
 */
export function stampScallopPoints(w: number, h: number): { x: number; y: number }[] {
  const bump = Math.max(2, Math.min(w, h) * 0.035)
  const perSide = (length: number) => Math.max(4, Math.round(length / 22))
  const points: { x: number; y: number }[] = []
  function edge(x1: number, y1: number, x2: number, y2: number, count: number) {
    const nx = -(y2 - y1)
    const ny = x2 - x1
    const len = Math.hypot(nx, ny) || 1
    for (let i = 0; i < count; i++) {
      const t0 = i / count
      const t1 = (i + 1) / count
      const midT = (t0 + t1) / 2
      const mx = x1 + (x2 - x1) * midT
      const my = y1 + (y2 - y1) * midT
      points.push({ x: mx - (nx / len) * bump, y: my - (ny / len) * bump })
      points.push({ x: x1 + (x2 - x1) * t1, y: y1 + (y2 - y1) * t1 })
    }
  }
  edge(0, 0, w, 0, perSide(w))
  edge(w, 0, w, h, perSide(h))
  edge(w, h, 0, h, perSide(w))
  edge(0, h, 0, 0, perSide(h))
  return points
}

/** The Stamp frame's scalloped edge as a CSS `clip-path: polygon(...)` value, for a box of the given pixel size. */
export function stampClipPathCss(w: number, h: number): string {
  return `polygon(${stampScallopPoints(w, h)
    .map((p) => `${p.x}px ${p.y}px`)
    .join(', ')})`
}

/** Pixel rect of a slot inside a page of the given pixel size, honoring margin. */
export function slotPixelRect(
  slot: SlotRect,
  pageWidth: number,
  pageHeight: number,
  marginRatio: number,
) {
  const inset = { x: pageWidth * marginRatio, y: pageHeight * marginRatio }
  const innerW = pageWidth - inset.x * 2
  const innerH = pageHeight - inset.y * 2
  return {
    x: inset.x + (slot.x / 100) * innerW,
    y: inset.y + (slot.y / 100) * innerH,
    w: (slot.w / 100) * innerW,
    h: (slot.h / 100) * innerH,
  }
}
