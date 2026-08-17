import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSize } from '../data/sizes'
import { exportBookOverview, exportToPdf } from '../lib/exportPdf'
import type { ThemeChoice } from '../lib/theme'
import { useStore } from '../state/useStore'
import { ContextualToolbar } from './ContextualToolbar'
import { EditorDrawer } from './EditorDrawer'
import { EditorRail, type RailSection } from './EditorRail'
import { ExportRangeModal } from './ExportRangeModal'
import { Filmstrip } from './Filmstrip'
import { PhotoLibrary } from './PhotoLibrary'
import { Slideshow } from './Slideshow'
import { SpreadCanvas } from './SpreadCanvas'
import { TopBar } from './TopBar'

/** Remembered across sessions: whoever closes the panel to get room usually wants it to stay closed. */
const DRAWER_OPEN_KEY = 'moments.drawerOpen'

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
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [exportRangeOpen, setExportRangeOpen] = useState(false)
  const [railSection, setRailSection] = useState<RailSection>('photos')
  const [drawerOpen, setDrawerOpen] = useState(
    () => localStorage.getItem(DRAWER_OPEN_KEY) !== 'false',
  )

  useEffect(() => {
    localStorage.setItem(DRAWER_OPEN_KEY, String(drawerOpen))
  }, [drawerOpen])

  /**
   * Focus mode: entering full screen also gets the drawer out of the way, so
   * the page actually grows rather than the window just losing its browser
   * chrome around the same layout. Leaving restores whatever the drawer was
   * before, since collapsing it was our idea rather than the user's.
   *
   * Driven off fullscreenchange rather than the button's own click: Escape,
   * F11 and the browser's own overlay all exit without telling us, and the
   * drawer has to come back for those too.
   */
  // Read inside the listener below without making it re-subscribe on every
  // drawer toggle, which would lose the remembered state.
  const drawerOpenRef = useRef(drawerOpen)
  drawerOpenRef.current = drawerOpen

  const drawerBeforeFocus = useRef<boolean | null>(null)
  useEffect(() => {
    function onChange() {
      if (document.fullscreenElement) {
        // Guard against repeat events — the first one holds the real state.
        if (drawerBeforeFocus.current === null) {
          drawerBeforeFocus.current = drawerOpenRef.current
          setDrawerOpen(false)
        }
      } else if (drawerBeforeFocus.current !== null) {
        setDrawerOpen(drawerBeforeFocus.current)
        drawerBeforeFocus.current = null
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])


  // Selecting a photo slot turns the drawer into that photo's controls — the
  // panel is never a dead end telling you to go click something.
  const showingSelectedPhoto = selected !== null

  function pickSection(section: RailSection) {
    // Clicking the section already showing collapses the drawer, the usual
    // rail-and-drawer behaviour.
    if (section === railSection && drawerOpen && !showingSelectedPhoto) {
      setDrawerOpen(false)
      return
    }
    // Asking for a section while a photo is selected means you're done with
    // that photo — otherwise the drawer would stay on its controls and the
    // rail click would look ignored.
    select(null)
    setRailSection(section)
    setDrawerOpen(true)
  }

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
        <EditorRail active={railSection} open={drawerOpen && !showingSelectedPhoto} onPick={pickSection} />

        <EditorDrawer
          section={railSection}
          open={drawerOpen}
          showingSelectedPhoto={showingSelectedPhoto}
          onOpenLibrary={() => setLibraryOpen(true)}
          onCollapse={() => setDrawerOpen(false)}
        />

        <SpreadCanvas photos={photoMap} onOpenLibrary={() => setLibraryOpen(true)} />
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
