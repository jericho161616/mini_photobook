import { useEffect, useRef, useState } from 'react'
import { fontSizeScale, fontStack } from '../data/fonts'
import { StickerGlyph } from './StickerGlyph'
import type { CustomSticker, Sticker, TextBox } from '../types'
import { SNAP_TOLERANCE_PX, snapBox, targetsFrom, type SnapBox, type SnapTargets } from '../lib/snap'

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
  /** The *other* decorations on this page — a box aligning to its own edges would win at zero distance and mean nothing. */
  otherBoxes: SnapBox[]
  /** Reports the lines that grabbed, so the layer can draw them; null on drop. */
  onGuides: (guides: { v: number[]; h: number[] } | null) => void
  selected: boolean
  locked: boolean
  onSelect: () => void
  onChange: (patch: Partial<Box>) => void
  onDelete: () => void
  /** Fires on a genuine click (no real drag movement) on a box that was already selected — used to enter text-edit mode without that click being swallowed as a drag. */
  onActivate?: () => void
  children: React.ReactNode
}

const MIN_SIZE_PCT = 6
/** Below this many pixels of movement, a mousedown-then-up counts as a click rather than a drag. */
const CLICK_THRESHOLD_PX = 3

/** Tape is a colored rectangle drawn by CSS background; the icons are strokes that inherit `color`. */
export function isTapeSticker(type: Sticker['type']): boolean {
  return type === 'tape-yellow' || type === 'tape-pink' || type === 'tape-sage'
}

/**
 * A sticker's own tilt/mirror/color/opacity as inline style. Shared shape with
 * exportPdf.ts's drawSticker so a sticker looks the same on screen and in print.
 */
export function stickerArtStyle(sticker: Sticker): React.CSSProperties {
  const rotation = sticker.rotation ?? 0
  const flip = sticker.flipX ? -1 : 1
  return {
    transform: rotation || sticker.flipX ? `rotate(${rotation}deg) scaleX(${flip})` : undefined,
    // Tape's color is a background fill; every other built-in glyph strokes
    // with currentColor, so one `color` covers them all.
    ...(sticker.color
      ? isTapeSticker(sticker.type)
        ? { background: sticker.color }
        : { color: sticker.color }
      : null),
    opacity: sticker.opacity !== undefined ? sticker.opacity / 100 : undefined,
  }
}

/**
 * Shared drag-to-move / drag-to-resize chrome for one sticker or text box.
 * Tracks the gesture with window-level listeners rather than pointer capture
 * on the element itself, so a fast drag can't outrun the element under it.
 */
