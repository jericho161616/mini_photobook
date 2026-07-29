import { Fragment, useEffect } from 'react'
import { SIZE_GROUPS, formatDims, sizeRatio } from '../data/sizes'
import { useStore } from '../state/useStore'

const GLYPH_MAX = 34

interface SizePickerModalProps {
  onClose: () => void
}

/**
 * The full size grid, opened deliberately rather than sitting in the sidebar
 * all the time — the book's trim is usually a one-time decision, so keeping
 * it always on screen only ate space that photos and layout controls need.
 */
export function SizePickerModal({ onClose }: SizePickerModalProps) {
  const sizeId = useStore((s) => s.sizeId)
  const setSize = useStore((s) => s.setSize)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Choose book size"
      onClick={onClose}
    >
      <div className="library-card size-picker-card" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2 className="library-title">Book Size</h2>
          <div className="library-actions">
            <button className="btn" onClick={onClose} aria-label="Close size picker">
              Close
            </button>
          </div>
        </div>

        <p className="hint">
          Changing size re-fits any page whose layout no longer suits the new trim. Locked pages are
          left as they are.
        </p>

        <div className="size-grid size-grid-modal">
          {SIZE_GROUPS.map((group) => (
            <Fragment key={group.label}>
              <div className="family-label">{group.label}</div>
              {group.sizes.map((size) => {
                const ratio = sizeRatio(size)
                const w = ratio >= 1 ? GLYPH_MAX : GLYPH_MAX * ratio
                const h = ratio >= 1 ? GLYPH_MAX / ratio : GLYPH_MAX
                return (
                  <button
                    key={size.id}
                    className={`size-swatch${size.id === sizeId ? ' active' : ''}`}
                    onClick={() => {
                      setSize(size.id)
                      onClose()
                    }}
                    aria-pressed={size.id === sizeId}
                  >
                    <span className="shape" style={{ width: w, height: h }} />
                    <span className="name">{size.name}</span>
                    <span className="dims mono">{formatDims(size)}</span>
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
