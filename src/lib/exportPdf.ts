import { DEFAULT_TEXT_STYLE, fontSizeScale, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { decorationHost, pagePlacements, resolvePageSize } from './autoLayout'
import {
  coverGeometry,
  FRAME_INSET_RATIO,
  POSTER_BORDER_RATIO,
  POSTER_ROTATION_DEG,
  slotPixelRect,
} from './imageUtils'
import type { BookSize, Page, Photo, Placement, Sticker, TextBox, TextStyle } from '../types'

export const PAGE_MARGIN_RATIO = 0.09
const DPI = 300
const JPEG_QUALITY = 0.92

const FILTER_CANVAS: Record<string, string> = {
  bw: 'grayscale(1)',
  sepia: 'sepia(0.75) saturate(1.1)',
}

const TAPE_COLORS: Record<string, string> = {
  'tape-yellow': 'rgba(232, 217, 160, 0.85)',
  'tape-pink': 'rgba(227, 184, 176, 0.85)',
  'tape-sage': 'rgba(185, 196, 168, 0.85)',
}

/** Mirrors StickerGlyph.tsx's paths — Path2D draws SVG path data directly. */
const ICON_PATHS: Record<string, { d: string; color: string }> = {
  heart: { d: 'M12 20s-7-4.6-9.3-9C1 7.7 2.3 4 6 4c2 0 3.3 1.2 4 2.4C10.7 5.2 12 4 14 4c3.7 0 5 3.7 3.3 7-2.3 4.4-9.3 9-9.3 9z', color: '#a8763f' },
  star: { d: 'M12 2.8l2.7 6.1 6.6.6-5 4.5 1.5 6.5-5.8-3.5-5.8 3.5 1.5-6.5-5-4.5 6.6-.6z', color: '#3f5570' },
  arrow: { d: 'M3 12h15M13 6l6 6-6 6', color: '#5b564c' },
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
    const fontSize = Math.round(scaleH * 0.026 * fontSizeScale(style.size))
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

  /** A sticker — either a flat piece of tape or a small line-drawn icon. */
  const drawSticker = (rect: { x: number; y: number; w: number; h: number }, sticker: Sticker) => {
    const tapeColor = TAPE_COLORS[sticker.type]
    if (tapeColor) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = rect.h * 0.15
      ctx.fillStyle = tapeColor
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.restore()
      return
    }
    const icon = ICON_PATHS[sticker.type]
    if (!icon) return
    ctx.save()
    const scale = Math.min(rect.w, rect.h) / 24
    ctx.translate(rect.x + (rect.w - 24 * scale) / 2, rect.y + (rect.h - 24 * scale) / 2)
    ctx.scale(scale, scale)
    ctx.strokeStyle = icon.color
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(new Path2D(icon.d))
    ctx.restore()
  }

  /** A free-placed text box: wrapped, horizontally aligned, vertically centered in its box. */
  const drawFreeText = (rect: { x: number; y: number; w: number; h: number }, box: TextBox) => {
    if (!box.text.trim()) return
    const fontSize = Math.max(10, rect.h * 0.28) * fontSizeScale(box.size)
    ctx.fillStyle = '#201f1c'
    ctx.font = `${box.bold ? 'bold' : 'normal'} ${fontSize}px ${fontStack(box.font)}`
    ctx.textAlign = box.align
    ctx.textBaseline = 'top'
    const innerW = rect.w * 0.92
    const lineHeight = fontSize * 1.25
    const lines = wrapText(ctx, box.text.trim(), innerW)
    const blockH = lines.length * lineHeight
    const startY = rect.y + Math.max(0, (rect.h - blockH) / 2)
    const x = box.align === 'left' ? rect.x + rect.w * 0.04 : box.align === 'right' ? rect.x + rect.w * 0.96 : rect.x + rect.w / 2
    lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight, innerW))
  }

  const drawDecorations = (host: { stickers?: Sticker[]; textBoxes?: TextBox[] }, containerW: number, containerH: number, offsetX: number, offsetY: number) => {
    for (const sticker of host.stickers ?? []) {
      drawSticker(
        {
          x: offsetX + (sticker.x / 100) * containerW,
          y: offsetY + (sticker.y / 100) * containerH,
          w: (sticker.w / 100) * containerW,
          h: (sticker.h / 100) * containerH,
        },
        sticker,
      )
    }
    for (const box of host.textBoxes ?? []) {
      drawFreeText(
        {
          x: offsetX + (box.x / 100) * containerW,
          y: offsetY + (box.y / 100) * containerH,
          w: (box.w / 100) * containerW,
          h: (box.h / 100) * containerH,
        },
        box,
      )
    }
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
      drawDecorations(decorationHost(page, halfIndex as 0 | 1), outer.w, outer.h, outer.x, outer.y)
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

  if (!template.halfSplit) {
    drawDecorations(page, pageW, pageH, 0, 0)
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
