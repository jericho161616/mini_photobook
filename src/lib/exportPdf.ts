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
  film: 'sepia(0.22) saturate(1.4) contrast(1.08) brightness(1.05) hue-rotate(-8deg)',
  // 'paper' isn't here on purpose — see drawPaperCrease below.
}

/**
 * A reusable mottled-shadow texture, composited over a photo with
 * 'multiply' to read as light printed on a creased sheet rather than a flat
 * color adjustment — the print equivalent of imageUtils.ts's PAPER_CREASE_SVG
 * filter. Built once (a canvas `filter: url(#svgFilterId)` isn't reliably
 * supported across browsers, so this uses plain composite ops instead) and
 * reused for every 'paper'-filtered photo in the export.
 */
let paperTextureCanvas: HTMLCanvasElement | null = null
function getPaperTexture(): HTMLCanvasElement {
  if (paperTextureCanvas) return paperTextureCanvas
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const tctx = canvas.getContext('2d')!
  tctx.fillStyle = '#808080'
  tctx.fillRect(0, 0, size, size)
  // A small LCG instead of Math.random so the texture is identical on every
  // export rather than reshuffling the crease pattern each time.
  let seed = 42
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  tctx.filter = 'blur(22px)'
  for (let i = 0; i < 28; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 40 + rand() * 90
    tctx.fillStyle = rand() > 0.5 ? 'rgba(60,52,40,0.22)' : 'rgba(255,250,235,0.18)'
    tctx.beginPath()
    tctx.arc(x, y, r, 0, Math.PI * 2)
    tctx.fill()
  }
  tctx.filter = 'none'
  paperTextureCanvas = canvas
  return canvas
}

