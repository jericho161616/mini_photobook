import { useEffect, useMemo, useRef, useState } from 'react'
import { getSize, sizeRatio } from '../data/sizes'
import { useStore } from '../state/useStore'
import type { Photo } from '../types'
import { PageView } from './PageView'

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

export function SpreadCanvas({ photos }: { photos: Map<string, Photo> }) {
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const title = useStore((s) => s.title)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const assignPhoto = useStore((s) => s.assignPhoto)
  const updatePlacement = useStore((s) => s.updatePlacement)
  const togglePageLock = useStore((s) => s.togglePageLock)

  const size = getSize(sizeId)
  const ratio = sizeRatio(size)

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

  const { pageWidth, pageHeight } = useMemo(() => {
    const availableW = Math.max(160, (area.width - SPREAD_CHROME_X) / 2)
    const availableH = Math.max(160, area.height - SPREAD_CHROME_Y)
    const width = Math.min(MAX_PAGE_WIDTH, availableW, availableH * ratio)
    return { pageWidth: width, pageHeight: width / ratio }
  }, [ratio, area])

  const [leftIndex, rightIndex] = spreadFor(activePageIndex)

  const renderSide = (index: number | null, side: 'left' | 'right') => {
    if (index === null) {
      return <div className={`page ${side} blank`} style={{ width: pageWidth, height: pageHeight }} />
    }
    return (
      <PageView
        page={pages[index]}
        pageIndex={index}
        photos={photos}
        width={pageWidth}
        height={pageHeight}
        side={side}
        title={title}
        selectedSlot={selected?.pageIndex === index ? selected.slotIndex : null}
        onSelectSlot={(slotIndex) => select({ pageIndex: index, slotIndex })}
        onDropPhoto={(slotIndex, photoId) => assignPhoto({ pageIndex: index, slotIndex }, photoId)}
        onPan={(slotIndex, offsetX, offsetY) =>
          updatePlacement({ pageIndex: index, slotIndex }, { offsetX, offsetY })
        }
        onToggleLock={() => togglePageLock(index)}
      />
    )
  }

  return (
    <main className="canvas-area" ref={areaRef}>
      <div className="spread">
        {renderSide(leftIndex, 'left')}
        <div className="gutter" />
        {renderSide(rightIndex !== null && rightIndex < pages.length ? rightIndex : null, 'right')}
      </div>
      <p className="canvas-note">
        Drag photos from the tray into a slot. Click a slot to adjust it, then drag the photo inside
        to reframe.
      </p>
    </main>
  )
}
