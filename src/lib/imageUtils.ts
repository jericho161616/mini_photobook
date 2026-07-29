import type { Photo, Placement, SlotRect } from '../types'

let photoSeq = 0
function nextPhotoId(): string {
  photoSeq += 1
  return `photo-${Date.now().toString(36)}-${photoSeq}`
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

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

export async function importFiles(files: File[], projectId: string): Promise<Photo[]> {
  const images = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
  const photos = await Promise.all(
    images.map(async (file) => {
      const [{ width, height }, thumbBlob] = await Promise.all([
        measure(file),
        makeThumbnail(file),
      ])
      return {
        id: nextPhotoId(),
        projectId,
        name: file.name,
        blob: file,
        thumbBlob,
        width,
        height,
        addedAt: Date.now() + Math.random(),
      } satisfies Photo
    }),
  )
  return photos
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