/** Multiplies the paper-crease texture over `rect` — call with the same clip already active as the photo it's shading. */
function drawPaperCrease(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }) {
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(getPaperTexture(), rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

/** A small tileable speckle pattern for the Film filter's grain — same idea as getPaperTexture, tiled instead of stretched. */
let grainPattern: CanvasPattern | null = null
function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (grainPattern) return grainPattern
  const size = 140
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const tctx = canvas.getContext('2d')!
  const img = tctx.createImageData(size, size)
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round(rand() * 255)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  tctx.putImageData(img, 0, 0)
  grainPattern = ctx.createPattern(canvas, 'repeat')!
  return grainPattern
}

/** Overlays fine grain speckle over `rect` — call with the same clip already active as the photo it's shading. */
function drawFilmGrain(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }) {
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = getGrainPattern(ctx)
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
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

/** Mirrors PageView's backgroundPhotoInset — which portion of the page a background photo fills. */
function backgroundPhotoRect(
  coverage: Page['backgroundPhotoCoverage'],
  pageW: number,
  pageH: number,
): { x: number; y: number; w: number; h: number } {
  switch (coverage) {
    case 'left':
      return { x: 0, y: 0, w: pageW / 2, h: pageH }
    case 'right':
      return { x: pageW / 2, y: 0, w: pageW / 2, h: pageH }
    case 'top':
      return { x: 0, y: 0, w: pageW, h: pageH / 2 }
    case 'bottom':
      return { x: 0, y: pageH / 2, w: pageW, h: pageH / 2 }
    default:
      return { x: 0, y: 0, w: pageW, h: pageH }
  }
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
 * upscaled screen capture. Exported so the book-overview grid can reuse the
 * exact same drawing code at a much lower resolution, since a thumbnail
 * needs to look like the page, not print from it.
 */
export async function renderPage(
  page: Page,
  size: BookSize,
  photoMap: Map<string, ImageBitmap>,
  customStickerMap: Map<string, ImageBitmap>,
  background: string,
  title: string,
  dpi: number = DPI,
): Promise<string> {
  const pageW = Math.round(size.widthIn * dpi)
  const pageH = Math.round(size.heightIn * dpi)

  const canvas = document.createElement('canvas')
  canvas.width = pageW
  canvas.height = pageH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a drawing context for export')

  ctx.fillStyle = page.backgroundColor ?? background
  ctx.fillRect(0, 0, pageW, pageH)
  ctx.imageSmoothingQuality = 'high'

  const backgroundBitmap = page.backgroundPhotoId ? photoMap.get(page.backgroundPhotoId) : undefined
  if (backgroundBitmap) {
    const bgRect = backgroundPhotoRect(page.backgroundPhotoCoverage, pageW, pageH)
    const geo = coverGeometry(backgroundBitmap.width / backgroundBitmap.height, bgRect.w, bgRect.h, {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
    })
    ctx.save()
    ctx.beginPath()
    ctx.rect(bgRect.x, bgRect.y, bgRect.w, bgRect.h)
    ctx.clip()
    ctx.filter = page.backgroundPhotoFilter ? (FILTER_CANVAS[page.backgroundPhotoFilter] ?? 'none') : 'none'
    ctx.drawImage(backgroundBitmap, bgRect.x + geo.x, bgRect.y + geo.y, geo.drawWidth, geo.drawHeight)
    ctx.filter = 'none'
    if (page.backgroundPhotoFilter === 'paper') drawPaperCrease(ctx, bgRect)
    if (page.backgroundPhotoFilter === 'film') drawFilmGrain(ctx, bgRect)
    ctx.fillStyle = `rgba(10, 8, 5, ${(page.backgroundDim ?? 35) / 100})`
    ctx.fillRect(bgRect.x, bgRect.y, bgRect.w, bgRect.h)
    ctx.restore()
  }

  const template = getTemplate(page.templateId)
  const marginRatio = template.bleed ? 0 : PAGE_MARGIN_RATIO * (page.marginScale ?? 1)
  // A dark page background (the Night preset, or any background photo, which
  // reads busy enough to warrant the same light parchment text as a dark
  // tint) needs light text instead of the usual dark ink, same rule the
  // editor uses.
  const onDark = Boolean(backgroundBitmap) || (page.backgroundColor ? isDarkColor(page.backgroundColor) : false)
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
    ctx.filter = filterKey ? (FILTER_CANVAS[filterKey] ?? 'none') : 'none'
    ctx.drawImage(bitmap, rect.x + geo.x, rect.y + geo.y, geo.drawWidth, geo.drawHeight)
    ctx.filter = 'none'
    if (filterKey === 'paper') drawPaperCrease(ctx, rect)
    if (filterKey === 'film') drawFilmGrain(ctx, rect)
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
      posterAttachment?: 'tape' | 'paperclip' | 'none'
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
      // Same pin SlotView draws — 'tape' unless the template says otherwise.
      const attachment = opts.posterAttachment ?? 'tape'
      if (attachment !== 'none') drawAttachment(rect, attachment, placement.attachmentColor)
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

/**
 * Decodes only the photos and custom stickers a set of pages actually uses,
 * once each — shared by the PDF export and the book-overview grid so neither
 * duplicates the other's decoding work.
 */
async function buildBitmapMaps(
  pages: Page[],
  photos: Photo[],
  customStickers: CustomSticker[],
): Promise<{ photoMap: Map<string, ImageBitmap>; customStickerMap: Map<string, ImageBitmap> }> {
  const needed = new Set<string>()
  for (const page of pages) {
    for (const placement of pagePlacements(page)) {
      if (placement) needed.add(placement.photoId)
    }
    if (page.backgroundPhotoId) needed.add(page.backgroundPhotoId)
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

  return { photoMap, customStickerMap }
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
  const { photoMap, customStickerMap } = await buildBitmapMaps(pages, photos, customStickers)

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

// Thumbnail-resolution — plenty to see how a page reads at a glance, and far
// lighter than decoding every page at print quality just for a preview grid.
const OVERVIEW_DPI = 60
const OVERVIEW_COLUMNS = 4
const OVERVIEW_GAP = 14
const OVERVIEW_LABEL_H = 20

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export interface OverviewOptions {
  pages: Page[]
  photos: Photo[]
  customStickers: CustomSticker[]
  size: BookSize
  title: string
  background?: string
}

/**
 * Every page of the book, in order, as one downloadable image — so the whole
 * photobook's flow can be checked at a glance instead of paging through it
 * one screen at a time. Reuses renderPage (the exact same drawing code as the
 * real PDF) at a much lower resolution, since this is a look-it-over aid, not
 * a print asset.
 */
export async function exportBookOverview({
  pages,
  photos,
  customStickers,
  size,
  title,
  background = '#ffffff',
}: OverviewOptions): Promise<void> {
  const { photoMap, customStickerMap } = await buildBitmapMaps(pages, photos, customStickers)

  try {
    const thumbs: { img: HTMLImageElement; w: number; h: number }[] = []
    for (const page of pages) {
      const pageSize = resolvePageSize(page, size)
      const dataUrl = await renderPage(page, pageSize, photoMap, customStickerMap, background, title, OVERVIEW_DPI)
      const img = await loadImage(dataUrl)
      thumbs.push({ img, w: Math.round(pageSize.widthIn * OVERVIEW_DPI), h: Math.round(pageSize.heightIn * OVERVIEW_DPI) })
    }
    if (thumbs.length === 0) return

    const cols = Math.min(OVERVIEW_COLUMNS, thumbs.length)
    const rows = Math.ceil(thumbs.length / cols)
    // A uniform grid cell sized to the largest thumbnail — pages can vary in
    // trim (mixed A4 orientations), so smaller ones center inside their cell.
    const cellW = Math.max(...thumbs.map((t) => t.w))
    const cellH = Math.max(...thumbs.map((t) => t.h)) + OVERVIEW_LABEL_H

    const canvas = document.createElement('canvas')
    canvas.width = cols * cellW + (cols + 1) * OVERVIEW_GAP
    canvas.height = rows * cellH + (rows + 1) * OVERVIEW_GAP
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create a drawing context for the overview')

    ctx.fillStyle = '#d7d3c8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'

    thumbs.forEach((thumb, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cellX = OVERVIEW_GAP + col * (cellW + OVERVIEW_GAP)
      const cellY = OVERVIEW_GAP + row * (cellH + OVERVIEW_GAP)
      const x = cellX + (cellW - thumb.w) / 2
      const y = cellY + (cellH - OVERVIEW_LABEL_H - thumb.h) / 2

      ctx.save()
      ctx.shadowColor = 'rgba(20, 18, 14, 0.3)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2
      ctx.drawImage(thumb.img, x, y, thumb.w, thumb.h)
      ctx.restore()

      ctx.fillStyle = '#4a463c'
      ctx.fillText(`Page ${i + 1}`, cellX + cellW / 2, cellY + cellH - 4)
    })

    const safeTitle = title.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'photobook'
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${safeTitle}-overview.png`
    a.click()
  } finally {
    for (const bitmap of photoMap.values()) bitmap.close()
    for (const bitmap of customStickerMap.values()) bitmap.close()
  }
}
