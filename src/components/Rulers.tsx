import { useRef, useState } from 'react'
import { useStore } from '../state/useStore'
import type { BookSize } from '../types'

/** Ruler thickness in px — the same number the CSS reserves as padding. */
export const RULER_SIZE = 20

/**
 * Picks a tick spacing that gives a readable number of labels at the size the
 * page is actually being drawn. A 4-inch postcard wants half-inch marks; a
 * 14-inch landscape book at the same screen width does not.
 */
function tickStep(inches: number, pixels: number): number {
  const candidates = [0.25, 0.5, 1, 2, 5]
  for (const step of candidates) {
    // Roughly 44px between labels before they start to crowd.
    if ((pixels / inches) * step >= 44) return step
  }
  return 5
}

interface RulerProps {
  axis: 'v' | 'h'
  /** The page's length along this axis, in inches and in px. */
  inches: number
  pixels: number
  onDragOut: (percent: number) => void
}

/**
 * One ruler. Numbers are in inches, because that's what a book's size is
 * quoted in and what it will be when it's printed — percentages would be
 * exact but meaningless when you're deciding how far from the edge a caption
 * should sit.
 *
 * Dragging off it creates a guide, the way it works in every design tool.
 */
function Ruler({ axis, inches, pixels, onDragOut }: RulerProps) {
  const step = tickStep(inches, pixels)
  const ticks: number[] = []
  for (let at = 0; at <= inches + 1e-6; at += step) ticks.push(Number(at.toFixed(2)))

  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)

  function begin(e: React.MouseEvent) {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const at = (ev: MouseEvent) =>
      axis === 'v'
        ? ((ev.clientX - rect.left) / rect.width) * 100
        : ((ev.clientY - rect.top) / rect.height) * 100

    function onMove(ev: MouseEvent) {
      setDrag(Math.max(0, Math.min(100, at(ev))))
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const percent = at(ev)
      setDrag(null)
      // Released back over the ruler itself, or off the page — no guide.
      if (percent >= 0 && percent <= 100) onDragOut(percent)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    setDrag(at(e.nativeEvent))
  }

  return (
    <div
      ref={ref}
      className={`ruler ${axis === 'v' ? 'top' : 'left'}`}
      onMouseDown={begin}
      title="Drag onto the page to add a guide"
    >
      {ticks.map((at) => {
        const percent = (at / inches) * 100
        const style = axis === 'v' ? { left: `${percent}%` } : { top: `${percent}%` }
        // The last label would hang off the end, so it's dropped.
        const showLabel = percent < 97
        return (
          <span key={at} className="ruler-tick" style={style}>
            {showLabel && <span className="ruler-label">{at}</span>}
          </span>
        )
      })}
      {drag !== null && (
        <span
          className="ruler-preview"
          style={axis === 'v' ? { left: `${drag}%` } : { top: `${drag}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

/**
 * The rulers, plus the guides they produce.
 *
 * Guides belong to the book rather than one page: the whole point is that the
 * same line falls in the same place throughout, so a caption sits at the same
 * height on every page. Decorations snap to them like any other line, and
 * none of it ever reaches the export.
 */
export function Rulers({ size, width, height }: { size: BookSize; width: number; height: number }) {
  const guides = useStore((s) => s.guides)
  const addGuide = useStore((s) => s.addGuide)
  const moveGuide = useStore((s) => s.moveGuide)

  return (
    <>
      <Ruler axis="v" inches={size.widthIn} pixels={width} onDragOut={(p) => addGuide('v', p)} />
      <Ruler axis="h" inches={size.heightIn} pixels={height} onDragOut={(p) => addGuide('h', p)} />
      <GuideLines guides={guides} onMove={moveGuide} width={width} height={height} />
    </>
  )
}

/** The guides themselves: draggable to move, dragged off the page to remove. */
function GuideLines({
  guides,
  onMove,
  width,
  height,
}: {
  guides: { v: number[]; h: number[] }
  onMove: (axis: 'v' | 'h', index: number, position: number) => void
  width: number
  height: number
}) {
  function grab(axis: 'v' | 'h', index: number, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const span = axis === 'v' ? width : height
    const origin = axis === 'v' ? e.clientX : e.clientY
    const start = guides[axis][index]

    function onPointerMove(ev: MouseEvent) {
      const travelled = ((axis === 'v' ? ev.clientX : ev.clientY) - origin) / span
      // Deliberately not clamped: the store deletes a guide pushed past an
      // edge, which is how dragging one away is meant to feel.
      onMove(axis, index, start + travelled * 100)
    }
    function onPointerUp() {
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
    }
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
  }

  return (
    <>
      {guides.v.map((at, i) => (
        <span
          key={`v${i}`}
          className="guide vertical"
          style={{ left: `${at}%` }}
          onMouseDown={(e) => grab('v', i, e)}
          title="Drag to move — drag it off the page to remove"
        />
      ))}
      {guides.h.map((at, i) => (
        <span
          key={`h${i}`}
          className="guide horizontal"
          style={{ top: `${at}%` }}
          onMouseDown={(e) => grab('h', i, e)}
          title="Drag to move — drag it off the page to remove"
        />
      ))}
    </>
  )
}
