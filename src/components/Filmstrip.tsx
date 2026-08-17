import { Fragment, useState } from 'react'
import { getSize, sizeRatio } from '../data/sizes'
import { getTemplate } from '../data/templates'
import { resolvePageSize, sizeMinPages } from '../lib/autoLayout'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import { MAX_PAGES, type Photo } from '../types'
import { Icon } from './Icon'

const THUMB_WIDTH = 72

export function Filmstrip({ photos }: { photos: Map<string, Photo> }) {
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const setActivePage = useStore((s) => s.setActivePage)
  const movePage = useStore((s) => s.movePage)
  const togglePageLock = useStore((s) => s.togglePageLock)
  const setAllPagesLocked = useStore((s) => s.setAllPagesLocked)
  const insertPageAt = useStore((s) => s.insertPageAt)
  const removePageAt = useStore((s) => s.removePageAt)
  const size = getSize(sizeId)
  const canInsert = pages.length < MAX_PAGES
  const canRemove = pages.length > sizeMinPages(size)

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  /**
   * Which *gap* the page would land in, 0..pages.length — not which page is
   * hovered. Marking the hovered page (what this used to do) can't say whether
   * the drop lands before or after it, and its outline looked almost exactly
   * like the active page's own.
   */
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const anyUnlocked = pages.some((page) => !page.locked)

  function endDrag() {
    setDragFrom(null)
    setDropIndex(null)
  }

  /** Left half of a thumbnail means the gap before it, right half the gap after. */
  function gapFor(e: React.DragEvent, index: number) {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientX < r.left + r.width / 2 ? index : index + 1
  }

  function drop() {
    if (dragFrom !== null && dropIndex !== null) {
      // Gap indices shift by one once the dragged page is spliced out.
      const to = dropIndex > dragFrom ? dropIndex - 1 : dropIndex
      if (to !== dragFrom) movePage(dragFrom, to)
    }
    endDrag()
  }

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
      {/* Pinned outside the scroller: in a thirty-page book the one control
          that acts on every page would otherwise scroll out of sight. */}
      <div className="filmstrip-pinned">
        <button
          className="btn btn-icon fs-lock-all"
          onClick={() => setAllPagesLocked(anyUnlocked)}
          aria-label={anyUnlocked ? 'Lock all pages' : 'Unlock all pages'}
          title={anyUnlocked ? 'Lock all pages' : 'Unlock all pages'}
        >
          <Icon name={anyUnlocked ? 'lock' : 'unlock'} size={15} />
        </button>
      </div>

      <div className="filmstrip-scroll" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
        <div className="filmstrip-track">
          {insertGap(0)}
          {pages.map((page, index) => {
            const template = getTemplate(page.templateId)
            const ratio = sizeRatio(resolvePageSize(page, size))
            const height = THUMB_WIDTH / ratio
            const itemClass = [
              'fs-item',
              dropIndex === index && 'drop-left',
              dropIndex === pages.length && index === pages.length - 1 && 'drop-right',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <Fragment key={page.id}>
                <div
                  className={itemClass}
                  onDragOver={(e) => {
                    if (dragFrom === null) return
                    e.preventDefault()
                    setDropIndex(gapFor(e, index))
                  }}
                >
                  <div className="fs-page-wrap" style={{ width: THUMB_WIDTH, height }}>
                    <button
                      className={[
                        'fs-page',
                        index === activePageIndex && 'active',
                        page.locked && 'locked',
                        dragFrom === index && 'dragging',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setActivePage(index)}
                      draggable={!page.locked}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        setDragFrom(index)
                      }}
                      onDragEnd={endDrag}
                      aria-label={`Page ${index + 1}${page.locked ? ', locked' : ''}`}
                      aria-current={index === activePageIndex}
                      title={page.locked ? 'Locked — unlock it to reorder' : 'Drag to reorder'}
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
                      <Icon name={page.locked ? 'lock' : 'unlock'} size={11} />
                    </button>
                    {!page.locked && canRemove && (
                      <button
                        className="fs-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          removePageAt(index)
                        }}
                        aria-label={`Delete page ${index + 1}`}
                        title="Delete this page (Ctrl+Z to undo)"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <span className="fs-num mono">{index + 1}</span>
                  {/* Dragging a page from the back of a long book to the front
                      means hauling it past thirty thumbnails. These do it in one
                      click, and give the keyboard a way in. */}
                  {!page.locked && (
                    <div className="fs-jump">
                      <button
                        onClick={() => movePage(index, 0)}
                        disabled={index === 0}
                        aria-label={`Move page ${index + 1} to the start`}
                        title="Move to start"
                      >
                        <Icon name="toStart" size={12} />
                      </button>
                      <button
                        onClick={() => movePage(index, pages.length - 1)}
                        disabled={index === pages.length - 1}
                        aria-label={`Move page ${index + 1} to the end`}
                        title="Move to end"
                      >
                        <Icon name="toEnd" size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {insertGap(index + 1)}
              </Fragment>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
