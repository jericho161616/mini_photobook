import { Fragment, useEffect, useState } from 'react'
import {
  BOOK_SIZE_GROUPS,
  DEFAULT_POST_SIZE_ID,
  DEFAULT_SIZE_ID,
  POST_SIZE_GROUPS,
  formatDims,
  formatPixels,
  getSize,
  sizeRatio,
} from '../data/sizes'

const GLYPH_MAX = 26

/**
 * What you're making, asked before anything else. It isn't stored on the
 * project — the size decides everything downstream — but asking first keeps
 * twenty-odd trims from landing on someone who wants one Instagram post.
 */
type Kind = 'book' | 'post'

interface NewBookModalProps {
  onCreate: (title: string, sizeId: string) => void
  onClose: () => void
}

export function NewBookModal({ onCreate, onClose }: NewBookModalProps) {
  const [kind, setKind] = useState<Kind | null>(null)
  const [title, setTitle] = useState('')
  const [sizeId, setSizeId] = useState(DEFAULT_SIZE_ID)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function pickKind(next: Kind) {
    setKind(next)
    setSizeId(next === 'post' ? DEFAULT_POST_SIZE_ID : DEFAULT_SIZE_ID)
  }

  if (kind === null) {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-label="New project" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>What are you making?</h2>

          <div className="kind-grid">
            <button className="kind-card" onClick={() => pickKind('book')} autoFocus>
              <span className="kind-art" aria-hidden="true">
                <span className="kind-book behind" />
                <span className="kind-book" />
              </span>
              <strong>Photobook</strong>
              <span>
                A bound book you lay out page by page and export as a print-ready PDF. Trims from 6×6 up
                to 14×11, plus A-series paper and folded cards.
              </span>
            </button>

            <button className="kind-card" onClick={() => pickKind('post')}>
              <span className="kind-art" aria-hidden="true">
                <span className="kind-slide third" />
                <span className="kind-slide second" />
                <span className="kind-slide" />
              </span>
              <strong>Social post</strong>
              <span>
                One slide or a carousel up to 20, at exact Instagram and Facebook pixel sizes. Exports as
                PNGs ready to upload.
              </span>
            </button>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isPost = kind === 'post'
  const groups = isPost ? POST_SIZE_GROUPS : BOOK_SIZE_GROUPS
  const canCreate = title.trim().length > 0

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isPost ? 'New social post' : 'New book'}
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isPost ? 'New Social Post' : 'New Book'}</h2>

        <div className="field">
          <label htmlFor="newBookTitle">Title</label>
          <input
            id="newBookTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPost ? 'e.g. Sagada in 5 Slides' : 'e.g. Baguio Weekend'}
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) onCreate(title, sizeId)
            }}
          />
        </div>

        <div className="field">
          <label>{isPost ? 'Format' : 'Size'}</label>
          <div className="size-grid-mini">
            {groups.map((group) => (
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
                      title={`${size.name} — ${size.social ? formatPixels(size) : formatDims(size)}`}
                    >
                      <span className="shape" style={{ width: w, height: h }} />
                      <span>{size.name}</span>
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
          {isPost && <p className="hint mono">{formatPixels(getSize(sizeId))}</p>}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => setKind(null)}>
            ← Back
          </button>
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
