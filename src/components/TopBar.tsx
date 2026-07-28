import { formatDims, getSize } from '../data/sizes'
import { capacityRange, suggestPageCount } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import { MAX_PAGES, MIN_PAGES } from '../types'

interface TopBarProps {
  onExport: () => void
  exporting: boolean
}

export function TopBar({ onExport, exporting }: TopBarProps) {
  const title = useStore((s) => s.title)
  const setTitle = useStore((s) => s.setTitle)
  const sizeId = useStore((s) => s.sizeId)
  const pages = useStore((s) => s.pages)
  const photos = useStore((s) => s.photos)
  const setPageCount = useStore((s) => s.setPageCount)
  const regenerate = useStore((s) => s.regenerate)

  const size = getSize(sizeId)
  const [, maxCapacity] = capacityRange(pages.length, size)
  const overflowing = photos.length > maxCapacity
  const suggestion = suggestPageCount(photos.length, size)

  return (
    <header className="topbar">
      <div className="brand">
        Folio <span>·</span> Editor
      </div>

      <input
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Book title"
        placeholder="Untitled Book"
      />

      <div className="topbar-group">
        <span className="meta-label">Size</span>
        <span className="meta-dims mono">{formatDims(size)}</span>
      </div>

      <div className="topbar-right">
        <div className="topbar-group page-control">
          <label className="meta-label" htmlFor="pageCount">
            Pages
          </label>
          <input
            id="pageCount"
            type="range"
            min={MIN_PAGES}
            max={MAX_PAGES}
            value={pages.length}
            onChange={(e) => setPageCount(Number(e.target.value))}
          />
          <span className="mono">{pages.length}</span>
        </div>

        <button
          className="btn"
          onClick={regenerate}
          disabled={photos.length === 0}
          title={
            overflowing
              ? `${photos.length} photos need about ${suggestion} pages at this size`
              : 'Lay the book out again from scratch'
          }
        >
          {overflowing ? `Re-flow (try ${suggestion} pages)` : 'Re-flow'}
        </button>

        <button className="btn-primary" onClick={onExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
    </header>
  )
}
