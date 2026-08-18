import { useEffect, useMemo, useRef, useState } from 'react'
import { a4FamilyOptions, foldOrientationForSize, getSize, sizeRatio } from '../data/sizes'
import { resolvePageSize, usedPhotoIds } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { Page, Photo } from '../types'
import { PageView } from './PageView'
import { Icon } from './Icon'

/** How many unplaced photos the quick picker offers before pointing at the full library. */
const QUICK_PICK_COUNT = 6

/** Frame around the single page: padding, the nav arrows, and breathing room. */
const PAGE_CHROME_X = 120
const PAGE_CHROME_Y = 72
const MAX_PAGE_WIDTH = 720

interface SpreadCanvasProps {
  /** Editor-only drawing aids. Never reach the export — they aren't part of the book. */
  showGrid?: boolean
  showRulers?: boolean
  photos: Map<string, Photo>
  onOpenLibrary: () => void
}

/**
 * Shows exactly one page at a time, filling as much of the canvas as it can,
 * rather than pairing pages up like an open book — a two-up spread mostly
 * wasted space (a blank placeholder next to a lone opening page, or dead air
 * below a short, wide A4 Folded sheet) without actually helping you work on
 * either page faster. The ‹ › arrows (and the filmstrip below) move between
 * pages one at a time; you never see two at once.
 */
