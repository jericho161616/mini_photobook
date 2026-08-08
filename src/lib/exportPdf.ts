import { DEFAULT_TEXT_STYLE, fontSizeScale, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { DEFAULT_TAPE_COLOR } from '../components/AttachmentGraphic'
import { decorationHost, pagePlacements, resolvePageSize } from './autoLayout'
import {
  CIRCLE_BORDER_RATIO,
  CLIP_ASPECT,
  CLIP_WIDTH_RATIO,
  coverGeometry,
  FRAME_INSET_RATIO,
  isDarkColor,
  isOverlaySlot,
  PAPERCLIP_ASPECT,
  PAPERCLIP_WIDTH_RATIO,
  POSTER_BORDER_RATIO,
  resolveOverlayPosition,
  resolveSlotStyle,
  slotPixelRect,
  slotRotationDeg,
  STAMP_INSET_RATIO,
  stampScallopPoints,
  TAPE_HEIGHT_RATIO,
  TAPE_ROTATION_DEG,
  TAPE_WIDTH_RATIO,
} from './imageUtils'
import type {
  BookSize,
  CustomSticker,
  Page,
  Photo,
  PhotoFilter,
  Placement,
  Sticker,
  Template,
  TextBox,
  TextStyle,
} from '../types'

export const PAGE_MARGIN_RATIO = 0.09
const DPI = 300
const JPEG_QUALITY = 0.92

const FILTER_CANVAS: Record<string, string> = {
  bw: 'grayscale(1)',
  sepia: 'sepia(0.75) saturate(1.1)',
  negative: 'invert(1) hue-rotate(180deg)',
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
  // A dark page background (e.g. the Night preset) needs light parchment text
  // instead of the usual dark ink, same rule the editor uses.
  const onDark = page.backgroundColor ? isDarkColor(page.backgroundColor) : false
  const captionColor = onDark ? '#f2ead2' : '#241f16'
  const noteColor = onDark ? '#c9bfa4' : '#6b5f4a'

  const drawPhoto = (
    rect: { x: number; y: number; w: number; h: number },
    placement: Placement,
    forceFilter?: PhotoFilter,
  ) => {
    const bitmap = photoMap.get(placement.photoId)
    if (!bitmap) return
    const geo = coverGeometry(bitmap.width / bitmap.height, rect.w, rect.h, placement)
    const filterKey = forceFilter ?? placement.filter
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    ctx.filter = filterKey ? FILTER_CANVAS[filterKey] : 'none'
    ctx.drawImage(bitmap, rect.x + geo.x, rect.y + geo.y, geo.drawWidth, geo.drawHeight)
    ctx.filter = 'none'
    ctx.restore()
  }

  /** Tape, a binder clip, or a paperclip pinning a photo to the page — drawn just above the slot's own top edge. */
  const drawAttachment = (
    rect: { x: number; y: number; w: number; h: number },
    type: 'tape' | 'clip' | 'paperclip',
    color: string | undefined,
  ) => {
    if (type === 'tape') {
      const w = rect.w * TAPE_WIDTH_RATIO
      const h = rect.h * TAPE_HEIGHT_RATIO
      const x = rect.x + rect.w * 0.3
      const y = rect.y - rect.h * 0.06
      const cx = x + w / 2
      const cy = y + h / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((TAPE_ROTATION_DEG * Math.PI) / 180)
      ctx.translate(-cx, -cy)
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = rect.w * 0.01
      ctx.fillStyle = color ?? DEFAULT_TAPE_COLOR
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }
    if (type === 'clip') {
      const w = rect.w * CLIP_WIDTH_RATIO
      const h = w * CLIP_ASPECT
      const x = rect.x + rect.w / 2 - w / 2
      const y = rect.y - rect.h * 0.09
      ctx.save()
      ctx.fillStyle = '#1c1a17'
      ctx.fillRect(x, y + h * 0.18, w, h * 0.4)
      ctx.strokeStyle = '#c9a24a'
      ctx.lineWidth = Math.max(1, w * 0.06)
      ctx.beginPath()
      ctx.arc(x + w * 0.3, y + h * 0.38, w * 0.09, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + w * 0.7, y + h * 0.38, w * 0.09, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      return
    }
    const w = rect.w * PAPERCLIP_WIDTH_RATIO
    const h = w * PAPERCLIP_ASPECT
    const x = rect.x + rect.w * 0.03
    const y = rect.y - rect.h * 0.1
    ctx.save()
    ctx.strokeStyle = '#8a97a3'
    ctx.lineWidth = Math.max(1, w * 0.12)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + w * 0.5, y + h * 0.09)
    ctx.lineTo(x + w * 0.5, y + h * 0.73)
    ctx.arc(x + w * 0.2, y + h * 0.73, w * 0.3, 0, Math.PI, false)
    ctx.lineTo(x + w * 0.2, y + h * 0.18)
    ctx.stroke()
    ctx.restore()
  }

  /** The Stamp frame/caption's scalloped cream card — filled (and left as the active clip) for the caller to draw into. */
  const fillScallopCard = (rect: { x: number; y: number; w: number; h: number }) => {
    const points = stampScallopPoints(rect.w, rect.h).map((p) => ({ x: rect.x + p.x, y: rect.y + p.y }))
    ctx.beginPath()
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.fillStyle = '#f2ead2'
    ctx.fill()
  }

  /**
   * A single photo slot, aware of the decorative slot styles: Instant Grid's
   * white card mount, an overlay decoration's taped-on-top photo (rotated,
   * bordered, shadowed), Circle Inset's centered circular portrait, and the
   * Stamp frame's scalloped cut edge.
   */
  const drawSlot = (
    rect: { x: number; y: number; w: number; h: number },
    placement: Placement | null,
    opts: {
      framed?: boolean
      poster?: boolean
      circle?: boolean
      hairline?: boolean
      stamp?: boolean
      windowSlot?: boolean
      forceFilter?: PhotoFilter
      rotationDeg?: number
    } = {},
  ) => {
    if (!placement) return
    if (opts.rotationDeg) {
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
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = rect.w * 0.05
      ctx.shadowOffsetY = rect.h * 0.02
      ctx.fillStyle = '#fdfaf1'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      ctx.shadowColor = 'transparent'
      const border = rect.w * POSTER_BORDER_RATIO
      drawPhoto(
        { x: rect.x + border, y: rect.y + border, w: rect.w - border * 2, h: rect.h - border * 2 },
        placement,
        opts.forceFilter,
      )
      ctx.restore()
      // A poster slot always carries its own tape, same as SlotView's unconditional render.
      drawAttachment(rect, 'tape', placement.attachmentColor)
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
        opts.forceFilter,
      )
      ctx.restore()
      return
    }
    if (opts.stamp) {
      ctx.save()
      fillScallopCard(rect)
      ctx.clip()
      const inset = Math.min(rect.w, rect.h) * STAMP_INSET_RATIO
      drawPhoto(
        { x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 },
        placement,
        opts.forceFilter,
      )
      ctx.restore()
      if (placement.attachment) drawAttachment(rect, placement.attachment, placement.attachmentColor)
      return
    }
    if (opts.framed) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      const inset = Math.min(rect.w, rect.h) * FRAME_INSET_RATIO
      drawPhoto(
        { x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 },
        placement,
        opts.forceFilter,
      )
      if (placement.attachment) drawAttachment(rect, placement.attachment, placement.attachmentColor)
      return
    }
    drawPhoto(rect, placement, opts.forceFilter)
    if (opts.windowSlot) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1)
      ctx.restore()
    }
    if (opts.hairline) {
      ctx.save()
      ctx.strokeStyle = '#6b5f4a'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5)
      ctx.restore()
    }
    if (placement.attachment) drawAttachment(rect, placement.attachment, placement.attachmentColor)
  }

  /**
   * The page note: left- or center-aligned, wrapping, in its own font and
   * weight — 'ruled' draws faint diary lines behind it, 'quote' anchors it to
   * the bottom with a decorative opening mark, 'divider' sets it large and
   * centered with a rule beneath, 'stamp' draws it inside a scalloped card
   * matching the Stamp frame.
   */
  const drawNote = (
    rect: { x: number; y: number; w: number; h: number },
    text: string,
    scaleH: number,
    style: TextStyle,
    captionStyle: Template['captionStyle'],
  ) => {
    const fontScale = captionStyle === 'divider' ? 0.052 : 0.026
    const fontSize = Math.round(scaleH * fontScale * fontSizeScale(style.size))
    const weight = style.bold ? 'bold' : 'normal'

    if (captionStyle === 'ruled') {
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

    let innerRect = rect
    if (captionStyle === 'stamp') {
      ctx.save()
      fillScallopCard(rect)
      ctx.restore()
      innerRect = { x: rect.x + rect.w * 0.08, y: rect.y, w: rect.w * 0.84, h: rect.h }
    }

    const centered = captionStyle === 'centered' || captionStyle === 'divider' || captionStyle === 'stamp'
    ctx.fillStyle = captionStyle === 'stamp' ? '#241f16' : noteColor
    // The page note is always italic on screen (.page-note in styles.css) — matched here so export doesn't go upright.
    ctx.font = `italic ${weight} ${fontSize}px ${fontStack(style.font)}`
    ctx.textAlign = centered ? 'center' : 'left'
    ctx.textBaseline = 'top'
    const lineHeight = fontSize * 1.35
    const lines = wrapText(ctx, text.trim(), innerRect.w)
    const maxLines = Math.max(1, Math.floor(innerRect.h / lineHeight))
    const shown = lines.slice(0, maxLines)
    const blockH = shown.length * lineHeight
    const x = centered ? innerRect.x + innerRect.w / 2 : innerRect.x
    let startY = innerRect.y
    if (captionStyle === 'quote') startY = innerRect.y + innerRect.h - blockH
    else if (captionStyle === 'divider' || captionStyle === 'stamp') {
      startY = innerRect.y + Math.max(0, (innerRect.h - blockH) / 2)
    }

    if (captionStyle === 'quote') {
      ctx.save()
      ctx.fillStyle = '#a9822f'
      ctx.font = `${Math.round(fontSize * 1.6)}px Georgia, "Times New Roman", serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText('“', innerRect.x, startY + fontSize * 0.9)
      ctx.restore()
    }

    shown.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineHeight, innerRect.w)
    })

    if (captionStyle === 'divider') {
      ctx.save()
      ctx.strokeStyle = '#c4b78e'
      ctx.lineWidth = 1
      const ruleW = fontSize * 1.6
      const ruleY = startY + blockH + fontSize * 0.5
      ctx.beginPath()
      ctx.moveTo(x - ruleW / 2, ruleY)
      ctx.lineTo(x + ruleW / 2, ruleY)
      ctx.stroke()
      ctx.restore()
    }
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
    ctx.font = `${box.italic ? 'italic ' : ''}${box.bold ? 'bold' : 'normal'} ${fontSize}px ${fontStack(box.font)}`
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
        const placement = half.placements[slotIndex]
        const positioned = isOverlaySlot(halfTemplate, slotIndex)
          ? resolveOverlayPosition(slot, placement?.overlayPosition)
          : slot
        const inner = slotPixelRect(positioned, outer.w, outer.h, halfMargin)
        drawSlot(
          { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h },
          placement,
          {
            ...resolveSlotStyle(halfTemplate, slotIndex, placement),
            rotationDeg: slotRotationDeg(halfTemplate, slotIndex, placement),
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
          halfTemplate.captionStyle,
        )
      }
      if (halfTemplate.decoration === 'beforeAfter') {
        drawBeforeAfter(outer)
      }
      drawDecorations(decorationHost(page, halfIndex as 0 | 1), outer.w, outer.h, outer.x, outer.y)
    })
  } else {
    template.slots.forEach((slot, slotIndex) => {
      const placement = page.placements[slotIndex]
      const positioned = isOverlaySlot(template, slotIndex)
        ? resolveOverlayPosition(slot, placement?.overlayPosition)
        : slot
      const rect = slotPixelRect(positioned, pageW, pageH, marginRatio)
      drawSlot(rect, placement, {
        ...resolveSlotStyle(template, slotIndex, placement),
        rotationDeg: slotRotationDeg(template, slotIndex, placement),
      })
    })
    if (template.decoration === 'beforeAfter') {
      drawBeforeAfter({ x: 0, y: 0, w: pageW, h: pageH })
    }
  }

  // Mirrors the on-screen caption so the printed cover matches the editor.
  if (template.caption && title.trim()) {
    const rect = slotPixelRect(template.caption, pageW, pageH, PAGE_MARGIN_RATIO)
    ctx.fillStyle = captionColor
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
      template.captionStyle,
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
