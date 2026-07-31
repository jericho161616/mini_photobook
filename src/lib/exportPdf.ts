import { DEFAULT_TEXT_STYLE, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { pagePlacements, resolvePageSize } from './autoLayout'
import {
  coverGeometry,
  FRAME_INSET_RATIO,
  POSTER_BORDER_RATIO,
  POSTER_ROTATION_DEG,
  slotPixelRect,
} from './imageUtils'
import type { BookSize, Page, Photo, Placement, TextStyle } from '../types'

export const PAGE_MARGIN_RATIO = 0.09
const DPI = 300
const JPEG_QUALITY = 0.92

const FILTER_CANVAS: Record<string, string> = {
  bw: 'grayscale(1)',
  sepia: 'sepia(0.75) saturate(1.1)',
}

/** Greedy word wrap so canvas text (which doesn't wrap on its own) matches the on-screen note. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

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

  const drawPhoto = (rect: { x: number; y: number; w: number; h: number }, placement: Placement) => {
    const bitmap = photoMap.get(placement.photoId)
    if (!bitmap) return
    const geo = coverGeometry(bitmap.width / bitmap.height, rect.w, rect.h, placement)
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    ctx.filter = placement.filter ? FILTER_CANVAS[placement.filter] : 'none'
    ctx.drawImage(bitmap, rect.x + geo.x, rect.y + geo.y, geo.drawWidth, geo.drawHeight)
    ctx.filter = 'none'
    ctx.restore()
  }

  /**
   * A single photo slot, aware of the two decorative slot styles: Instant
   * Grid's white card mount (an inset mat around the photo) and Poster
   * Overlay's taped-on-top second photo (rotated, bordered, shadowed).
   */
  const drawSlot = (
    rect: { x: number; y: number; w: number; h: number },
    placement: Placement | null,
    opts: { framed?: boolean; poster?: boolean } = {},
  ) => {
    if (!placement) return
    if (opts.poster) {
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((POSTER_ROTATION_DEG * Math.PI) / 180)
      ctx.translate(-rect.w / 2, -rect.h / 2)
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = rect.w * 0.05
      ctx.shadowOffsetY = rect.h * 0.02
      ctx.fillStyle = '#fdfaf1'
      ctx.fillRect(0, 0, rect.w, rect.h)
      ctx.shadowColor = 'transparent'
      const border = rect.w * POSTER_BORDER_RATIO
      drawPhoto({ x: border, y: border, w: rect.w - border * 2, h: rect.h - border * 2 }, placement)
      ctx.restore()
      return
    }
    if (opts.framed) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      const inset = Math.min(rect.w, rect.h) * FRAME_INSET_RATIO
      drawPhoto({ x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 }, placement)
      return
    }
    drawPhoto(rect, placement)
  }

  /** The page note: left- or center-aligned, wrapping, in its own font and weight. */
  const drawNote = (
    rect: { x: number; y: number; w: number; h: number },
    text: string,
    scaleH: number,
    style: TextStyle,
    centered: boolean,
  ) => {
    const fontSize = Math.round(scaleH * 0.026)
    const weight = style.bold ? 'bold' : 'normal'
    ctx.fillStyle = '#5b564c'
    ctx.font = `${weight} ${fontSize}px ${fontStack(style.font)}`
    ctx.textAlign = centered ? 'center' : 'left'
    ctx.textBaseline = 'top'
    const lineHeight = fontSize * 1.35
    const lines = wrapText(ctx, text.trim(), rect.w)
    const maxLines = Math.max(1, Math.floor(rect.h / lineHeight))
    const x = centered ? rect.x + rect.w / 2 : rect.x
    lines.slice(0, maxLines).forEach((line, i) => {
      ctx.fillText(line, x, rect.y + i * lineHeight, rect.w)
    })
  }

  if (template.halfSplit && page.halves) {
    template.slots.forEach((region, halfIndex) => {
      const half = page.halves![halfIndex as 0 | 1]
      const halfTemplate = getTemplate(half.templateId)
      const outer = slotPixelRect(region, pageW, pageH, 0)
      const halfMargin = halfTemplate.bleed ? 0 : PAGE_MARGIN_RATIO
      halfTemplate.slots.forEach((slot, slotIndex) => {
        const inner = slotPixelRect(slot, outer.w, outer.h, halfMargin)
        drawSlot(
          { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h },
          half.placements[slotIndex],
          { framed: halfTemplate.id === 'instantGrid', poster: halfTemplate.decoration === 'poster' && slotIndex === 1 },
        )
      })
      if (halfTemplate.textSlot && half.text.trim()) {
        const inner = slotPixelRect(halfTemplate.textSlot, outer.w, outer.h, halfMargin)
        drawNote(
          { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h },
          half.text,
          outer.h,
          half.textStyle ?? DEFAULT_TEXT_STYLE,
          halfTemplate.captionStyle === 'centered',
        )
      }
    })
  } else {
    template.slots.forEach((slot, slotIndex) => {
      const rect = slotPixelRect(slot, pageW, pageH, marginRatio)
      drawSlot(rect, page.placements[slotIndex], {
        framed: template.id === 'instantGrid',
        poster: template.decoration === 'poster' && slotIndex === 1,
      })
    })
  }

  // Mirrors the on-screen caption so the printed cover matches the editor.
  if (template.caption && title.trim()) {
    const rect = slotPixelRect(template.caption, pageW, pageH, PAGE_MARGIN_RATIO)
    ctx.fillStyle = '#201f1c'
    ctx.font = `${Math.round(pageH * 0.032)}px Georgia, "Times New Roman", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w)
  }

  if (template.textSlot && page.text.trim()) {
    drawNote(
      slotPixelRect(template.textSlot, pageW, pageH, marginRatio),
      page.text,
      pageH,
      page.textStyle ?? DEFAULT_TEXT_STYLE,
      template.captionStyle === 'centered',
    )
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
    for (const placement of pagePlacements(page)) {
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

    const firstSize = pages.length > 0 ? resolvePageSize(pages[0], size) : size
    const pdf = new jsPDF({
      orientation: firstSize.widthIn >= firstSize.heightIn ? 'landscape' : 'portrait',
      unit: 'in',
      format: [firstSize.widthIn, firstSize.heightIn],
      compress: true,
    })

    for (let i = 0; i < pages.length; i++) {
      // A page can override the book's own size (mixed orientation within
      // the A4 family), so each page's trim is resolved individually rather
      // than assumed to match the book default.
      const pageSize = resolvePageSize(pages[i], size)
      if (i > 0) {
        pdf.addPage(
          [pageSize.widthIn, pageSize.heightIn],
          pageSize.widthIn >= pageSize.heightIn ? 'landscape' : 'portrait',
        )
      }
      const dataUrl = await renderPage(pages[i], pageSize, photoMap, background, title)
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageSize.widthIn, pageSize.heightIn)
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