export function SpreadCanvas({ photos, onOpenLibrary, showGrid, showRulers }: SpreadCanvasProps) {
  const allPhotos = useStore((s) => s.photos)
  const customStickers = useStore((s) => s.customStickers)
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const setActivePage = useStore((s) => s.setActivePage)
  const title = useStore((s) => s.title)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const assignPhoto = useStore((s) => s.assignPhoto)
  const armedPhotoIds = useStore((s) => s.armedPhotoIds)
  const armPhoto = useStore((s) => s.armPhoto)
  const placeArmedPhoto = useStore((s) => s.placeArmedPhoto)
  const clearSlot = useStore((s) => s.clearSlot)
  const updatePlacement = useStore((s) => s.updatePlacement)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const togglePageLock = useStore((s) => s.togglePageLock)
  const setPageSize = useStore((s) => s.setPageSize)
  const selectedDecoration = useStore((s) => s.selectedDecoration)
  const selectDecoration = useStore((s) => s.selectDecoration)
  const updateSticker = useStore((s) => s.updateSticker)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const removeDecoration = useStore((s) => s.removeDecoration)

  const size = getSize(sizeId)

  // Which empty slot's quick picker is open, if any — identified by a string
  // key rather than a SlotRef so it's trivial to compare across renders.
  const [quickPickKey, setQuickPickKey] = useState<string | null>(null)
  const unplacedPhotos = useMemo(() => {
    const used = usedPhotoIds(pages)
    return allPhotos
      .filter((p) => !used.has(p.id))
      .slice(-QUICK_PICK_COUNT)
      .reverse()
  }, [allPhotos, pages])

  // The page should use whatever room the window gives it, so a tall book
  // isn't shown at postage-stamp size just because a wide one fits differently.
  const areaRef = useRef<HTMLElement>(null)
  const [area, setArea] = useState({ width: 800, height: 520 })

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setArea({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (armedPhotoIds.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') armPhoto(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armedPhotoIds.length, armPhoto])

  useEffect(() => {
    if (!quickPickKey) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setQuickPickKey(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [quickPickKey])

  // Picking up a photo to place by hand takes priority over the picker —
  // don't leave both open at once.
  useEffect(() => {
    if (armedPhotoIds.length > 0) setQuickPickKey(null)
  }, [armedPhotoIds.length])

  useEffect(() => {
    if (!selected) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const target = e.target as HTMLElement | null
      if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return
      const ref = selected as NonNullable<typeof selected>
      const page = pages[ref.pageIndex]
      const placement =
        ref.halfIndex !== undefined && page?.halves
          ? page.halves[ref.halfIndex].placements[ref.slotIndex]
          : page?.placements[ref.slotIndex]
      if (!placement) return
      e.preventDefault()
      clearSlot(ref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, pages, clearSlot])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (!mod || (key !== 'z' && key !== 'y')) return
      // Let a text input's own native undo (title, notes) handle Ctrl+Z there instead.
      const target = e.target as HTMLElement | null
      if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return
      e.preventDefault()
      if (key === 'y' || (key === 'z' && e.shiftKey)) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const page: Page | undefined = pages[activePageIndex]
  const pageSize = page ? resolvePageSize(page, size) : size

  const dims = useMemo(() => {
    const availableW = Math.max(160, area.width - PAGE_CHROME_X)
    const availableH = Math.max(160, area.height - PAGE_CHROME_Y)
    const ratio = sizeRatio(pageSize)
    const width = Math.min(MAX_PAGE_WIDTH, availableW, availableH * ratio)
    return { width, height: width / ratio }
  }, [area, pageSize])

  const foldOrientation = foldOrientationForSize(pageSize.id)
  const familyOptions = a4FamilyOptions(pageSize.id)
  const sizePicker = familyOptions
    ? {
        options: familyOptions,
        value: pageSize.id,
        onChange: (nextSizeId: string) => setPageSize(activePageIndex, nextSizeId),
      }
    : undefined

  const canPrev = activePageIndex > 0
  const canNext = activePageIndex < pages.length - 1

  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!zoomed) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setZoomed(false)
        return
      }
      // Paging without leaving full screen — the whole point of opening it is
      // to look at pages closely, and that rarely means just the one.
      if (e.key === 'ArrowLeft' && canPrev) setActivePage(activePageIndex - 1)
      if (e.key === 'ArrowRight' && canNext) setActivePage(activePageIndex + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed, canPrev, canNext, activePageIndex, setActivePage])

  // Everything a PageView needs besides its own size and whether it can open
  // the zoom overlay — shared between the normal view and the zoomed-in one
  // so the same page stays fully interactive (pan, select, drop) at any size.
  const pageViewProps = (allowFullscreen: boolean) => ({
    page,
    pageIndex: activePageIndex,
    photos,
    customStickers,
    side: 'single' as const,
    title,
    selectedSlot: selected?.pageIndex === activePageIndex ? selected.slotIndex : null,
    selectedHalfIndex: selected?.pageIndex === activePageIndex ? selected.halfIndex : undefined,
    onSelectSlot: (slotIndex: number, halfIndex?: 0 | 1) =>
      armedPhotoIds.length > 0
        ? placeArmedPhoto({ pageIndex: activePageIndex, slotIndex, halfIndex })
        : select({ pageIndex: activePageIndex, slotIndex, halfIndex }),
    onDropPhoto: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) =>
      assignPhoto({ pageIndex: activePageIndex, slotIndex, halfIndex }, photoId),
    onPan: (slotIndex: number, offsetX: number, offsetY: number, halfIndex?: 0 | 1) =>
      updatePlacement({ pageIndex: activePageIndex, slotIndex, halfIndex }, { offsetX, offsetY }),
    onToggleLock: () => togglePageLock(activePageIndex),
    onFullscreen: allowFullscreen ? () => setZoomed(true) : undefined,
    sizePicker,
    foldOrientation,
    hasArmedPhoto: armedPhotoIds.length > 0,
    quickPick: {
      openKey: quickPickKey,
      keyFor: (slotIndex: number, halfIndex?: 0 | 1) => `${activePageIndex}:${halfIndex ?? 'p'}:${slotIndex}`,
      photos: unplacedPhotos,
      onOpen: (key: string) => setQuickPickKey(key),
      onClose: () => setQuickPickKey(null),
      onPick: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) => {
        assignPhoto({ pageIndex: activePageIndex, slotIndex, halfIndex }, photoId)
        setQuickPickKey(null)
      },
      onOpenLibrary: () => {
        setQuickPickKey(null)
        onOpenLibrary()
      },
    },
    decorations: {
      selected: selectedDecoration,
      onSelect: selectDecoration,
      onChangeSticker: updateSticker,
      onChangeTextBox: updateTextBox,
      onDelete: removeDecoration,
    },
  })

  // Sized to fit comfortably inside the viewport rather than the canvas's
  // own available space, preserving the page's own aspect ratio.
  const zoomDims = useMemo(() => {
    if (!zoomed) return null
    const ratio = sizeRatio(pageSize)
    const maxW = window.innerWidth * 0.86
    const maxH = window.innerHeight * 0.86
    const width = Math.min(maxW, maxH * ratio)
    return { width, height: width / ratio }
  }, [zoomed, pageSize])

  /**
   * Clicking bare canvas — not a slot, a decoration, or any control — clears
   * the selection. Matters more than it used to now that a selection also puts
   * a floating toolbar on screen: without this there'd be no way to dismiss it
   * short of selecting something else.
   */
  function clearSelectionOnBackdrop(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('.slot, .decoration, button, input, select, textarea, [contenteditable="true"]')) return
    select(null)
    selectDecoration(null)
  }

  return (
    <main
      className={`canvas-area${armedPhotoIds.length > 0 ? ' armed' : ''}`}
      ref={areaRef}
      onMouseDown={clearSelectionOnBackdrop}
    >
      <div className="page-row">
        <button
          className="page-nav prev"
          onClick={() => setActivePage(activePageIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          title="Previous page"
        >
          <Icon name="chevronLeft" size={20} />
        </button>

        {page && (
          <div className={`page-frame${showRulers ? ' with-rulers' : ''}`}>
            {showRulers && (
              <>
                <span className="ruler top" aria-hidden="true" />
                <span className="ruler left" aria-hidden="true" />
              </>
            )}
            <div className="page-stack">
              <PageView {...pageViewProps(true)} width={dims.width} height={dims.height} />
              {showGrid && <span className="page-grid" aria-hidden="true" />}
            </div>
          </div>
        )}

        <button
          className="page-nav next"
          onClick={() => setActivePage(activePageIndex + 1)}
          disabled={!canNext}
          aria-label="Next page"
          title="Next page"
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>

      {armedPhotoIds.length > 0 ? (
        <p className="canvas-note armed-note">
          {armedPhotoIds.length === 1
            ? 'Photo picked up — click a slot to drop it there.'
            : `${armedPhotoIds.length} photos picked up — click slots one after another to drop them in, in order.`}{' '}
          <button className="link-btn" onClick={() => armPhoto(null)}>
            Cancel
          </button>{' '}
          (or press Esc)
        </p>
      ) : (
        <p className="canvas-note">
          Drag a photo onto an empty slot, click one for a quick picker, or click a photo in the
          tray first and then the slot. Click a filled slot to adjust it, or press Delete to clear
          it.
        </p>
      )}

      {zoomed && page && zoomDims && (
        <div className="page-zoom-overlay" onClick={() => setZoomed(false)}>
          <button className="page-zoom-close" onClick={() => setZoomed(false)} aria-label="Close full-screen view">
            <Icon name="close" size={18} />
          </button>

          {/* Outside the frame, so they stay put as pages of different sizes
              and orientations swap underneath them. */}
          <button
            className="page-zoom-nav prev"
            onClick={(e) => {
              e.stopPropagation()
              setActivePage(activePageIndex - 1)
            }}
            disabled={!canPrev}
            aria-label="Previous page"
            title="Previous page (←)"
          >
            <Icon name="chevronLeft" size={26} />
          </button>

          <div className="page-zoom-frame" onClick={(e) => e.stopPropagation()}>
            <PageView {...pageViewProps(false)} width={zoomDims.width} height={zoomDims.height} />
          </div>

          <button
            className="page-zoom-nav next"
            onClick={(e) => {
              e.stopPropagation()
              setActivePage(activePageIndex + 1)
            }}
            disabled={!canNext}
            aria-label="Next page"
            title="Next page (→)"
          >
            <Icon name="chevronRight" size={26} />
          </button>

          <span className="page-zoom-count mono">
            {activePageIndex + 1} / {pages.length}
          </span>
        </div>
      )}
    </main>
  )
}
