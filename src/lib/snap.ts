/**
 * Alignment snapping for freely placed stickers and text boxes.
 *
 * Positioning a text box by eye is the one thing a percentage-based canvas is
 * genuinely bad at: "is this actually centred, or two pixels off?" can't be
 * answered by looking. So while a box is dragged, its edges and centre are
 * compared against the page's own lines and against every other decoration on
 * the page. Anything within a few pixels pulls the box onto it exactly, and a
 * guide line is drawn to say why it stopped.
 *
 * Everything here is in percent of the container, matching how decorations are
 * stored, so the same numbers work at any zoom or page size.
 */

/** How close, in screen pixels, a line has to be before it grabs. */
export const SNAP_TOLERANCE_PX = 6

export interface SnapBox {
  x: number
  y: number
  w: number
  h: number
}

/** Candidate lines to snap against, in percent. */
export interface SnapTargets {
  /** Vertical lines (x positions). */
  v: number[]
  /** Horizontal lines (y positions). */
  h: number[]
}

/**
 * The page's own lines: both edges and the centre. The centre is the one that
 * matters most — it's the question people are actually asking.
 */
export function pageTargets(): SnapTargets {
  return { v: [0, 50, 100], h: [0, 50, 100] }
}

/** Adds every other decoration's edges and centre line, so boxes line up with each other too. */
export function targetsFrom(boxes: SnapBox[], pageLines = pageTargets()): SnapTargets {
  const v = [...pageLines.v]
  const h = [...pageLines.h]
  for (const b of boxes) {
    v.push(b.x, b.x + b.w / 2, b.x + b.w)
    h.push(b.y, b.y + b.h / 2, b.y + b.h)
  }
  return { v, h }
}

interface AxisResult {
  /** How far to move along this axis to land on the line, in percent. */
  delta: number
  /** The line that grabbed, in percent — for drawing the guide. */
  guide: number | null
}

/**
 * Picks the nearest line for one axis. Compares three points on the box — its
 * near edge, centre and far edge — and takes whichever pairing is closest, so
 * a box can snap by any of its own edges rather than only its origin.
 */
function snapAxis(start: number, size: number, targets: number[], tolerance: number): AxisResult {
  const points = [start, start + size / 2, start + size]
  let best: AxisResult = { delta: 0, guide: null }
  let bestDistance = tolerance
  for (const target of targets) {
    for (const point of points) {
      const distance = Math.abs(target - point)
      if (distance < bestDistance) {
        bestDistance = distance
        best = { delta: target - point, guide: target }
      }
    }
  }
  return best
}

export interface SnapResult {
  x: number
  y: number
  /** Lines to draw, in percent — empty when nothing grabbed. */
  guides: { v: number[]; h: number[] }
}

/**
 * Snaps a dragged box onto the nearest lines. `tolerance` is given per axis
 * because a page is rarely square: six screen pixels is a different percentage
 * horizontally than vertically.
 */
export function snapBox(
  box: SnapBox,
  targets: SnapTargets,
  toleranceX: number,
  toleranceY: number,
): SnapResult {
  const vx = snapAxis(box.x, box.w, targets.v, toleranceX)
  const hy = snapAxis(box.y, box.h, targets.h, toleranceY)
  return {
    x: box.x + vx.delta,
    y: box.y + hy.delta,
    guides: {
      v: vx.guide === null ? [] : [vx.guide],
      h: hy.guide === null ? [] : [hy.guide],
    },
  }
}
