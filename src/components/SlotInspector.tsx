import { MAX_ZOOM, MIN_ZOOM } from '../lib/imageUtils'
import { useStore } from '../state/useStore'

export function SlotInspector() {
  const pages = useStore((s) => s.pages)
  const photos = useStore((s) => s.photos)
  const selected = useStore((s) => s.selected)
  const updatePlacement = useStore((s) => s.updatePlacement)
  const clearSlot = useStore((s) => s.clearSlot)

  const placement = selected ? pages[selected.pageIndex]?.placements[selected.slotIndex] : null
  const photo = placement ? photos.find((p) => p.id === placement.photoId) : undefined

  return (
    <section className="panel">
      <h2>Selected Photo</h2>

      {!selected ? (
        <p className="empty-note">Click a slot on the page to adjust the photo inside it.</p>
      ) : !placement || !photo ? (
        <p className="empty-note">
          This slot is empty. Drag a photo from the tray onto it.
        </p>
      ) : (
        <>
          <p className="hint" title={photo.name}>
            {photo.name.length > 28 ? `${photo.name.slice(0, 26)}…` : photo.name}
            <br />
            <span className="mono">
              {photo.width}×{photo.height}
            </span>
          </p>

          <div className="inspector-row">
            <label htmlFor="zoom">Zoom</label>
            <input
              id="zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={placement.zoom}
              onChange={(e) => updatePlacement(selected, { zoom: Number(e.target.value) })}
            />
            <span className="value mono">{placement.zoom.toFixed(2)}×</span>
          </div>

          <div className="slot-controls">
            <button
              className="btn"
              onClick={() => updatePlacement(selected, { zoom: 1, offsetX: 0, offsetY: 0 })}
            >
              Recenter
            </button>
            <button className="btn" onClick={() => clearSlot(selected)}>
              Remove
            </button>
          </div>
        </>
      )}
    </section>
  )
}
