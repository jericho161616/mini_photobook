import { useEffect, useMemo, useRef, useState } from 'react'
import { getTemplate } from '../data/templates'
import { resolvePageSize } from '../lib/autoLayout'
import { PAGE_MARGIN_RATIO } from '../lib/exportPdf'
import { photoUrl, slotPixelRect } from '../lib/imageUtils'
import type { BookSize, Page, Photo } from '../types'

const ADVANCE_MS = 1500
const MAX_W = 640
const MAX_H = 640

interface SlideshowProps {
  pages: Page[]
  photos: Map<string, Photo>
  size: BookSize
  title: string
  startIndex: number
  onClose: () => void
}

/**
 * A read-only, full-page look at the book in sequence — for checking how it
 * all flows without the editing chrome in the way. One page at a time rather
 * than spreads, so it works the same regardless of where you started it.
 */
export function Slideshow({ pages, photos, size, title, startIndex, onClose }: SlideshowProps) {
  const [index, setIndex] = useState(startIndex)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef<number>()

  const page = pages[index]
  const pageSize = resolvePageSize(page, size)
  const ratio = pageSize.widthIn / pageSize.heightIn
  const pageWidth = ratio >= 1 ? MAX_W : MAX_H * ratio
  const pageHeight = ratio >= 1 ? MAX_W / ratio : MAX_H

  useEffect(() => {
    if (!playing) return
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % pages.length)
    }, ADVANCE_MS)
    return () => window.clearInterval(timerRef.current)
  }, [playing, pages.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') {
        setPlaying(false)
        setIndex((i) => Math.min(i + 1, pages.length - 1))
      }
      if (e.key === 'ArrowLeft') {
        setPlaying(false)
        setIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pages.length])

  const template = useMemo(() => getTemplate(page.templateId), [page.templateId])
  const marginRatio = template.bleed ? 0 : PAGE_MARGIN_RATIO
  const captionRect = template.caption
    ? slotPixelRect(template.caption, pageWidth, pageHeight, marginRatio)
    : null
  const textRect = template.textSlot
    ? slotPixelRect(template.textSlot, pageWidth, pageHeight, marginRatio)
    : null

  return (
    <div className="overlay slideshow-overlay" role="dialog" aria-modal="true" aria-label="Slideshow">
      <button className="slideshow-close" onClick={onClose} aria-label="Close slideshow">
        ×
      </button>

      <div className="slideshow-stage">
        <div className="page slideshow-page" style={{ width: pageWidth, height: pageHeight }}>
          <div className="slots" style={{ inset: 0 }}>
            {captionRect && title.trim() && (
              <div
                className="page-caption"
                style={{
                  left: captionRect.x,
                  top: captionRect.y,
                  width: captionRect.w,
                  height: captionRect.h,
                  fontSize: Math.max(7, pageHeight * 0.032),
                }}
              >
                {title}
              </div>
            )}
            {textRect && page.text.trim() && (
              <div
                className="page-caption page-note"
                style={{
                  left: textRect.x,
                  top: textRect.y,
                  width: textRect.w,
                  height: textRect.h,
                  fontSize: Math.max(6, pageHeight * 0.026),
                }}
              >
                {page.text}
              </div>
            )}
            {(template.halfSplit && page.halves
              ? template.slots.flatMap((region, halfIndex) => {
                  const half = page.halves![halfIndex as 0 | 1]
                  const halfTemplate = getTemplate(half.templateId)
                  const outer = slotPixelRect(region, pageWidth, pageHeight, 0)
                  const halfMargin = halfTemplate.bleed ? 0 : PAGE_MARGIN_RATIO
                  return halfTemplate.slots.map((slot, slotIndex) => {
                    const inner = slotPixelRect(slot, outer.w, outer.h, halfMargin)
                    return {
                      key: `${halfIndex}-${slotIndex}`,
                      rect: { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h },
                      placement: half.placements[slotIndex],
                    }
                  })
                })
              : template.slots.map((slot, slotIndex) => ({
                  key: String(slotIndex),
                  rect: slotPixelRect(slot, pageWidth, pageHeight, marginRatio),
                  placement: page.placements[slotIndex],
                }))
            ).map(({ key, rect, placement }) => {
              const photo = placement ? photos.get(placement.photoId) : undefined
              return (
                <div
                  key={key}
                  className="slot"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                >
                  {photo && (
                    <img
                      src={photoUrl(photo)}
                      alt=""
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="slideshow-controls" onClick={(e) => e.stopPropagation()}>
        <button
          className="btn"
          onClick={() => {
            setPlaying(false)
            setIndex((i) => Math.max(i - 1, 0))
          }}
          aria-label="Previous page"
        >
          ‹
        </button>
        <button
          className="btn-primary"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          className="btn"
          onClick={() => {
            setPlaying(false)
            setIndex((i) => Math.min(i + 1, pages.length - 1))
          }}
          aria-label="Next page"
        >
          ›
        </button>
        <span className="mono slideshow-count">
          {index + 1} / {pages.length}
        </span>
      </div>
    </div>
  )
}
