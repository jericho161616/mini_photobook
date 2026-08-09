import { useEffect, useRef, useState } from 'react'
import { formatDims, getSize } from '../data/sizes'
import { capacityRange, minPageCount, sizeMinPages, suggestPageCount } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import { MAX_PAGES } from '../types'
import { ResetConfirm } from './ResetConfirm'

interface TopBarProps {
  onExport: () => void
  exporting: boolean
  onPreview: () => void
  previewing: boolean
  onPlay: () => void
  onGoToLibrary: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function TopBar({
  onExport,
  exporting,
  onPreview,
  previewing,
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
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.undoStack.length > 0)
  const canRedo = useStore((s) => s.redoStack.length > 0)
  const [confirmingReset, setConfirmingReset] = useState(false)
  // Reset and Preview Book are occasional — tucked behind "More" so the bar
  // isn't ten controls all shouting equally loudly.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const size = getSize(sizeId)
  const [, maxCapacity] = capacityRange(pages.length, size)
  const overflowing = photos.length > maxCapacity
  const suggestion = suggestPageCount(photos.length, size)

  const minCount = minPageCount(pages, size)
  // minPageCount only rises above the book's own absolute floor when a
  // locked page is holding it there.
  const blockedByLock = pages.length <= minCount && minCount > sizeMinPages(size)
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

      <div className="topbar-group">
        <button
          className="btn"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          ↺
        </button>
        <button
          className="btn"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↻
        </button>
      </div>

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

        <div className="topbar-more" ref={moreRef}>
          <button
            className="btn"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label="More actions"
            title="More actions"
          >
            ⋯
          </button>
          {moreOpen && (
            <div className="topbar-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false)
                  onPreview()
                }}
                disabled={previewing || pages.length === 0}
                title="Download an image showing every page's spot in the book, in order"
              >
                {previewing ? 'Rendering…' : '⊞ Preview whole book'}
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMoreOpen(false)
                  setConfirmingReset(true)
                }}
                title="Delete every photo and page, and start a new book"
              >
                Reset book…
              </button>
            </div>
          )}
        </div>

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
