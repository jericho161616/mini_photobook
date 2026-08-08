import { Fragment, useState } from 'react'
import { getSize, sizeRatio } from '../data/sizes'
import { getTemplate } from '../data/templates'
import { resolvePageSize } from '../lib/autoLayout'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import { MAX_PAGES, type Photo } from '../types'

const THUMB_WIDTH = 72

export function Filmstrip({ photos }: { photos: Map<string, Photo> }) {
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const setActivePage = useStore((s) => s.setActivePage)
  const movePage = useStore((s) => s.movePage)
  const togglePageLock = useStore((s) => s.togglePageLock)
  const insertPageAt = useStore((s) => s.insertPageAt)
  const canInsert = pages.length < MAX_PAGES

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const size = getSize(sizeId)

  const insertGap = (position: number) => (
    <button
      className="fs-insert"
      onClick={() => insertPageAt(position)}
      disabled={!canInsert}
      aria-label={`Insert a new page here (position ${position + 1})`}
      title={canInsert ? 'Insert a new page here' : `Maximum is ${MAX_PAGES} pages`}
    >
      +
    </button>
  )

  return (
    <footer className="filmstrip">
      {insertGap(0)}
      {pages.map((page, index) => {
        const template = getTemplate(page.templateId)
        const ratio = sizeRatio(resolvePageSize(page, size))
        const height = THUMB_WIDTH / ratio
        return (
          <Fragment key={page.id}>
            <div className="fs-item">
            <div className="fs-page-wrap" style={{ width: THUMB_WIDTH, height }}>
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
                aria-label={`Page ${index + 1}`}
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
              </button>
              <button
                className="fs-lock"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePageLock(index)
                }}
                aria-label={page.locked ? `Unlock page ${index + 1}` : `Lock page ${index + 1}`}
                title={page.locked ? 'Unlock this page' : 'Lock this page'}
              >
                {page.locked ? '🔒' : '🔓'}
              </button>
            </div>
            <span className="fs-num mono">{index + 1}</span>
            </div>
            {insertGap(index + 1)}
          </Fragment>
        )
      })}
    </footer>
  )
}
