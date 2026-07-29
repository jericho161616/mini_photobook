import { useState } from 'react'
import { formatDims, getSize } from '../data/sizes'
import { capacityRange, minPageCount, suggestPageCount } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import { MAX_PAGES, MIN_PAGES } from '../types'
import { ResetConfirm } from './ResetConfirm'

interface TopBarProps {
  onExport: () => void
  exporting: boolean
  onPlay: () => void
  onGoToLibrary: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function TopBar({
  onExport,
  exporting,
  onPlay,
  onGoToLibrary,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const title = useStore((s) => s.title)
  const setTitle = useStore((s) => s.setTitle)
  const sizeId = useStore((s) => s.sizeId)
  const pages = useStore((s) => s.pages)
  const photos = useStore((s) => s.photos)
  const setPageCount = useStore((s) => s.setPageCount)
  const regenerate = useStore((s) => s.regenerate)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const size = getSize(sizeId)
  const [, maxCapacity] = capacityRange(pages.length, size)
  const overflowing = photos.length > maxCapacity
  const suggestion = suggestPageCount(photos.length, size)

  const minCount = minPageCount(pages)
  // minPageCount only rises above the book's absolute floor when a locked
  // page is holding it there.
  const blockedByLock = pages.length <= minCount && minCount > MIN_PAGES
  const canDecrease = pages.length > minCount
  const canIncrease = pages.length < MAX_PAGES

  return (
    <header className="topbar">
      <button className="brand brand-link" onClick={onGoToLibrary} title="Back to My Books">
        Moments <span>·</span> Editor
      </button>

      <input
        className="title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Book title"
        placeholder="Untitled Book"
      />

      <button
        className="btn btn-quiet"
        onClick={() => setConfirmingReset(true)}
        title="Delete every photo and page, and start a new book"
      >
        Reset
      </button>

      <div className="topbar-group">
        <span className="meta-label">Size</span>
        <span className="meta-dims mono">{formatDims(size)}</span>
      </div>

      <div className="topbar-right">
        <div className="topbar-group page-control">
          <span className="meta-label">Pages</span>
          <button
            className="btn page-step"
            onClick={() => setPageCount(pages.length - 1)}
            disabled={!canDecrease}
            aria-label="Remove a page"
            title={
              blockedByLock
                ? `Page ${minCount} is locked — unlock it to remove more pages`
                : !canDecrease
                  ? `Minimum is ${minCount} pages`
                  : 'Remove a page'
            }
          >
            −
          </button>
          <span className="mono page-count">{pages.length}</span>
          <button
            className="btn page-step"
            onClick={() => setPageCount(pages.length + 1)}
            disabled={!canIncrease}
            aria-label="Add a page"
            title={canIncrease ? 'Add a page' : `Maximum is ${MAX_PAGES} pages`}
          >
            +
          </button>
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

        <button
          className="btn"
          onClick={onPlay}
          disabled={pages.length === 0}
          title="Play through the book as a slideshow"
        >
          ▶ Play
        </button>

        <button className="btn-primary" onClick={onExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>

        <button
          className="btn theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      {confirmingReset && <ResetConfirm onClose={() => setConfirmingReset(false)} />}
    </header>
  )
}
