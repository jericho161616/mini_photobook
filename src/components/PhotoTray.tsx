import { useMemo, useRef, useState } from 'react'
import { usedPhotoIds } from '../lib/autoLayout'
import { ACCEPTED_TYPES, photoThumbUrl } from '../lib/imageUtils'
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
  // A photo already placed on a page won't be dragged onto a second one, so
  // there's no reason for it to keep taking up room in the tray.
  const available = useMemo(() => photos.filter((p) => !used.has(p.id)), [photos, used])

  return (
    <section className="panel panel-grow">
      <h2>
        Photos
        <span className="count mono">{available.length} left</span>
      </h2>

      {photos.length === 0 ? (
        <p className="empty-note">
          No photos yet. Add some, then drag them onto a slot wherever you want them.
        </p>
      ) : available.length === 0 ? (
        <p className="empty-note">
          Every photo is placed. Add more, or open the library to swap one out.
        </p>
      ) : (
        <div className="photo-tray">
          {available.map((photo) => (
            <div
              key={photo.id}
              className="photo-thumb"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/photo-id', photo.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              title={photo.name}
            >
              <img
                src={photoThumbUrl(photo)}
                alt={photo.name}
                draggable={false}
                loading="lazy"
                decoding="async"
              />
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
      )}

      {photos.length > 0 && (
        <button className="btn expand-btn" onClick={() => setLibraryOpen(true)}>
          ⤢ View & manage all photos
        </button>
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
