import { useRef, useState } from 'react'
import { fontSizeScale, fontStack } from '../data/fonts'
import { StickerGlyph } from './StickerGlyph'
import type { Sticker, TextBox } from '../types'

interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface DecorationBoxProps {
  box: Box
  containerSize: { w: number; h: number }
  selected: boolean
  locked: boolean
  onSelect: () => void
  onChange: (patch: Partial<Box>) => void
  onDelete: () => void
  children: React.ReactNode
}

const MIN_SIZE_PCT = 6

/**
 * Shared drag-to-move / drag-to-resize chrome for one sticker or text box.
 * Tracks the gesture with window-level listeners rather than pointer capture
 * on the element itself, so a fast drag can't outrun the element under it.
 */
function DecorationBox({ box, containerSize, selected, locked, onSelect, onChange, onDelete, children }: DecorationBoxProps) {
  const [dragging, setDragging] = useState(false)
  const boxRef = useRef(box)
  boxRef.current = box
  const containerSizeRef = useRef(containerSize)
  containerSizeRef.current = containerSize

  // Listeners are attached synchronously inside the mousedown handler itself,
  // not via a useEffect — an effect only runs after React commits the state
  // update that would gate it, which lags the very next mousemove enough to
  // drop the start of a fast drag.
  function beginGesture(e: React.MouseEvent, kind: 'drag' | 'resize') {
    if (locked) return
    e.stopPropagation()
    if (kind === 'resize') e.preventDefault()
    onSelect()
    const start = { x: e.clientX, y: e.clientY, box: boxRef.current }
    if (kind === 'drag') setDragging(true)

    function onMove(ev: MouseEvent) {
      const { w, h } = containerSizeRef.current
      const dxPct = ((ev.clientX - start.x) / w) * 100
      const dyPct = ((ev.clientY - start.y) / h) * 100
      if (kind === 'drag') {
        onChange({ x: start.box.x + dxPct, y: start.box.y + dyPct })
      } else {
        onChange({
          w: Math.max(MIN_SIZE_PCT, start.box.w + dxPct),
          h: Math.max(MIN_SIZE_PCT, start.box.h + dyPct),
        })
      }
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (kind === 'drag') setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startDrag = (e: React.MouseEvent) => beginGesture(e, 'drag')
  const startResize = (e: React.MouseEvent) => beginGesture(e, 'resize')

  return (
    <div
      className={`decoration${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}${locked ? ' locked' : ''}`}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
      onMouseDown={startDrag}
    >
      {children}
      {selected && !locked && (
        <>
          <button
            className="decoration-delete"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Remove"
            title="Remove"
          >
            ×
          </button>
          <span className="decoration-resize" onMouseDown={startResize} />
        </>
      )}
    </div>
  )
}

interface DecorationLayerProps {
  stickers: Sticker[]
  textBoxes: TextBox[]
  containerSize: { w: number; h: number }
  locked: boolean
  isSelected: (kind: 'sticker' | 'textBox', id: string) => boolean
  onSelect: (kind: 'sticker' | 'textBox', id: string) => void
  onChangeSticker: (id: string, patch: Partial<Sticker>) => void
  onChangeTextBox: (id: string, patch: Partial<TextBox>) => void
  onDelete: (kind: 'sticker' | 'textBox', id: string) => void
  onEditText: (id: string, text: string) => void
}

export function DecorationLayer({
  stickers,
  textBoxes,
  containerSize,
  locked,
  isSelected,
  onSelect,
  onChangeSticker,
  onChangeTextBox,
  onDelete,
  onEditText,
}: DecorationLayerProps) {
  return (
    <>
      {stickers.map((sticker) => (
        <DecorationBox
          key={sticker.id}
          box={sticker}
          containerSize={containerSize}
          selected={isSelected('sticker', sticker.id)}
          locked={locked}
          onSelect={() => onSelect('sticker', sticker.id)}
          onChange={(patch) => onChangeSticker(sticker.id, patch)}
          onDelete={() => onDelete('sticker', sticker.id)}
        >
          <div className={`sticker-glyph sticker-${sticker.type}`}>
            <StickerGlyph type={sticker.type} />
          </div>
        </DecorationBox>
      ))}
      {textBoxes.map((box) => (
        <DecorationBox
          key={box.id}
          box={box}
          containerSize={containerSize}
          selected={isSelected('textBox', box.id)}
          locked={locked}
          onSelect={() => onSelect('textBox', box.id)}
          onChange={(patch) => onChangeTextBox(box.id, patch)}
          onDelete={() => onDelete('textBox', box.id)}
        >
          <div
            className="freetext-content"
            contentEditable={!locked}
            suppressContentEditableWarning
            style={{
              fontFamily: fontStack(box.font),
              fontWeight: box.bold ? 700 : 400,
              textAlign: box.align,
              justifyContent: box.align === 'left' ? 'flex-start' : box.align === 'right' ? 'flex-end' : 'center',
              fontSize: Math.max(10, containerSize.h * (box.h / 100) * 0.28) * fontSizeScale(box.size),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={(e) => onEditText(box.id, e.currentTarget.textContent ?? '')}
          >
            {box.text}
          </div>
        </DecorationBox>
      ))}
    </>
  )
}
