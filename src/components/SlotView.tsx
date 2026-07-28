import { useRef, useState } from 'react'
import { coverGeometry, photoUrl } from '../lib/imageUtils'
import type { Photo, Placement } from '../types'

interface SlotViewProps {
  rect: { x: number; y: number; w: number; h: number }
  placement: Placement | null
  photo: Photo | undefined
  selected: boolean
  onSelect: () => void
  onDropPhoto: (photoId: string) => void
  onPan: (offsetX: number, offsetY: number) => void
}

export function SlotView({
  rect,
  placement,
  photo,
  selected,
  onSelect,
  onDropPhoto,
  onPan,
}: SlotViewProps) {
  const [dragOver, setDragOver] = useState(false)
  const [panning, setPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const geo =
    photo && placement
      ? coverGeometry(photo.width / photo.height, rect.w, rect.h, placement)
      : null

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
      {photo && geo ? (
        <img
          src={photoUrl(photo)}
          alt={photo.name}
          draggable={false}
          style={{
            left: geo.x,
            top: geo.y,
            width: geo.drawWidth,
            height: geo.drawHeight,
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
