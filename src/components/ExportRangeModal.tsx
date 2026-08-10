import { useEffect, useState } from 'react'

interface ExportRangeModalProps {
  pageCount: number
  /** 'page' in a book, 'slide' in a social post — the same range, named for what it holds. */
  unit?: 'page' | 'slide'
  onClose: () => void
  onExport: (fromIndex: number, toIndex: number) => void
}

/**
 * Lets the export cover just a stretch of the book (e.g. pages 5-18) instead
 * of always rendering every page — useful for a proof of one section, or a
 * reprint of only the pages that changed. Defaults to the whole book.
 *
 * On a social post it does the same job for a different reason: re-exporting
 * only the slides you've changed since the last upload.
 */
export function ExportRangeModal({ pageCount, unit = 'page', onClose, onExport }: ExportRangeModalProps) {
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(pageCount)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const clamp = (n: number) => Math.max(1, Math.min(pageCount, Math.round(n) || 1))
  const validRange = from <= to
  const units = `${unit}s`

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Choose ${units} to export`}
      onClick={onClose}
    >
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <p>Export which {units}?</p>
        <div className="export-range-row">
          <label>
            From
            <input
              type="number"
              className="export-range-input mono"
              min={1}
              max={pageCount}
              value={from}
              onChange={(e) => setFrom(clamp(Number(e.target.value)))}
            />
          </label>
          <span className="export-range-dash">–</span>
          <label>
            To
            <input
              type="number"
              className="export-range-input mono"
              min={1}
              max={pageCount}
              value={to}
              onChange={(e) => setTo(clamp(Number(e.target.value)))}
            />
          </label>
          <span className="hint mono">of {pageCount}</span>
        </div>
        {!validRange && <p className="hint warn">"From" can't be after "To".</p>}
        <div className="slot-controls">
          <button className="btn" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button className="btn" onClick={() => onExport(0, pageCount - 1)}>
            Export all {pageCount} {pageCount === 1 ? unit : units}
          </button>
          <button className="btn-primary" onClick={() => onExport(from - 1, to - 1)} disabled={!validRange}>
            Export {units} {from}–{to}
          </button>
        </div>
      </div>
    </div>
  )
}
