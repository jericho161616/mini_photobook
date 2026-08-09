import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSize } from '../data/sizes'
import { exportBookOverview, exportToPdf } from '../lib/exportPdf'
import type { ThemeChoice } from '../lib/theme'
import { useStore } from '../state/useStore'
import { ContextualToolbar } from './ContextualToolbar'
import { ExportRangeModal } from './ExportRangeModal'
import { Filmstrip } from './Filmstrip'
import { PhotoLibrary } from './PhotoLibrary'
import { PhotoTray } from './PhotoTray'
import { RightSidebarTabs } from './RightSidebarTabs'
import { SizePanel } from './SizePanel'
import { Slideshow } from './Slideshow'
import { SpreadCanvas } from './SpreadCanvas'
import { TopBar } from './TopBar'

interface EditorProps {
  projectId: string
  onGoToLibrary: () => void
  theme: ThemeChoice
  onToggleTheme: () => void
}

export function Editor({ projectId, onGoToLibrary, theme, onToggleTheme }: EditorProps) {
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)
  const flushPending = useStore((s) => s.flushPending)
  const photos = useStore((s) => s.photos)
  const customStickers = useStore((s) => s.customStickers)
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const title = useStore((s) => s.title)
  const setActivePage = useStore((s) => s.setActivePage)
  const activePageIndex = useStore((s) => s.activePageIndex)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [exportRangeOpen, setExportRangeOpen] = useState(false)

  useEffect(() => {
    void init(projectId)
  }, [init, projectId])

  // Slot and filmstrip lookups are by id, so build the index once per change.
  const photoMap = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === 'ArrowLeft') setActivePage(activePageIndex - 1)
      if (e.key === 'ArrowRight') setActivePage(activePageIndex + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activePageIndex, setActivePage])

  const handleExport = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const pagesToExport = pages.slice(fromIndex, toIndex + 1)
      setExporting(true)
      setError(null)
      setProgress({ done: 0, total: pagesToExport.length })
      try {
        await exportToPdf({
          pages: pagesToExport,
          photos,
          customStickers,
          size: getSize(sizeId),
          title,
          onProgress: (done, total) => setProgress({ done, total }),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed')
      } finally {
        setExporting(false)
      }
    },
    [pages, photos, customStickers, sizeId, title],
  )

  const handlePreview = useCallback(async () => {
    setPreviewing(true)
    setError(null)
    try {
      await exportBookOverview({ pages, photos, customStickers, size: getSize(sizeId), title })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }, [pages, photos, customStickers, sizeId, title])

  if (!ready) {
    return (
      <div className="app">
        <p className="empty-note">Opening your book…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar
        onExport={() => setExportRangeOpen(true)}
        exporting={exporting}
        onPreview={handlePreview}
        previewing={previewing}
        onPlay={() => setSlideshowOpen(true)}
        onGoToLibrary={() => {
          flushPending()
          onGoToLibrary()
        }}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {error && (
        <p className="hint warn" role="alert">
          {error}
        </p>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <SizePanel />
          <PhotoTray onOpenLibrary={() => setLibraryOpen(true)} />
        </aside>

        <SpreadCanvas photos={photoMap} onOpenLibrary={() => setLibraryOpen(true)} />

        <RightSidebarTabs />
      </div>

      <Filmstrip photos={photoMap} />

      {/* Floats over the canvas next to whatever is selected — renders nothing at all otherwise. */}
      <ContextualToolbar />

      {libraryOpen && <PhotoLibrary onClose={() => setLibraryOpen(false)} />}

      {exportRangeOpen && (
        <ExportRangeModal
          pageCount={pages.length}
          onClose={() => setExportRangeOpen(false)}
          onExport={(fromIndex, toIndex) => {
            setExportRangeOpen(false)
            void handleExport(fromIndex, toIndex)
          }}
        />
      )}

      {slideshowOpen && (
        <Slideshow
          pages={pages}
          photos={photoMap}
          size={getSize(sizeId)}
          title={title}
          startIndex={activePageIndex}
          onClose={() => setSlideshowOpen(false)}
        />
      )}

      {exporting && (
        <div className="overlay" role="status" aria-live="polite">
          <div className="overlay-card">
            <p>
              Rendering page <span className="mono">{progress.done}</span> of{' '}
              <span className="mono">{progress.total}</span> at 300 DPI
            </p>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
