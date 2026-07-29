import { Fragment, useEffect, useState } from 'react'
import { DEFAULT_SIZE_ID, SIZE_GROUPS, formatDims, sizeRatio } from '../data/sizes'

const GLYPH_MAX = 26

interface NewBookModalProps {
  onCreate: (title: string, sizeId: string) => void
  onClose: () => void
}

export function NewBookModal({ onCreate, onClose }: NewBookModalProps) {
  const [title, setTitle] = useState('')
  const [sizeId, setSizeId] = useState(DEFAULT_SIZE_ID)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canCreate = title.trim().length > 0

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="New book" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Book</h2>

        <div className="field">
          <label htmlFor="newBookTitle">Title</label>
          <input
            id="newBookTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Baguio Weekend"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) onCreate(title, sizeId)
            }}
          />
        </div>

        <div className="field">
          <label>Size</label>
          <div className="size-grid-mini">
            {SIZE_GROUPS.map((group) => (
              <Fragment key={group.label}>
                {group.sizes.map((size) => {
                  const ratio = sizeRatio(size)
                  const w = ratio >= 1 ? GLYPH_MAX : GLYPH_MAX * ratio
                  const h = ratio >= 1 ? GLYPH_MAX / ratio : GLYPH_MAX
                  return (
                    <button
                      key={size.id}
                      className={`size-swatch-mini${size.id === sizeId ? ' active' : ''}`}
                      onClick={() => setSizeId(size.id)}
                      title={`${size.name} — ${formatDims(size)}`}
                    >
                      <span className="shape" style={{ width: w, height: h }} />
                      <span>{size.name}</span>
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!canCreate} onClick={() => onCreate(title, sizeId)}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
