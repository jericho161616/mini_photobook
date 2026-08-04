import { useRef, useState } from 'react'
import { useStore } from '../state/useStore'

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

const PAD_SIZE = 320
const LINE_WIDTH = 9

interface DoodlePadProps {
  pageIndex: number
  targetHalf: 0 | 1 | undefined
  locked: boolean
}

/**
 * Draw once, place many times: a small canvas that saves whatever you draw
 * as a new sticker in this book's own library, alongside the built-in
 * tape/heart/star/arrow ones.
 */
export function DoodlePad({ pageIndex, targetHalf, locked }: DoodlePadProps) {
  const customStickers = useStore((s) => s.customStickers)
  const addCustomSticker = useStore((s) => s.addCustomSticker)
  const removeCustomSticker = useStore((s) => s.removeCustomSticker)
  const addSticker = useStore((s) => s.addSticker)

  const [open, setOpen] = useState(false)
  const [color, setColor] = useState(COLORS[0].hex)
  const [hasDrawn, setHasDrawn] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  function ctx() {
    return canvasRef.current?.getContext('2d') ?? null
  }

  function pointFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    setHasDrawn(true)
    last.current = pointFrom(e)
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const c = ctx()
    if (!c) return
    const point = pointFrom(e)
    c.strokeStyle = color
    c.lineWidth = LINE_WIDTH
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(last.current.x, last.current.y)
    c.lineTo(point.x, point.y)
    c.stroke()
    last.current = point
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current) e.currentTarget.releasePointerCapture(e.pointerId)
    drawing.current = false
  }

  function clearPad() {
    const canvas = canvasRef.current
    const c = ctx()
    if (!canvas || !c) return
    c.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  function saveAsSticker() {
    const canvas = canvasRef.current
    const c = ctx()
    if (!canvas || !c || !hasDrawn) return

    // Trim to the drawing's own bounding box so the sticker isn't mostly
    // transparent padding.
    const { data } = c.getImageData(0, 0, canvas.width, canvas.height)
    let minX = canvas.width
    let minY = canvas.height
    let maxX = 0
    let maxY = 0
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < minX || maxY < minY) return // nothing opaque was drawn

    const pad = 10
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(canvas.width, maxX + pad)
    maxY = Math.min(canvas.height, maxY + pad)

    const trimmed = document.createElement('canvas')
    trimmed.width = maxX - minX
    trimmed.height = maxY - minY
    trimmed.getContext('2d')!.drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height)

    addCustomSticker(trimmed.toDataURL('image/png'))
    clearPad()
  }

  return (
    <div className="doodle-pad-section">
      <button className="btn add-text-btn" onClick={() => setOpen((v) => !v)} disabled={locked}>
        {open ? 'Close drawing pad' : '✏️ Draw a Sticker'}
      </button>

      {open && (
        <div className="doodle-pad">
          <canvas
            ref={canvasRef}
            width={PAD_SIZE}
            height={PAD_SIZE}
            className="doodle-canvas"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
          <div className="doodle-color-row">
            {COLORS.map((c) => (
              <button
                key={c.id}
                className={`doodle-swatch${color === c.hex ? ' active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => setColor(c.hex)}
                aria-label={`${c.id} pen color`}
                aria-pressed={color === c.hex}
              />
            ))}
          </div>
          <div className="slot-controls">
            <button className="btn" onClick={clearPad} disabled={!hasDrawn}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={saveAsSticker} disabled={!hasDrawn}>
              Save as Sticker
            </button>
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
