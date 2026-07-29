import { getTemplate } from '../data/templates'
import { coverGeometry, slotPixelRect } from './imageUtils'
import type { BookSize, Page, Photo } from '../types'

export const PAGE_MARGIN_RATIO = 0.09
const DPI = 300
const JPEG_QUALITY = 0.92

/**
 * Pages are drawn straight onto a canvas at print resolution rather than
 * screenshotting the editor, so the output is genuinely 300 DPI instead of an
 * upscaled screen capture.
 */
async function renderPage(
  page: Page,
  size: BookSize,
  photoMap: Map<string, ImageBitmap>,
  background: string,
  title: string,
): Promise<string> {
  const pageW = Math.round(size.widthIn * DPI)
  const pageH = Math.round(size.heightIn * DPI)

  const canvas = document.createElement('canvas')
  canvas.width = pageW
  canvas.height = pageH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a drawing context for export')

  ctx.fillStyle = background
  ctx.fillRect(0, 0, pageW, pageH)
  ctx.imageSmoothingQuality = 'high'

  const template = getTemplate(page.templateId)
  const marginRatio = template.bleed ? 0 : PAGE_MARGIN_RATIO

  template.slots.forEach((slot, slotIndex) => {
    const placement = page.placements[slotIndex]
    if (!placement) return
    const bitmap = photoMap.get(placement.photoId)
    if (!bitmap) return

    const rect = slotPixelRect(slot, pageW, pageH, marginRatio)
    const geo = coverGeometry(bitmap.width / bitmap.height, rect.w, rect.h, placement)

    // Clip to the slot so the overflow from cover-fit and zoom is trimmed
    // exactly as it appears on screen.
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    ctx.drawImage(bitmap, rect.x + geo.x, rect.y + geo.y, geo.drawWidth, geo.drawHeight)
    ctx.restore()
  })

  // Mirrors the on-screen caption so the printed cover matches the editor.
  if (template.caption && title.trim()) {
    const rect = slotPixelRect(template.caption, pageW, pageH, PAGE_MARGIN_RATIO)
    ctx.fillStyle = '#201f1c'
    ctx.font = `${Math.round(pageH * 0.032)}px Georgia, "Times New Roman", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w)
  }

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export interface ExportOptions {
  pages: Page[]
  photos: Photo[]
  size: BookSize
  title: string
  background?: string
  onProgress?: (done: number, total: number) => void
}

export async function exportToPdf({
  pages,
  photos,
  size,
  title,
  background = '#ffffff',
  onProgress,
}: ExportOptions): Promise<void> {
  // Decode each photo once, not once per page it appears on.
  const needed = new Set<string>()
  for (const page of pages) {
    for (const placement of page.placements) {
      if (placement) needed.add(placement.photoId)
    }
  }

  const photoMap = new Map<string, ImageBitmap>()
  await Promise.all(
    photos
      .filter((p) => needed.has(p.id))
      .map(async (photo) => {
        photoMap.set(photo.id, await createImageBitmap(photo.blob))
      }),
  )

  try {
    // Pulled in on demand — the PDF engine is far larger than the editor itself.
    const { jsPDF } = await import('jspdf')

    const pdf = new jsPDF({
      orientation: size.widthIn >= size.heightIn ? 'landscape' : 'portrait',
      unit: 'in',
      format: [size.widthIn, size.heightIn],
      compress: true,
    })

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage([size.widthIn, size.heightIn])
      const dataUrl = await renderPage(pages[i], size, photoMap, background, title)
      pdf.addImage(dataUrl, 'JPEG', 0, 0, size.widthIn, size.heightIn)
      onProgress?.(i + 1, pages.length)
      // Yield so the progress indicator can actually paint between pages.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    const safeTitle = title.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'photobook'
    pdf.save(`${safeTitle}.pdf`)
  } finally {
    for (const bitmap of photoMap.values()) bitmap.close()
  }
}
