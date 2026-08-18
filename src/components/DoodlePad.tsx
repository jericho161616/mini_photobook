import { useEffect, useRef, useState } from 'react'
import { ColorField } from './ColorField'
import { useStore } from '../state/useStore'
import { Icon } from './Icon'

const COLORS = [
  { id: 'ink', hex: '#201f1c' },
  { id: 'navy', hex: '#2e3f52' },
  { id: 'brass', hex: '#a8763f' },
  { id: 'red', hex: '#a8483f' },
  { id: 'sage', hex: '#6b7f5e' },
  { id: 'sky', hex: '#5b7c99' },
  { id: 'plum', hex: '#a8628f' },
  { id: 'white', hex: '#ffffff' },
]

/**
 * The canvas's own pixel resolution. Well above the size it's displayed at so
 * a drawing stays crisp once it's placed large on a page — the pad used to be
 * a 320px canvas squeezed into a ~230px sidebar, which capped how much detail
 * a sticker could hold before it was even drawn.
 */
const PAD_SIZE = 900

const MIN_WIDTH = 4
const MAX_WIDTH = 60
const DEFAULT_WIDTH = 14

type PenId = 'pen' | 'pencil' | 'marker'

/**
 * `alpha` is applied once when the finished stroke is composited, never per
 * segment — that's what stops a translucent marker from darkening at its own
 * overlaps and corners while still building up where two separate strokes cross.
 */
const PENS: { id: PenId; label: string; alpha: number; hint: string }[] = [
  { id: 'pen', label: 'Pen', alpha: 1, hint: 'A clean, solid line' },
  { id: 'pencil', label: 'Pencil', alpha: 0.9, hint: 'Grainy, like graphite' },
  { id: 'marker', label: 'Marker', alpha: 0.45, hint: 'Broad and translucent' },
]

interface Point {
  x: number
  y: number
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function makeCanvas(size: number) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

/**
 * One smoothed segment of a stroke.
 *
 * Drawn as a quadratic curve through the midpoints between samples rather than
 * a straight line from one pointer event to the next — sparse samples on a fast
 * stroke used to come out as a visibly faceted polyline.
 */
function drawSegment(
  c: CanvasRenderingContext2D,
  from: Point,
  control: Point,
  to: Point,
  pen: PenId,
  width: number,
  color: string,
) {
  c.strokeStyle = color
  c.lineJoin = 'round'

  if (pen === 'pencil') {
    // A few thin, slightly scattered passes read as graphite grain — one solid
    // line at low alpha just looks like a faded pen.
    c.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const jitter = width * 0.28
      const jx = (Math.random() - 0.5) * jitter
      const jy = (Math.random() - 0.5) * jitter
      c.globalAlpha = 0.3 + Math.random() * 0.2
      c.lineWidth = width * (0.45 + Math.random() * 0.35)
      c.beginPath()
      c.moveTo(from.x + jx, from.y + jy)
      c.quadraticCurveTo(control.x + jx, control.y + jy, to.x + jx, to.y + jy)
      c.stroke()
    }
    c.globalAlpha = 1
    return
  }

  c.lineCap = pen === 'marker' ? 'square' : 'round'
  c.lineWidth = width
  c.beginPath()
  c.moveTo(from.x, from.y)
  c.quadraticCurveTo(control.x, control.y, to.x, to.y)
  c.stroke()
}

interface DoodlePadProps {
  pageIndex: number
  targetHalf: 0 | 1 | undefined
  locked: boolean
}

/**
 * Draw once, place many times: a canvas that saves whatever you draw as a new
 * sticker in this book's own library, alongside the built-in
 * tape/heart/star/arrow ones.
 *
 * Strokes are built on three canvases: `base` holds everything already
 * committed, `stroke` holds only the one in progress at full opacity, and the
 * visible canvas shows base with stroke composited over it at the pen's own
 * alpha. Compositing once per stroke — rather than stroking translucent
 * segments straight onto the drawing — is what keeps a marker even along its
 * length instead of blotching wherever segments overlap.
 */
