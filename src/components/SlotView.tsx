import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CIRCLE_BORDER_RATIO,
  coverGeometry,
  FRAME_INSET_RATIO,
  photoThumbUrl,
  photoUrl,
  POSTER_BORDER_RATIO,
  stampClipPathCss,
  STAMP_INSET_RATIO,
} from '../lib/imageUtils'
import type { Photo, Placement, PhotoFilter } from '../types'
import { AttachmentGraphic } from './AttachmentGraphic'

/** Wires an empty slot's little "pick from here" popover — see SpreadCanvas. */
export interface QuickPick {
  open: boolean
  photos: Photo[]
  onOpen: () => void
  onClose: () => void
  onPick: (photoId: string) => void
  onOpenLibrary: () => void
}

interface SlotViewProps {
  rect: { x: number; y: number; w: number; h: number }
  placement: Placement | null
  photo: Photo | undefined
  selected: boolean
  onSelect: () => void
  onDropPhoto: (photoId: string) => void
  onPan: (offsetX: number, offsetY: number) => void
  /** A small white card mount around the photo — the Instant Grid look. */
  framed?: boolean
  /** Taped-on-top styling for a 'poster'-decorated template's overlay slot(s). */
  poster?: boolean
  /** Centered circular portrait with a white ring — Circle Inset's second slot. */
  circle?: boolean
  /** A thin outline around the photo — independent of, and combinable with, the template's own styling. */
  hairline?: boolean
  /** A scalloped postage-stamp cut edge — independent of, and combinable with, other styling. */
  stamp?: boolean
  /** A subtle inset ring with no border/rotation — the Photo Window decoration's inset slot. */
  windowSlot?: boolean
  /** Overrides the placement's own filter — used to force the Photo Window decoration's background slot to grayscale. */
  forceFilter?: PhotoFilter
  /** The template's own fixed tilt for this slot (Confetti Scatter, Overlapping Duo) plus the photo's manual tilt, combined. */
  rotationDeg?: number
  /** True while a photo is picked up for click-to-place — takes priority over the quick picker. */
  hasArmedPhoto?: boolean
  /** Present only for empty slots — omitted once a photo occupies the slot. */
  quickPick?: QuickPick
}

const FILTER_CSS: Record<string, string> = {
  bw: 'grayscale(1)',
  sepia: 'sepia(0.75) saturate(1.1)',
  negative: 'invert(1) hue-rotate(180deg)',
}

