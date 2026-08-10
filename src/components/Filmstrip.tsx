import { Fragment, useState } from 'react'
import { getSize, sizeRatio } from '../data/sizes'
import { getTemplate } from '../data/templates'
import {
  artboardSize,
  firstSlideNumber,
  maxPagesForSize,
  sizeMinPages,
  spanOf,
  totalSlides,
} from '../lib/autoLayout'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import type { Photo } from '../types'

const THUMB_WIDTH = 72

export function Filmstrip({ photos }: { photos: Map<string, Photo> }) {
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const setActivePage = useStore((s) => s.setActivePage)
  const movePage = useStore((s) => s.movePage)
  const togglePageLock = useStore((s) => s.togglePageLock)
  const insertPageAt = useStore((s) => s.insertPageAt)
  const removePageAt = useStore((s) => s.removePageAt)
  const size = getSize(sizeId)
  const isPost = !!size.social
  const unit = isPost ? 'slide' : 'page'
  const maxPages = maxPagesForSize(size)
  // A spanning artboard is several slides on its own, so what's left is
  // measured in slides rather than in filmstrip items.
  const slides = totalSlides(pages)
  const canInsert = pages.length < maxPages && slides < maxPages
  const canRemove = pages.length > sizeMinPages(size)

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const insertGap = (position: number) => (
    <button
      className="fs-insert"
      onClick={() => insertPageAt(position)}
      disabled={!canInsert}
      aria-label={`Insert a new ${unit} here (position ${position + 1})`}
      title={
        canInsert
          ? `Insert a new ${unit} here`
          : isPost
            ? `Instagram and Facebook stop a carousel at ${maxPages} slides`
            : `Maximum is ${maxPages} pages`
      }
    >
      +
    </button>
  )

  return (
    <footer className="filmstrip">
      {insertGap(0)}
      {pages.map((page, index) => {
        const template = getTemplate(page.templateId)
        const span = spanOf(page)
        const ratio = sizeRatio(artboardSize(page, size))
        // A spanning page gets a proportionally wider thumbnail, so the strip
        // shows at a glance that one item is three slides rather than one.
        const width = THUMB_WIDTH * span
        const height = width / ratio
        const first = firstSlideNumber(pages, index)
        const label = span > 1 ? `${first}–${first + span - 1}` : String(first)
        return (
          <Fragment key={page.id}>
            <div className="fs-item">
            <div className="fs-page-wrap" style={{ width, height }}>
              <button
                className={[
                  'fs-page',
                  index === activePageIndex && 'active',
                  page.locked && 'locked',
                  dragOver === index && 'drag-over',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setActivePage(index)}
                draggable={!page.locked}
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => {
                  setDragFrom(null)
                  setDragOver(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragFrom !== null) setDragOver(index)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragFrom !== null && dragFrom !== index) movePage(dragFrom, index)
                  setDragFrom(null)
                  setDragOver(null)
                }}
                aria-label={`${isPost ? 'Slide' : 'Page'} ${label}`}
                aria-current={index === activePageIndex}
              >
                <span className="fs-slots">
                  {template.halfSplit && page.halves
                    ? template.slots.flatMap((region, halfIndex) => {
                        const half = page.halves![halfIndex as 0 | 1]
                        const halfTemplate = getTemplate(half.templateId)
                        return halfTemplate.slots.map((slot, slotIndex) => {
                          const placement = half.placements[slotIndex]
                          const photo = placement ? photos.get(placement.photoId) : undefined
                          return (
                            <span
                              key={`${halfIndex}-${slotIndex}`}
                              className={`fs-slot${photo ? ' filled' : ''}`}
                              style={{
                                left: `${region.x + (slot.x / 100) * region.w}%`,
                                top: `${region.y + (slot.y / 100) * region.h}%`,
                                width: `${(slot.w / 100) * region.w}%`,
                                height: `${(slot.h / 100) * region.h}%`,
                              }}
                            >
                              {photo && (
                                <img src={photoThumbUrl(photo)} alt="" loading="lazy" decoding="async" />
                              )}
                            </span>
                          )
                        })
                      })
                    : template.slots.map((slot, slotIndex) => {
                        const placement = page.placements[slotIndex]
                        const photo = placement ? photos.get(placement.photoId) : undefined
                        return (
                          <span
                            key={slotIndex}
                            className={`fs-slot${photo ? ' filled' : ''}`}
                            style={{
                              left: `${slot.x}%`,
                              top: `${slot.y}%`,
                              width: `${slot.w}%`,
                              height: `${slot.h}%`,
                            }}
                          >
                            {photo && (
                              <img src={photoThumbUrl(photo)} alt="" loading="lazy" decoding="async" />
                            )}
                          </span>
                        )
                      })}
                </span>
                {span > 1 &&
                  Array.from({ length: span - 1 }, (_, i) => (
                    <span
                      key={`seam-${i}`}
                      className="fs-seam"
                      style={{ left: `${((i + 1) / span) * 100}%` }}
                    />
                  ))}
              </button>
              <button
                className="fs-lock"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePageLock(index)
                }}
                aria-label={`${page.locked ? 'Unlock' : 'Lock'} ${unit} ${index + 1}`}
                title={page.locked ? `Unlock this ${unit}` : `Lock this ${unit}`}
              >
                {page.locked ? '🔒' : '🔓'}
              </button>
              {!page.locked && canRemove && (
                <button
                  className="fs-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePageAt(index)
                  }}
                  aria-label={`Delete ${unit} ${index + 1}`}
                  title={`Delete this ${unit} (Ctrl+Z to undo)`}
                >
                  ×
                </button>
              )}
            </div>
            <span className="fs-num mono">{label}</span>
            </div>
            {insertGap(index + 1)}
          </Fragment>
        )
      })}
    </footer>
  )
}
