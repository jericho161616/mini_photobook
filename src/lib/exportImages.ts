import { resolvePageSize } from './autoLayout'
import { DPI, buildBitmapMaps, renderPageCanvas } from './exportPdf'
import { zipStore, type ZipEntry } from './zip'
import type { BookSize, CustomSticker, Page, Photo } from '../types'

/**
 * The social-post counterpart to exportToPdf: every slide rendered as its own
 * PNG at the platform's exact pixel size, ready to upload.
 *
 * PNG rather than JPEG because a post is often mostly flat colour and type —
 * a tinted ground, a headline, a hard edge between two photos — and that is
 * exactly what JPEG smears. The file is bigger; Instagram re-encodes it on
 * upload anyway, so what matters is that it arrives clean.
 *
 * Nothing here touches the network. The canvas is drawn locally, encoded
 * locally, and zipped locally, so a carousel export holds the same promise
 * the rest of the app does.
 */

export interface ExportImagesOptions {
  pages: Page[]
  photos: Photo[]
  customStickers: CustomSticker[]
  size: BookSize
  title: string
  background?: string
  /**
   * What to call the first slide in the file names. Exporting slides 3–5 of a
   * carousel should still produce -03, -04, -05, so the numbering matches the
   * filmstrip rather than restarting at 1.
   */
  startNumber?: number
  onProgress?: (done: number, total: number) => void
}

/** A file name that survives every operating system, derived from the post's title. */
export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'post'
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode this slide as a PNG'))),
      'image/png',
    )
  })
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Given straight back — the browser has already taken its own reference by
  // the time click() returns, and holding the blob open leaks the whole
  // carousel until the tab is closed.
  URL.revokeObjectURL(url)
}

export async function exportSlidesAsPng({
  pages,
  photos,
  customStickers,
  size,
  title,
  background = '#ffffff',
  startNumber = 1,
  onProgress,
}: ExportImagesOptions): Promise<void> {
  // Decode each photo once, not once per slide it appears on.
  const { photoMap, customStickerMap } = await buildBitmapMaps(pages, photos, customStickers)

  try {
    const slug = slugify(title)
    // Two digits for a ten-slide carousel, so the files sort in posting order
    // in every file manager rather than going 1, 10, 11, 2.
    const width = String(startNumber + pages.length - 1).length
    const files: { name: string; blob: Blob }[] = []

    for (let i = 0; i < pages.length; i++) {
      // A page can override the project's size, so each slide's canvas is
      // resolved individually rather than assumed to match the default.
      const pageSize = resolvePageSize(pages[i], size)
      const canvas = await renderPageCanvas(
        pages[i],
        pageSize,
        photoMap,
        customStickerMap,
        background,
        title,
        DPI,
        pageSize.social,
      )
      files.push({
        name: `${slug}-${String(startNumber + i).padStart(width, '0')}.png`,
        blob: await canvasToPng(canvas),
      })
      onProgress?.(i + 1, pages.length)
      // Yield so the progress indicator can actually paint between slides.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    if (files.length === 0) return

    // One slide is just a picture — no reason to make someone unzip it.
    if (files.length === 1) {
      download(files[0].blob, files[0].name)
      return
    }

    const entries: ZipEntry[] = await Promise.all(
      files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.blob.arrayBuffer()) })),
    )
    download(zipStore(entries), `${slug}.zip`)
  } finally {
    for (const bitmap of photoMap.values()) bitmap.close()
    for (const bitmap of customStickerMap.values()) bitmap.close()
  }
}