export function SlotView({
  rect,
  placement,
  photo,
  selected,
  onSelect,
  onDropPhoto,
  onPan,
  framed,
  poster,
  circle,
  hairline,
  stamp,
  windowSlot,
  forceFilter,
  rotationDeg,
  hasArmedPhoto,
  quickPick,
}: SlotViewProps) {
  const [dragOver, setDragOver] = useState(false)
  const [panning, setPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!quickPick?.open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) quickPick?.onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [quickPick?.open, quickPick])

  // Circle Inset's second slot is always a true circle regardless of the
  // book's own aspect ratio — its diameter is the smaller of the passed
  // rect's own width and height, centered within that rect.
  const box = circle
    ? (() => {
        const size = Math.min(rect.w, rect.h)
        return { x: rect.x + (rect.w - size) / 2, y: rect.y + (rect.h - size) / 2, w: size, h: size }
      })()
    : rect

  // The photo itself may sit inside a decorative inset (a white mat for
  // Instant Grid, a border for the taped Poster Overlay photo, a ring for
  // Circle Inset, a margin inside the Stamp's scalloped cut) — computed in JS
  // rather than CSS padding, so it stays exact regardless of the containing
  // block, and matches exportPdf's math pixel for pixel.
  const inset = framed
    ? Math.min(box.w, box.h) * FRAME_INSET_RATIO
    : poster
      ? box.w * POSTER_BORDER_RATIO
      : circle
        ? box.w * CIRCLE_BORDER_RATIO
        : stamp
          ? Math.min(box.w, box.h) * STAMP_INSET_RATIO
          : 0
  const photoBox = { w: box.w - inset * 2, h: box.h - inset * 2 }

  // Same points feed exportPdf's canvas path, so the cut edge prints exactly
  // as shown here. Memoized on the box's own size so a drag/pan elsewhere on
  // the page — which re-renders this slot too — doesn't recompute it.
  const stampClipPath = useMemo(() => (stamp ? stampClipPathCss(box.w, box.h) : undefined), [stamp, box.w, box.h])

  const geo =
    photo && placement ? coverGeometry(photo.width / photo.height, photoBox.w, photoBox.h, placement) : null

  // Only worth dragging if the photo actually overflows the slot somewhere.
  const pannable = !!geo && (geo.slackX > 0.5 || geo.slackY > 0.5)

  function handlePointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (!geo || !placement || !pannable) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: placement.offsetX,
      offsetY: placement.offsetY,
    }
    setPanning(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const start = panStart.current
    if (!start || !geo) return
    // Convert pixel travel into offset units: a full drag across the slack
    // moves the offset by its whole -1..1 range.
    const dx = geo.slackX > 0 ? ((e.clientX - start.x) * 2) / geo.slackX : 0
    const dy = geo.slackY > 0 ? ((e.clientY - start.y) * 2) / geo.slackY : 0
    onPan(start.offsetX + dx, start.offsetY + dy)
  }

  function endPan(e: React.PointerEvent<HTMLImageElement>) {
    if (panStart.current) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      panStart.current = null
      setPanning(false)
    }
  }

  const classes = [
    'slot',
    selected && 'selected',
    !photo && 'empty',
    dragOver && 'drop-target',
    pannable && 'pannable',
    panning && 'panning',
    framed && 'slot-framed',
    poster && 'slot-poster',
    circle && 'slot-circle',
    hairline && 'slot-hairline',
    stamp && 'slot-stamp',
    windowSlot && 'slot-window',
  ]
    .filter(Boolean)
    .join(' ')

  function handleClick() {
    // A filled slot, or one being handed an armed photo, behaves exactly as
    // before — onSelect already knows to place the armed photo instead of
    // just selecting when one is picked up (see SpreadCanvas).
    if (photo || hasArmedPhoto || !quickPick) {
      onSelect()
      return
    }
    if (quickPick.open) quickPick.onClose()
    else quickPick.onOpen()
  }

  return (
    // display: contents keeps this wrapper out of layout entirely — it exists
    // only so the popover (which must sit outside .slot's own overflow:hidden
    // to be visible) can still be found by the click-outside-closes check.
    <div ref={rootRef} style={{ display: 'contents' }}>
      <div
        className={classes}
        style={{
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          ...(rotationDeg ? { transform: `rotate(${rotationDeg}deg)` } : {}),
          ...(stampClipPath ? { clipPath: stampClipPath } : {}),
        }}
        onClick={handleClick}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const photoId = e.dataTransfer.getData('text/photo-id')
          if (photoId) onDropPhoto(photoId)
        }}
      >
        {poster && (
          <span
            className="poster-tape"
            style={{ background: placement?.attachmentColor ?? undefined }}
            aria-hidden="true"
          />
        )}
        {!poster && placement?.attachment && (
          <AttachmentGraphic type={placement.attachment} color={placement.attachmentColor} />
        )}
        {photo && geo ? (
          <img
            src={photoUrl(photo)}
            alt={photo.name}
            draggable={false}
            style={{
              left: inset + geo.x,
              top: inset + geo.y,
              width: geo.drawWidth,
              height: geo.drawHeight,
              filter: FILTER_CSS[forceFilter ?? placement?.filter ?? ''],
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          />
        ) : (
          <span className="slot-hint">Drop a photo</span>
        )}
      </div>

      {quickPick?.open && (
        <div
          className="quick-picker open"
          style={{ left: box.x, top: box.y + box.h + 6 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="quick-picker-title">
            Unplaced photos
            <button onClick={() => quickPick.onClose()} aria-label="Close">
              ×
            </button>
          </p>
          {quickPick.photos.length === 0 ? (
            <p className="quick-picker-empty">All photos are placed.</p>
          ) : (
            <div className="quick-picker-grid">
              {quickPick.photos.map((p) => (
                <button
                  key={p.id}
                  className="quick-picker-thumb"
                  onClick={() => quickPick.onPick(p.id)}
                  title={p.name}
                >
                  <img src={photoThumbUrl(p)} alt={p.name} draggable={false} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          <button className="quick-picker-more" onClick={() => quickPick.onOpenLibrary()}>
            Open full library →
          </button>
        </div>
      )}
    </div>
  )
}
