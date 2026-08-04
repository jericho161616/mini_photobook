import { MAX_ZOOM, MIN_ZOOM } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import type { PhotoFilter } from '../types'

const FILTERS: { id: PhotoFilter | 'none'; label: string }[] = [
  { id: 'none', label: 'Color' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
]

export function SlotInspector() {
  const pages = useStore((s) => s.pages)
  const photos = useStore((s) => s.photos)
  const selected = useStore((s) => s.selected)
  const updatePlacement = useStore((s) => s.updatePlacement)
  const clearSlot = useStore((s) => s.clearSlot)

  const selectedPage = selected ? pages[selected.pageIndex] : undefined
  const placement = selected
    ? selected.halfIndex !== undefined
      ? selectedPage?.halves?.[selected.halfIndex].placements[selected.slotIndex]
      : selectedPage?.placements[selected.slotIndex]
    : null
  const photo = placement ? photos.find((p) => p.id === placement.photoId) : undefined

  return (
    <section className="panel">
      <h2>Selected Photo</h2>

      {!selected ? (
        <p className="empty-note">Click a slot on the page to adjust the photo inside it.</p>
      ) : !placement || !photo ? (
        <p className="empty-note">
          This slot is empty. Drag a photo onto it, or click it for a quick picker of your
          unplaced photos.
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

          <div className="inspector-row">
            <label>Filter</label>
            <div className="filter-chips-row">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`filter-chip-btn${(placement.filter ?? 'none') === f.id ? ' active' : ''}`}
                  onClick={() => updatePlacement(selected, { filter: f.id === 'none' ? undefined : f.id })}
                  aria-pressed={(placement.filter ?? 'none') === f.id}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
          <p className="del-hint">
            or press <kbd>Delete</kbd> / <kbd>Backspace</kbd>
          </p>
        </>
      )}
    </section>
  )
}
