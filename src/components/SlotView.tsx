import { useRef, useState } from 'react'
import { coverGeometry, FRAME_INSET_RATIO, photoUrl, POSTER_BORDER_RATIO } from '../lib/imageUtils'
import type { Photo, Placement } from '../types'

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
  /** Taped-on-top styling for the Poster Overlay's second slot. */
  poster?: boolean
}

const FILTER_CSS: Record<string, string> = {
  bw: 'grayscale(1)',
  sepia: 'sepia(0.75) saturate(1.1)',
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
}: SlotViewProps) {
  const [dragOver, setDragOver] = useState(false)
  const [panning, setPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  // The photo itself may sit inside a decorative inset (a white mat for
  // Instant Grid, a border for the taped Poster Overlay photo) — computed in
  // JS rather than CSS padding, so it stays exact regardless of the
  // containing block, and matches exportPdf's math pixel for pixel.
  const inset = framed
    ? Math.min(rect.w, rect.h) * FRAME_INSET_RATIO
    : poster
      ? rect.w * POSTER_BORDER_RATIO
      : 0
  const photoBox = { w: rect.w - inset * 2, h: rect.h - inset * 2 }

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
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      onClick={onSelect}
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
      {poster && <span className="poster-tape" aria-hidden="true" />}
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
            filter: placement?.filter ? FILTER_CSS[placement.filter] : undefined,
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
  )
}