function DecorationBox({ box, containerSize, otherBoxes, onGuides, selected, locked, onSelect, onChange, onDelete, onActivate, children }: DecorationBoxProps) {
  const [dragging, setDragging] = useState(false)
  const boxRef = useRef(box)
  boxRef.current = box
  const containerSizeRef = useRef(containerSize)
  containerSizeRef.current = containerSize
  // Rebuilt each render so the lines follow the other boxes if they move,
  // and read through a ref so the drag handler always sees the current set.
  const snapRef = useRef<SnapTargets>(targetsFrom(otherBoxes))
  snapRef.current = targetsFrom(otherBoxes)

  // Listeners are attached synchronously inside the mousedown handler itself,
  // not via a useEffect — an effect only runs after React commits the state
  // update that would gate it, which lags the very next mousemove enough to
  // drop the start of a fast drag.
  function beginGesture(e: React.MouseEvent, kind: 'drag' | 'resize') {
    if (locked) return
    e.stopPropagation()
    if (kind === 'resize') e.preventDefault()
    const wasSelected = selected
    onSelect()
    const start = { x: e.clientX, y: e.clientY, box: boxRef.current }
    let moved = false
    if (kind === 'drag') setDragging(true)

    function onMove(ev: MouseEvent) {
      const { w, h } = containerSizeRef.current
      const dxPct = ((ev.clientX - start.x) / w) * 100
      const dyPct = ((ev.clientY - start.y) / h) * 100
      if (Math.abs(ev.clientX - start.x) > CLICK_THRESHOLD_PX || Math.abs(ev.clientY - start.y) > CLICK_THRESHOLD_PX) {
        moved = true
      }
      if (kind === 'drag') {
        const raw = { x: start.box.x + dxPct, y: start.box.y + dyPct, w: start.box.w, h: start.box.h }
        // Holding Alt drags freely, for the times the guides are in the way.
        if (ev.altKey) {
          onGuides(null)
          onChange({ x: raw.x, y: raw.y })
        } else {
          // The tolerance is a fixed number of screen pixels, so it feels the
          // same on a tall page as a wide one — hence converting per axis.
          const snapped = snapBox(
            raw,
            snapRef.current,
            (SNAP_TOLERANCE_PX / w) * 100,
            (SNAP_TOLERANCE_PX / h) * 100,
          )
          onGuides(snapped.guides.v.length || snapped.guides.h.length ? snapped.guides : null)
          onChange({ x: snapped.x, y: snapped.y })
        }
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
      if (kind === 'drag') {
        setDragging(false)
        onGuides(null)
        // A click (no real movement) on a box already selected before this
        // gesture started activates it (e.g. enters text-edit mode) instead
        // of just re-selecting it — a genuine drag never does, so moving an
        // already-selected box still works.
        if (!moved && wasSelected) onActivate?.()
      }
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
  /** The book's own drawn-sticker library — looked up by a sticker's customId. */
  customStickers: CustomSticker[]
  containerSize: { w: number; h: number }
  locked: boolean
  isSelected: (kind: 'sticker' | 'textBox', id: string) => boolean
  onSelect: (kind: 'sticker' | 'textBox', id: string) => void
  onChangeSticker: (id: string, patch: Partial<Sticker>) => void
  onChangeTextBox: (id: string, patch: Partial<TextBox>) => void
  onDelete: (kind: 'sticker' | 'textBox', id: string) => void
  onEditText: (id: string, text: string) => void
}

/** Focuses a contentEditable element and drops the caret at the end of its text. */
function focusAtEnd(el: HTMLElement) {
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

interface FreeTextContentProps {
  box: TextBox
  containerSize: { w: number; h: number }
  editing: boolean
  locked: boolean
  onStartEditing: () => void
  onCommit: (text: string) => void
}

/**
 * The editable text itself, split out from DecorationBox's map so the
 * focus-on-entering-edit-mode effect only re-runs when `editing` actually
 * flips — not on every unrelated re-render, which would otherwise yank the
 * caret back to the end while someone is mid-sentence.
 */
function FreeTextContent({ box, containerSize, editing, locked, onStartEditing, onCommit }: FreeTextContentProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing && ref.current) focusAtEnd(ref.current)
  }, [editing])

  return (
    <div
      ref={ref}
      className="freetext-content"
      contentEditable={!locked && editing}
      suppressContentEditableWarning
      style={{
        fontFamily: fontStack(box.font),
        // Undefined falls through to the stylesheet's own ink, which already
        // adapts to a dark page — an explicit colour overrides that.
        color: box.color,
        fontWeight: box.bold ? 700 : 400,
        fontStyle: box.italic ? 'italic' : 'normal',
        textAlign: box.align,
        justifyContent: box.align === 'left' ? 'flex-start' : box.align === 'right' ? 'flex-end' : 'center',
        fontSize: Math.max(10, containerSize.h * (box.h / 100) * 0.28) * fontSizeScale(box.size),
        cursor: editing ? 'text' : undefined,
      }}
      // Only swallow the mousedown while actively editing — otherwise it must
      // bubble up so the box can be selected and dragged like anything else.
      onMouseDown={(e) => editing && e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!locked) onStartEditing()
      }}
      onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
    >
      {box.text}
    </div>
  )
}

