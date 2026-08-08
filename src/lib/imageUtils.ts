import type { Photo, Placement, SlotRect, Template } from '../types'

type OverlayPosition = NonNullable<Placement['overlayPosition']>

let photoSeq = 0
function nextPhotoId(): string {
  photoSeq += 1
  return `photo-${Date.now().toString(36)}-${photoSeq}`
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

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

export interface ImportResult {
  photos: Photo[]
  /** Files that hashed the same as a photo already in this book (or another file in the same batch), and so weren't added again. */
  duplicateCount: number
}

/**
 * existingHashes should be every hash already in this book's photo library,
 * so a file re-imported later (or the same batch selected twice by mistake)
 * gets caught and skipped rather than added as a visually identical second copy.
 */
export async function importFiles(
  files: File[],
  projectId: string,
  existingHashes: Set<string>,
): Promise<ImportResult> {
  const images = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
  const seenThisBatch = new Set<string>()
  let duplicateCount = 0

  const results = await Promise.all(
    images.map(async (file) => {
      const hash = await hashBlob(file)
      if (existingHashes.has(hash) || seenThisBatch.has(hash)) {
        duplicateCount += 1
        return null
      }
      seenThisBatch.add(hash)
      const [{ width, height }, thumbBlob] = await Promise.all([
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
      }
      return photo
    }),
  )
  return { photos: results.filter((p): p is Photo => p !== null), duplicateCount }
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
