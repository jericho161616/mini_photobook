import { useEffect, useMemo, useRef, useState } from 'react'
import { a4FamilyOptions, foldOrientationForSize, getSize, sizeRatio } from '../data/sizes'
import { resolvePageSize, usedPhotoIds } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { Page, Photo } from '../types'
import { PageView } from './PageView'

/** How many unplaced photos the quick picker offers before pointing at the full library. */
const QUICK_PICK_COUNT = 6

/** Frame around the single page: padding, the nav arrows, and breathing room. */
const PAGE_CHROME_X = 120
const PAGE_CHROME_Y = 72
const MAX_PAGE_WIDTH = 720

interface SpreadCanvasProps {
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
export function SpreadCanvas({ photos, onOpenLibrary }: SpreadCanvasProps) {
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

  return (
    <main className={`canvas-area${armedPhotoIds.length > 0 ? ' armed' : ''}`} ref={areaRef}>
      <div className="page-row">
        <button
          className="page-nav prev"
          onClick={() => setActivePage(activePageIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          title="Previous page"
        >
          ‹
        </button>

        {page && (
          <PageView
            page={page}
            pageIndex={activePageIndex}
            photos={photos}
            customStickers={customStickers}
            side="single"
            title={title}
            width={dims.width}
            height={dims.height}
            selectedSlot={selected?.pageIndex === activePageIndex ? selected.slotIndex : null}
            selectedHalfIndex={selected?.pageIndex === activePageIndex ? selected.halfIndex : undefined}
            onSelectSlot={(slotIndex, halfIndex) =>
              armedPhotoIds.length > 0
                ? placeArmedPhoto({ pageIndex: activePageIndex, slotIndex, halfIndex })
                : select({ pageIndex: activePageIndex, slotIndex, halfIndex })
            }
            onDropPhoto={(slotIndex, photoId, halfIndex) =>
              assignPhoto({ pageIndex: activePageIndex, slotIndex, halfIndex }, photoId)
            }
            onPan={(slotIndex, offsetX, offsetY, halfIndex) =>
              updatePlacement({ pageIndex: activePageIndex, slotIndex, halfIndex }, { offsetX, offsetY })
            }
            onToggleLock={() => togglePageLock(activePageIndex)}
            sizePicker={sizePicker}
            foldOrientation={foldOrientation}
            hasArmedPhoto={armedPhotoIds.length > 0}
            quickPick={{
              openKey: quickPickKey,
              keyFor: (slotIndex, halfIndex) => `${activePageIndex}:${halfIndex ?? 'p'}:${slotIndex}`,
              photos: unplacedPhotos,
              onOpen: (key) => setQuickPickKey(key),
              onClose: () => setQuickPickKey(null),
              onPick: (slotIndex, photoId, halfIndex) => {
                assignPhoto({ pageIndex: activePageIndex, slotIndex, halfIndex }, photoId)
                setQuickPickKey(null)
              },
              onOpenLibrary: () => {
                setQuickPickKey(null)
                onOpenLibrary()
              },
            }}
            decorations={{
              selected: selectedDecoration,
              onSelect: selectDecoration,
              onChangeSticker: updateSticker,
              onChangeTextBox: updateTextBox,
              onDelete: removeDecoration,
            }}
          />
        )}

        <button
          className="page-nav next"
          onClick={() => setActivePage(activePageIndex + 1)}
          disabled={!canNext}
          aria-label="Next page"
          title="Next page"
        >
          ›
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
    </main>
  )
}