export function DoodlePad({ pageIndex, targetHalf, locked }: DoodlePadProps) {
  const customStickers = useStore((s) => s.customStickers)
  const addCustomSticker = useStore((s) => s.addCustomSticker)
  const removeCustomSticker = useStore((s) => s.removeCustomSticker)
  const addSticker = useStore((s) => s.addSticker)

  const [open, setOpen] = useState(false)
  const [color, setColor] = useState(COLORS[0].hex)
  const [pen, setPen] = useState<PenId>('pen')
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [hasDrawn, setHasDrawn] = useState(false)

  const viewRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const strokeRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const points = useRef<Point[]>([])
  const lastMid = useRef<Point>({ x: 0, y: 0 })

  // Latest values, readable from the pointer handlers without re-binding them.
  const settings = useRef({ color, pen, width })
  settings.current = { color, pen, width }

  useEffect(() => {
    if (!open) return
    baseRef.current = makeCanvas(PAD_SIZE)
    strokeRef.current = makeCanvas(PAD_SIZE)
    setHasDrawn(false)
    renderView()
    // Only on open/close: the canvases are the drawing itself, and rebuilding
    // them on any other change would wipe work in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function renderView() {
    const view = viewRef.current
    const base = baseRef.current
    const stroke = strokeRef.current
    if (!view || !base || !stroke) return
    const c = view.getContext('2d')
    if (!c) return
    c.clearRect(0, 0, PAD_SIZE, PAD_SIZE)
    c.globalAlpha = 1
    c.drawImage(base, 0, 0)
    c.globalAlpha = PENS.find((p) => p.id === settings.current.pen)?.alpha ?? 1
    c.drawImage(stroke, 0, 0)
    c.globalAlpha = 1
  }

  /** Flattens the in-progress stroke onto the committed drawing at the pen's alpha. */
  function commitStroke() {
    const base = baseRef.current
    const stroke = strokeRef.current
    if (!base || !stroke) return
    const c = base.getContext('2d')
    if (!c) return
    c.globalAlpha = PENS.find((p) => p.id === settings.current.pen)?.alpha ?? 1
    c.drawImage(stroke, 0, 0)
    c.globalAlpha = 1
    stroke.getContext('2d')?.clearRect(0, 0, PAD_SIZE, PAD_SIZE)
    renderView()
  }

  function pointFrom(clientX: number, clientY: number): Point {
    const canvas = viewRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * PAD_SIZE,
      y: ((clientY - rect.top) / rect.height) * PAD_SIZE,
    }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    setHasDrawn(true)
    const p = pointFrom(e.clientX, e.clientY)
    points.current = [p]
    lastMid.current = p
    // A tap with no movement should still leave a dot.
    const c = strokeRef.current?.getContext('2d')
    if (c) drawSegment(c, p, p, p, settings.current.pen, settings.current.width, settings.current.color)
    renderView()
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const c = strokeRef.current?.getContext('2d')
    if (!c) return
    // Coalesced events give every sample the browser captured between frames,
    // not just the latest — noticeably smoother on a fast stroke.
    const native = e.nativeEvent
    const samples = native.getCoalescedEvents?.() ?? [native]
    for (const sample of samples) {
      const p = pointFrom(sample.clientX, sample.clientY)
      points.current.push(p)
      const prev = points.current[points.current.length - 2]
      const mid = midpoint(prev, p)
      drawSegment(c, lastMid.current, prev, mid, settings.current.pen, settings.current.width, settings.current.color)
      lastMid.current = mid
    }
    renderView()
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    drawing.current = false
    // Run the curve out to the final sample, which the midpoint scheme
    // otherwise stops short of.
    const c = strokeRef.current?.getContext('2d')
    const last = points.current[points.current.length - 1]
    if (c && last) {
      drawSegment(c, lastMid.current, last, last, settings.current.pen, settings.current.width, settings.current.color)
    }
    points.current = []
    commitStroke()
  }

  function clearPad() {
    baseRef.current?.getContext('2d')?.clearRect(0, 0, PAD_SIZE, PAD_SIZE)
    strokeRef.current?.getContext('2d')?.clearRect(0, 0, PAD_SIZE, PAD_SIZE)
    setHasDrawn(false)
    renderView()
  }

  // Every other overlay in the app closes on Escape — reset, the layout
  // picker, the zoom view, the colour popover. This one didn't.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function saveAsSticker() {
    const base = baseRef.current
    const c = base?.getContext('2d')
    if (!base || !c || !hasDrawn) return

    // Trim to the drawing's own bounding box so the sticker isn't mostly
    // transparent padding.
    const { data } = c.getImageData(0, 0, PAD_SIZE, PAD_SIZE)
    let minX = PAD_SIZE
    let minY = PAD_SIZE
    let maxX = 0
    let maxY = 0
    for (let y = 0; y < PAD_SIZE; y++) {
      for (let x = 0; x < PAD_SIZE; x++) {
        if (data[(y * PAD_SIZE + x) * 4 + 3] > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < minX || maxY < minY) return // nothing opaque was drawn

    const pad = 12
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(PAD_SIZE, maxX + pad)
    maxY = Math.min(PAD_SIZE, maxY + pad)

    const trimmed = document.createElement('canvas')
    trimmed.width = maxX - minX
    trimmed.height = maxY - minY
    trimmed
      .getContext('2d')!
      .drawImage(base, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height)

    addCustomSticker(trimmed.toDataURL('image/png'))
    clearPad()
    // Close on save: the drawing lands in the tray behind this modal, so
    // staying open would clear the canvas with nothing visibly to show for it.
    setOpen(false)
  }

  const activePen = PENS.find((p) => p.id === pen)!

  return (
    <div className="doodle-pad-section">
      <button className="btn add-text-btn" onClick={() => setOpen(true)} disabled={locked}>
        <Icon name="pencil" size={14} /> Draw a Sticker
      </button>

      {/* In a modal rather than inline: the pad is the one thing here that
          genuinely wants room, and the sidebar has none to give. */}
      {open && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Draw a sticker"
          onClick={() => setOpen(false)}
        >
          <div className="library-card doodle-card" onClick={(e) => e.stopPropagation()}>
            <div className="library-header">
              <h2 className="library-title">Draw a sticker</h2>
              <div className="library-actions">
                <button className="btn" onClick={() => setOpen(false)} aria-label="Close drawing pad">
                  Close
                </button>
              </div>
            </div>

            <canvas
              ref={viewRef}
              width={PAD_SIZE}
              height={PAD_SIZE}
              className="doodle-canvas"
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
            />

            <div className="doodle-tools">
              <div className="doodle-tool-group">
                <span className="doodle-tool-label">Pen</span>
                <div className="filter-chips-row">
                  {PENS.map((p) => (
                    <button
                      key={p.id}
                      className={`filter-chip-btn${pen === p.id ? ' active' : ''}`}
                      onClick={() => setPen(p.id)}
                      aria-pressed={pen === p.id}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="doodle-tool-group">
                <span className="doodle-tool-label">Size</span>
                <input
                  type="range"
                  className="doodle-size-range"
                  min={MIN_WIDTH}
                  max={MAX_WIDTH}
                  step={1}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  aria-label="Pen size"
                />
                <span
                  className="doodle-size-preview"
                  aria-hidden="true"
                  style={{
                    width: Math.max(4, (width / MAX_WIDTH) * 26),
                    height: Math.max(4, (width / MAX_WIDTH) * 26),
                    background: color,
                    opacity: activePen.alpha,
                  }}
                />
              </div>

              <div className="doodle-tool-group">
                <span className="doodle-tool-label">Color</span>
                <ColorField
                  label="Pen colour"
                  compact
                  value={color}
                  swatches={COLORS.map((c) => ({ id: c.id, color: c.hex, label: c.id }))}
                  onChange={setColor}
                />
              </div>

              <div className="doodle-actions">
                <button className="btn" onClick={clearPad} disabled={!hasDrawn}>
                  Clear
                </button>
                <button className="btn btn-primary" onClick={saveAsSticker} disabled={!hasDrawn}>
                  Save as Sticker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {customStickers.length > 0 && (
        <div className="doodle-tray">
          {customStickers.map((sticker) => (
            <div key={sticker.id} className="doodle-tray-item">
              <button
                className="doodle-tray-btn"
                onClick={() => addSticker(pageIndex, targetHalf, 'custom', sticker.id)}
                disabled={locked}
                title="Add this drawing to the page"
              >
                <img src={sticker.dataUrl} alt="Your drawing" draggable={false} />
              </button>
              <button
                className="doodle-tray-remove"
                onClick={() => removeCustomSticker(sticker.id)}
                aria-label="Delete this drawing from your sticker library"
                title="Delete from library"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
