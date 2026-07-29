import { useRef, useState } from 'react'
import { usedPhotoIds } from '../lib/autoLayout'
import { ACCEPTED_TYPES, photoUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import { PhotoLibrary } from './PhotoLibrary'

export function PhotoTray() {
  const photos = useStore((s) => s.photos)
  const pages = useStore((s) => s.pages)
  const addFiles = useStore((s) => s.addFiles)
  const removePhoto = useStore((s) => s.removePhoto)
  const importing = useStore((s) => s.importing)

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const used = usedPhotoIds(pages)
  const placedCount = photos.filter((p) => used.has(p.id)).length

  return (
    <section className="panel">
      <h2>
        Photos
        <span className="count mono">
          {placedCount}/{photos.length}
        </span>
      </h2>

      {photos.length === 0 ? (
        <p className="empty-note">
          No photos yet. Add some and the book lays itself out — you can rearrange from there.
        </p>
      ) : (
        <>
          <div className="photo-tray">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`photo-thumb${used.has(photo.id) ? ' used' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/photo-id', photo.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                title={photo.name}
              >
                <img src={photoUrl(photo)} alt={photo.name} draggable={false} />
                <button
                  className="remove"
                  onClick={() => void removePhoto(photo.id)}
                  aria-label={`Remove ${photo.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button className="btn expand-btn" onClick={() => setLibraryOpen(true)}>
            ⤢ View & manage all photos
          </button>
        </>
      )}

      <button
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addFiles(Array.from(e.dataTransfer.files))
        }}
        disabled={importing}
      >
        {importing ? 'Reading photos…' : '+ Add photos or drop them here'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        hidden
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {libraryOpen && <PhotoLibrary onClose={() => setLibraryOpen(false)} />}
    </section>
  )
}