export function DecorationLayer({
  stickers,
  textBoxes,
  customStickers,
  containerSize,
  locked,
  isSelected,
  onSelect,
  onChangeSticker,
  onChangeTextBox,
  onDelete,
  onEditText,
}: DecorationLayerProps) {
  // Guides live here rather than in each box: they are drawn once over the
  // whole page, and only one box is ever dragged at a time.
  const [guides, setGuides] = useState<{ v: number[]; h: number[] } | null>(null)

  const allBoxes: (SnapBox & { id: string })[] = [...stickers, ...textBoxes]
  const othersOf = (id: string) => allBoxes.filter((b) => b.id !== id)

  // Which text box (if any) is in edit mode — entered via double-click, or a
  // plain click on a box already selected, or automatically right after it's
  // first created. Not persisted: it's transient UI state, reset by default
  // (not editing) whenever the page changes.
  const [editingId, setEditingId] = useState<string | null>(null)
  const knownIdsRef = useRef(new Set(textBoxes.map((t) => t.id)))
  useEffect(() => {
    for (const box of textBoxes) {
      if (!knownIdsRef.current.has(box.id) && isSelected('textBox', box.id)) {
        setEditingId(box.id)
      }
    }
    knownIdsRef.current = new Set(textBoxes.map((t) => t.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textBoxes])

  return (
    <>
      {stickers.map((sticker) => (
        <DecorationBox
          key={sticker.id}
          box={sticker}
          containerSize={containerSize}
          otherBoxes={othersOf(sticker.id)}
          onGuides={setGuides}
          selected={isSelected('sticker', sticker.id)}
          locked={locked}
          onSelect={() => onSelect('sticker', sticker.id)}
          onChange={(patch) => onChangeSticker(sticker.id, patch)}
          onDelete={() => onDelete('sticker', sticker.id)}
        >
          {/*
           * Tilt and mirror are applied to the artwork rather than to the
           * DecorationBox around it, so the selection ring and its drag/resize
           * handles stay axis-aligned — a rotated handle is meaningfully
           * harder to grab, and the box's own gesture math is all in
           * unrotated screen space.
           */}
          <div
            className={`sticker-glyph sticker-${sticker.type}`}
            style={stickerArtStyle(sticker)}
          >
            <StickerGlyph
              type={sticker.type}
              customUrl={sticker.type === 'custom' ? customStickers.find((c) => c.id === sticker.customId)?.dataUrl : undefined}
            />
          </div>
        </DecorationBox>
      ))}
      {textBoxes.map((box) => {
        const editing = editingId === box.id
        return (
          <DecorationBox
            key={box.id}
            box={box}
            containerSize={containerSize}
            otherBoxes={othersOf(box.id)}
            onGuides={setGuides}
            selected={isSelected('textBox', box.id)}
            locked={locked}
            onSelect={() => onSelect('textBox', box.id)}
            onChange={(patch) => onChangeTextBox(box.id, patch)}
            onDelete={() => onDelete('textBox', box.id)}
            onActivate={() => !locked && setEditingId(box.id)}
          >
            <FreeTextContent
              box={box}
              containerSize={containerSize}
              editing={editing}
              locked={locked}
              onStartEditing={() => setEditingId(box.id)}
              onCommit={(text) => {
                onEditText(box.id, text)
                setEditingId(null)
              }}
            />
          </DecorationBox>
        )
      })}

      {/* Drawn last so they sit over everything, and pointer-events: none so
          they never interrupt the drag that summoned them. */}
      {guides?.v.map((x) => (
        <span key={`v${x}`} className="snap-guide vertical" style={{ left: `${x}%` }} aria-hidden="true" />
      ))}
      {guides?.h.map((y) => (
        <span key={`h${y}`} className="snap-guide horizontal" style={{ top: `${y}%` }} aria-hidden="true" />
      ))}
    </>
  )
}
