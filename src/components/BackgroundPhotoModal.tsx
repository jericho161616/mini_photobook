import { useEffect } from 'react'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import { Icon } from './Icon'

interface BackgroundPhotoModalProps {
  pageIndex: number
  onClose: () => void
}

/**
 * Every photo at full library size, opened from the Decorate panel's
 * "Choose photo" section — the sidebar grid is too narrow to tell photos
 * apart at a glance, so this gives the same picker room to breathe.
 */
export function BackgroundPhotoModal({ pageIndex, onClose }: BackgroundPhotoModalProps) {
  const photos = useStore((s) => s.photos)
  const page = useStore((s) => s.pages[pageIndex])
  const setPageBackgroundPhoto = useStore((s) => s.setPageBackgroundPhoto)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose background photo" onClick={onClose}>
      <div className="library-card" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2 className="library-title">
            Choose background photo <span className="count mono">{photos.length}</span>
          </h2>
          <div className="library-actions">
            <button className="btn" onClick={onClose} aria-label="Close photo picker">
              Close
            </button>
          </div>
        </div>

        {photos.length === 0 ? (
          <p className="empty-note">No photos yet.</p>
        ) : (
          <div className="library-grid">
            {photos.map((photo) => {
              const isActive = page?.backgroundPhotoId === photo.id
              return (
                <button
                  key={photo.id}
                  className={`library-thumb${isActive ? ' selected' : ''}`}
                  onClick={() => {
                    setPageBackgroundPhoto(pageIndex, photo.id)
                    onClose()
                  }}
                  aria-pressed={isActive}
                  title={photo.name}
                >
                  <div className="library-thumb-frame">
                    <img src={photoThumbUrl(photo)} alt={photo.name} draggable={false} loading="lazy" decoding="async" />
                    {isActive && (
                      <span className="library-check" aria-hidden="true">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                    <span className="library-caption">{photo.name}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
