import { DEFAULT_TEXT_STYLE, fontSizeScale, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { decorationHost, pagePlacements, resolvePageSize } from './autoLayout'
import {
  CIRCLE_BORDER_RATIO,
  coverGeometry,
  FRAME_INSET_RATIO,
  POSTER_BORDER_RATIO,
  POSTER_ROTATION_DEG,
  slotPixelRect,
} from './imageUtils'
import type { BookSize, CustomSticker, Page, Photo, Placement, Sticker, TextBox, TextStyle } from '../types'

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

/**
 * Mirrors StickerGlyph.tsx's paths — Path2D draws SVG path data directly.
 * Colors match the app's light-theme --brass / --navy-soft / --ink-soft —
 * export always prints in light-theme colors regardless of the editor's
 * current theme, same as a physical page doesn't have a dark mode.
 */
const ICON_PATHS: Record<string, { d: string; color: string }> = {
  heart: { d: 'M12 20s-7-4.6-9.3-9C1 7.7 2.3 4 6 4c2 0 3.3 1.2 4 2.4C10.7 5.2 12 4 14 4c3.7 0 5 3.7 3.3 7-2.3 4.4-9.3 9-9.3 9z', color: '#a9822f' },
  star: { d: 'M12 2.8l2.7 6.1 6.6.6-5 4.5 1.5 6.5-5.8-3.5-5.8 3.5 1.5-6.5-5-4.5 6.6-.6z', color: '#4a3f2c' },
  arrow: { d: 'M3 12h15M13 6l6 6-6 6', color: '#6b5f4a' },
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
  customStickerMap: Map<string, ImageBitmap>,
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

  ctx.fillStyle = page.backgroundColor ?? background
  ctx.fillRect(0, 0, pageW, pageH)
  ctx.imageSmoothingQuality = 'high'

  const template = getTemplate(page.templateId)
  const marginRatio = template.bleed ? 0 : PAGE_MARGIN_RATIO * (page.marginScale ?? 1)

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
   * A single photo slot, aware of the decorative slot styles: Instant Grid's
   * white card mount, Poster Overlay's taped-on-top second photo (rotated,
   * bordered, shadowed), and Circle Inset's centered circular portrait.
   */
  const drawSlot = (
    rect: { x: number; y: number; w: number; h: number },
    placement: Placement | null,
    opts: { framed?: boolean; poster?: boolean; circle?: boolean; hairline?: boolean; rotationDeg?: number } = {},
  ) => {
    if (!placement) return
    // Manual/template tilt — skipped for Poster Overlay, which applies its
    // own fixed rotation below, same guard SlotView uses on screen.
    if (!opts.poster && opts.rotationDeg) {
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((opts.rotationDeg * Math.PI) / 180)
      ctx.translate(-cx, -cy)
      drawSlot(rect, placement, { ...opts, rotationDeg: undefined })
      ctx.restore()
      return
    }
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
    if (opts.circle) {
      // Always a true circle, regardless of the book's own aspect ratio —
      // same Math.min(w, h) rule SlotView uses on screen.
      const size = Math.min(rect.w, rect.h)
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = size * 0.06
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.clip()
      const border = size * CIRCLE_BORDER_RATIO
      drawPhoto(
        { x: cx - size / 2 + border, y: cy - size / 2 + border, w: size - border * 2, h: size - border * 2 },
        placement,
      )
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
    if (opts.hairline) {
      ctx.save()
      ctx.strokeStyle = '#6b5f4a'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5)
      ctx.restore()
    }
  }

  /** The page note: left- or center-aligned, wrapping, in its own font and weight. */
  const drawNote = (
    rect: { x: number; y: number; w: number; h: number },
    text: string,
    scaleH: number,
    style: TextStyle,
    centered: boolean,
    ruled = false,
  ) => {
    const fontSize = Math.round(scaleH * 0.026 * fontSizeScale(style.size))
    const weight = style.bold ? 'bold' : 'normal'
    if (ruled) {
      // Decorative ruled-paper lines — not aligned to the text's own line-height, same as the on-screen CSS version.
      const ruleSpacing = fontSize * 1.35
      ctx.save()
      ctx.strokeStyle = '#c4b78e'
      ctx.lineWidth = 1
      for (let y = rect.y + ruleSpacing; y < rect.y + rect.h; y += ruleSpacing) {
        ctx.beginPath()
        ctx.moveTo(rect.x, y)
        ctx.lineTo(rect.x + rect.w, y)
        ctx.stroke()
      }
      ctx.restore()
    }
    ctx.fillStyle = '#6b5f4a'
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

  /** A sticker — a flat piece of tape, a small line-drawn icon, or the user's own drawing. */
  const drawSticker = (rect: { x: number; y: number; w: number; h: number }, sticker: Sticker) => {
    if (sticker.type === 'custom') {
      const bitmap = sticker.customId ? customStickerMap.get(sticker.customId) : undefined
      if (!bitmap) return
      // object-fit: contain — scale to fit inside rect without distorting, centered.
      const scale = Math.min(rect.w / bitmap.width, rect.h / bitmap.height)
      const drawW = bitmap.width * scale
      const drawH = bitmap.height * scale
      ctx.drawImage(bitmap, rect.x + (rect.w - drawW) / 2, rect.y + (rect.h - drawH) / 2, drawW, drawH)
      return
    }
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
    ctx.fillStyle = '#241f16'
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

  /** The Before & After template's static divider line and labels, drawn independent of any placed text. */
  const drawBeforeAfter = (rect: { x: number; y: number; w: number; h: number }) => {
    const midX = rect.x + rect.w / 2
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'
    ctx.lineWidth = Math.max(1, rect.w * 0.001)
    ctx.beginPath()
    ctx.moveTo(midX, rect.y)
    ctx.lineTo(midX, rect.y + rect.h)
    ctx.stroke()

    const drawLabel = (text: string, x: number) => {
      const fontSize = Math.round(rect.h * 0.024)
      ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`
      const paddingX = fontSize * 0.6
      const paddingY = fontSize * 0.4
      const textW = ctx.measureText(text.toUpperCase()).width
      const boxW = textW + paddingX * 2
      const boxH = fontSize + paddingY * 2
      const y = rect.y + rect.h * 0.05
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(x, y, boxW, boxH)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(text.toUpperCase(), x + paddingX, y + boxH / 2)
    }
    drawLabel('Before', rect.x + rect.w * 0.06)
    drawLabel('After', rect.x + rect.w * 0.56)
    ctx.restore()
  }

  if (template.halfSplit && page.halves) {
    template.slots.forEach((region, halfIndex) => {
      const half = page.halves![halfIndex as 0 | 1]
      const halfTemplate = getTemplate(half.templateId)
      const outer = slotPixelRect(region, pageW, pageH, 0)
      const halfMargin = halfTemplate.bleed ? 0 : PAGE_MARGIN_RATIO * (page.marginScale ?? 1)
      halfTemplate.slots.forEach((slot, slotIndex) => {
        const inner = slotPixelRect(slot, outer.w, outer.h, halfMargin)
        const placement = half.placements[slotIndex]
        drawSlot(
          { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h },
          placement,
          {
            framed: halfTemplate.id === 'instantGrid' || placement?.frame === 'polaroid',
            poster: halfTemplate.decoration === 'poster' && slotIndex === 1,
            circle: halfTemplate.decoration === 'circle' && slotIndex === 1,
            hairline: placement?.frame === 'hairline',
            rotationDeg: (halfTemplate.slotRotations?.[slotIndex] ?? 0) + (placement?.rotation ?? 0),
          },
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
          halfTemplate.captionStyle === 'ruled',
        )
      }
      if (halfTemplate.decoration === 'beforeAfter') {
        drawBeforeAfter(outer)
      }
      drawDecorations(decorationHost(page, halfIndex as 0 | 1), outer.w, outer.h, outer.x, outer.y)
    })
  } else {
    template.slots.forEach((slot, slotIndex) => {
      const rect = slotPixelRect(slot, pageW, pageH, marginRatio)
      const placement = page.placements[slotIndex]
      drawSlot(rect, placement, {
        framed: template.id === 'instantGrid' || placement?.frame === 'polaroid',
        poster: template.decoration === 'poster' && slotIndex === 1,
        circle: template.decoration === 'circle' && slotIndex === 1,
        hairline: placement?.frame === 'hairline',
        rotationDeg: (template.slotRotations?.[slotIndex] ?? 0) + (placement?.rotation ?? 0),
      })
    })
    if (template.decoration === 'beforeAfter') {
      drawBeforeAfter({ x: 0, y: 0, w: pageW, h: pageH })
    }
  }

  // Mirrors the on-screen caption so the printed cover matches the editor.
  if (template.caption && title.trim()) {
    const rect = slotPixelRect(template.caption, pageW, pageH, PAGE_MARGIN_RATIO)
    ctx.fillStyle = '#241f16'
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
      template.captionStyle === 'ruled',
    )
  }

  if (!template.halfSplit) {
    drawDecorations(page, pageW, pageH, 0, 0)
  }

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/** Every sticker on a page, whichever half (if any) it belongs to. */
function allStickers(page: Page): Sticker[] {
  if (page.halves) return page.halves.flatMap((half) => half.stickers ?? [])
  return page.stickers ?? []
}

export interface ExportOptions {
  pages: Page[]
  photos: Photo[]
  customStickers: CustomSticker[]
  size: BookSize
  title: string
  background?: string
  onProgress?: (done: number, total: number) => void
}

export async function exportToPdf({
  pages,
  photos,
  customStickers,
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

  const neededStickers = new Set<string>()
  for (const page of pages) {
    for (const sticker of allStickers(page)) {
      if (sticker.type === 'custom' && sticker.customId) neededStickers.add(sticker.customId)
    }
  }

  const customStickerMap = new Map<string, ImageBitmap>()
  await Promise.all(
    customStickers
      .filter((c) => neededStickers.has(c.id))
      .map(async (custom) => {
        const blob = await (await fetch(custom.dataUrl)).blob()
        customStickerMap.set(custom.id, await createImageBitmap(blob))
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
      const dataUrl = await renderPage(pages[i], pageSize, photoMap, customStickerMap, background, title)
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageSize.widthIn, pageSize.heightIn)
      onProgress?.(i + 1, pages.length)
      // Yield so the progress indicator can actually paint between pages.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    const safeTitle = title.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'photobook'
    pdf.save(`${safeTitle}.pdf`)
  } finally {
    for (const bitmap of photoMap.values()) bitmap.close()
    for (const bitmap of customStickerMap.values()) bitmap.close()
  }
}
