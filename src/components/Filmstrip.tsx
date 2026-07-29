import { useState } from 'react'
import { getSize, sizeRatio } from '../data/sizes'
import { getTemplate } from '../data/templates'
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

  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const ratio = sizeRatio(getSize(sizeId))
  const height = THUMB_WIDTH / ratio

  return (
    <footer className="filmstrip">
      {pages.map((page, index) => {
        const template = getTemplate(page.templateId)
        return (
          <div className="fs-item" key={page.id}>
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
                  {template.slots.map((slot, slotIndex) => {
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
        )
      })}
    </footer>
  )
}
