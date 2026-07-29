import { useEffect, useState } from 'react'
import { usedPhotoIds } from '../lib/autoLayout'
import { photoUrl } from '../lib/imageUtils'
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

  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const used = usedPhotoIds(pages)

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
                onClick={() => setSelected(new Set(photos.map((p) => p.id)))}
                disabled={photos.length === 0}
              >
                Select All
              </button>
            )}
            <button className="btn" onClick={onClose} aria-label="Close photo library">
              Close
            </button>
          </div>
        </div>

        {photos.length === 0 ? (
          <p className="empty-note">No photos yet.</p>
        ) : (
          <div className="library-grid">
            {photos.map((photo) => {
              const isSelected = selected.has(photo.id)
              return (
                <button
                  key={photo.id}
                  className={`library-thumb${isSelected ? ' selected' : ''}`}
                  onClick={() => toggle(photo.id)}
                  aria-pressed={isSelected}
                  title={photo.name}
                >
                  <img src={photoUrl(photo)} alt={photo.name} draggable={false} />
                  <span className="library-check" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                  {!used.has(photo.id) && <span className="library-unused">Unplaced</span>}
                  <span className="library-caption">
                    {photo.name}
                    <br />
                    <span className="mono">
                      {photo.width}×{photo.height}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
