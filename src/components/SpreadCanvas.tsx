import { useEffect, useMemo, useRef, useState } from 'react'
import { a4FamilyOptions, foldOrientationForSize, getSize, sizeRatio } from '../data/sizes'
import { resolvePageSize, usedPhotoIds } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { Page, Photo } from '../types'
import { PageView } from './PageView'

/** How many unplaced photos the quick picker offers before pointing at the full library. */
const QUICK_PICK_COUNT = 6

/** Frame around the spread: padding, the gutter, and breathing room. */
const SPREAD_CHROME_X = 56
const SPREAD_CHROME_Y = 72
const MAX_PAGE_WIDTH = 460

/**
 * Page one stands alone as the opening recto, then pages pair up the way a
 * bound book actually falls open: (2,3), (4,5), and so on.
 */
export function spreadFor(activeIndex: number): [number, number | null] {
  if (activeIndex === 0) return [0, null]
  const left = activeIndex % 2 === 1 ? activeIndex : activeIndex - 1
  return [left, left + 1]
}

interface SpreadCanvasProps {
  photos: Map<string, Photo>
  onOpenLibrary: () => void
}

export function SpreadCanvas({ photos, onOpenLibrary }: SpreadCanvasProps) {
  const allPhotos = useStore((s) => s.photos)
  const customStickers = useStore((s) => s.customStickers)
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const title = useStore((s) => s.title)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const assignPhoto = useStore((s) => s.assignPhoto)
  const armedPhotoIds = useStore((s) => s.armedPhotoIds)
  const armPhoto = useStore((s) => s.armPhoto)
  const placeArmedPhoto = useStore((s) => s.placeArmedPhoto)
  const clearSlot = useStore((s) => s.clearSlot)
  const updatePlacement = useStore((s) => s.updatePlacement)
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

  // The spread should use whatever room the window gives it, so a tall book
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

  const dimsFor = useMemo(() => {
    const availableW = Math.max(160, (area.width - SPREAD_CHROME_X) / 2)
    const availableH = Math.max(160, area.height - SPREAD_CHROME_Y)
    return (ratio: number) => {
      const width = Math.min(MAX_PAGE_WIDTH, availableW, availableH * ratio)
      return { width, height: width / ratio }
    }
  }, [area])

  const fallbackDims = dimsFor(sizeRatio(size))

  const [leftIndex, rightIndex] = spreadFor(activePageIndex)
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (zoomedIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZoomedIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomedIndex])

  // Everything a PageView needs besides its size and which side it renders
  // on — shared between the normal spread and the full-screen zoom overlay
  // so the same page stays fully interactive (pan, select, drop) at any size.
  const pageViewProps = (index: number, side: 'left' | 'right') => {
    const page: Page = pages[index]
    const pageSize = resolvePageSize(page, size)
    const foldOrientation = foldOrientationForSize(pageSize.id)
    const familyOptions = a4FamilyOptions(pageSize.id)
    const sizePicker = familyOptions
      ? {
          options: familyOptions,
          value: pageSize.id,
          onChange: (nextSizeId: string) => setPageSize(index, nextSizeId),
        }
      : undefined
    return {
      page,
      pageIndex: index,
      photos,
      customStickers,
      side,
      title,
      selectedSlot: selected?.pageIndex === index ? selected.slotIndex : null,
      selectedHalfIndex: selected?.pageIndex === index ? selected.halfIndex : undefined,
      onSelectSlot: (slotIndex: number, halfIndex?: 0 | 1) =>
        armedPhotoIds.length > 0
          ? placeArmedPhoto({ pageIndex: index, slotIndex, halfIndex })
          : select({ pageIndex: index, slotIndex, halfIndex }),
      onDropPhoto: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) =>
        assignPhoto({ pageIndex: index, slotIndex, halfIndex }, photoId),
      onPan: (slotIndex: number, offsetX: number, offsetY: number, halfIndex?: 0 | 1) =>
        updatePlacement({ pageIndex: index, slotIndex, halfIndex }, { offsetX, offsetY }),
      onToggleLock: () => togglePageLock(index),
      sizePicker,
      foldOrientation,
      hasArmedPhoto: armedPhotoIds.length > 0,
      onFullscreen: () => setZoomedIndex(index),
      quickPick: {
        openKey: quickPickKey,
        keyFor: (slotIndex: number, halfIndex?: 0 | 1) => `${index}:${halfIndex ?? 'p'}:${slotIndex}`,
        photos: unplacedPhotos,
        onOpen: (key: string) => setQuickPickKey(key),
        onClose: () => setQuickPickKey(null),
        onPick: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) => {
          assignPhoto({ pageIndex: index, slotIndex, halfIndex }, photoId)
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
    }
  }

  const renderSide = (index: number | null, side: 'left' | 'right') => {
    if (index === null) {
      return (
        <div
          className={`page ${side} blank`}
          style={{ width: fallbackDims.width, height: fallbackDims.height }}
        />
      )
    }
    const pageSize = resolvePageSize(pages[index], size)
    const { width, height } = dimsFor(sizeRatio(pageSize))
    return <PageView {...pageViewProps(index, side)} width={width} height={height} />
  }

  // Sized to fit comfortably inside the viewport rather than the cramped
  // two-up spread area, preserving the page's own aspect ratio.
  const zoomDims = useMemo(() => {
    if (zoomedIndex === null) return null
    const pageSize = resolvePageSize(pages[zoomedIndex], size)
    const ratio = sizeRatio(pageSize)
    const maxW = window.innerWidth * 0.86
    const maxH = window.innerHeight * 0.86
    const width = Math.min(maxW, maxH * ratio)
    return { width, height: width / ratio }
  }, [zoomedIndex, pages, size])

  return (
    <main className={`canvas-area${armedPhotoIds.length > 0 ? ' armed' : ''}`} ref={areaRef}>
      <div className="spread">
        {renderSide(leftIndex, 'left')}
        <div className="gutter" />
        {renderSide(rightIndex !== null && rightIndex < pages.length ? rightIndex : null, 'right')}
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
      {zoomedIndex !== null && zoomDims && (
        <div className="page-zoom-overlay" onClick={() => setZoomedIndex(null)}>
          <div className="page-zoom-frame" onClick={(e) => e.stopPropagation()}>
            <button
              className="page-zoom-close"
              onClick={() => setZoomedIndex(null)}
              aria-label="Close full-screen page view"
            >
              ×
            </button>
            <PageView
              {...pageViewProps(zoomedIndex, 'left')}
              width={zoomDims.width}
              height={zoomDims.height}
            />
          </div>
        </div>
      )}
    </main>
  )
}
