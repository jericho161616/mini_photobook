import { artboardSize, spanOf, totalSlides } from './autoLayout'
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

/**
 * Cuts a spanning artboard into the individual slides it's made of. The strip
 * is drawn once at full width and then copied out in slide-sized pieces, so a
 * photo lying across a cut simply ends up in both halves — there is no
 * splitting logic anywhere, only a crop.
 */
function sliceArtboard(artboard: HTMLCanvasElement, slides: number): HTMLCanvasElement[] {
  if (slides <= 1) return [artboard]
  const width = Math.round(artboard.width / slides)
  return Array.from({ length: slides }, (_, i) => {
    const slide = document.createElement('canvas')
    slide.width = width
    slide.height = artboard.height
    const ctx = slide.getContext('2d')
    if (!ctx) throw new Error('Could not create a drawing context to cut the slides apart')
    // The last slice takes whatever rounding left over, so N slides always add
    // back up to the full artboard with no seam of blank pixels at the end.
    const from = i * width
    const take = i === slides - 1 ? artboard.width - from : width
    ctx.drawImage(artboard, from, 0, take, artboard.height, 0, 0, take, artboard.height)
    return slide
  })
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
    // One page is not one slide once artboards can span, so the count that
    // drives numbering and progress is the number of files, not of pages.
    const slides = totalSlides(pages)
    // Two digits for a ten-slide carousel, so the files sort in posting order
    // in every file manager rather than going 1, 10, 11, 2.
    const width = String(startNumber + slides - 1).length
    const files: { name: string; blob: Blob }[] = []

    for (const page of pages) {
      // A page can override the project's size, and a spanning page is drawn
      // at its full strip width, so both are resolved per page rather than
      // assumed to match the project default.
      const board = artboardSize(page, size)
      const canvas = await renderPageCanvas(
        page,
        board,
        photoMap,
        customStickerMap,
        background,
        title,
        DPI,
        board.social,
      )

      for (const slide of sliceArtboard(canvas, spanOf(page))) {
        const number = startNumber + files.length
        files.push({
          name: `${slug}-${String(number).padStart(width, '0')}.png`,
          blob: await canvasToPng(slide),
        })
        onProgress?.(files.length, slides)
        // Yield so the progress indicator can actually paint between slides.
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
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
