import { useEffect, useState } from 'react'
import { usedPhotoIds } from '../lib/autoLayout'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'

interface PhotoLibraryProps {
  onClose: () => void
}

/**
 * Full-size view of every imported photo. Opened from the tray's "Expand"
 * button when the sidebar thumbnails are too small to tell photos apart —
 * also where multiple photos can be checked off and removed at once.
 */
export function PhotoLibrary({ onClose }: PhotoLibraryProps) {
  const photos = useStore((s) => s.photos)
  const pages = useStore((s) => s.pages)
  const removePhotos = useStore((s) => s.removePhotos)
  const armPhoto = useStore((s) => s.armPhoto)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'placed' | 'unplaced'>('all')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const used = usedPhotoIds(pages)
  const visiblePhotos = photos.filter((p) => {
    if (filter === 'placed') return used.has(p.id)
    if (filter === 'unplaced') return !used.has(p.id)
    return true
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function removeSelected() {
    const ids = [...selected]
    setSelected(new Set())
    await removePhotos(ids)
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Photo library" onClick={onClose}>
      <div className="library-card" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2 className="library-title">
            Photos <span className="count mono">{photos.length}</span>
          </h2>
          <div className="library-actions">
            {selected.size > 0 ? (
              <>
                <span className="hint">{selected.size} selected</span>
                <button className="btn" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
                <button className="btn btn-danger" onClick={() => void removeSelected()}>
                  Remove {selected.size}
                </button>
              </>
            ) : (
              <button
                className="btn"
                onClick={() => setSelected(new Set(visiblePhotos.map((p) => p.id)))}
                disabled={visiblePhotos.length === 0}
              >
                Select All
              </button>
            )}
            <button className="btn" onClick={onClose} aria-label="Close photo library">
              Close
            </button>
          </div>
        </div>

        <div className="filter-chips-row library-filter-row">
          <button
            className={`filter-chip-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All {photos.length}
          </button>
          <button
            className={`filter-chip-btn${filter === 'placed' ? ' active' : ''}`}
            onClick={() => setFilter('placed')}
          >
            Placed {photos.filter((p) => used.has(p.id)).length}
          </button>
          <button
            className={`filter-chip-btn${filter === 'unplaced' ? ' active' : ''}`}
            onClick={() => setFilter('unplaced')}
          >
            Unplaced {photos.filter((p) => !used.has(p.id)).length}
          </button>
        </div>

        {photos.length === 0 ? (
          <p className="empty-note">No photos yet.</p>
        ) : visiblePhotos.length === 0 ? (
          <p className="empty-note">No {filter} photos.</p>
        ) : (
          <div className="library-grid">
            {visiblePhotos.map((photo) => {
              const isSelected = selected.has(photo.id)
              return (
                <div
                  key={photo.id}
                  role="button"
                  tabIndex={0}
                  className={`library-thumb${isSelected ? ' selected' : ''}`}
                  onClick={() => toggle(photo.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(photo.id)
                    }
                  }}
                  aria-pressed={isSelected}
                  title={photo.name}
                >
                  <div className="library-thumb-frame">
                    <img
                      src={photoThumbUrl(photo)}
                      alt={photo.name}
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="library-check" aria-hidden="true">
                      {isSelected ? '✓' : ''}
                    </span>
                    {!used.has(photo.id) && <span className="library-unused">Unplaced</span>}
                    <button
                      className="library-place-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        armPhoto(photo.id)
                        onClose()
                      }}
                      title="Pick up this photo — click a slot on the page to place it"
                    >
                      ✋ Place
                    </button>
                    <span className="library-caption">
                      {photo.name}
                      <br />
                      <span className="mono">
                        {photo.width}×{photo.height}
                      </span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
