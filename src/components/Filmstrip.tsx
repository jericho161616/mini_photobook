import { useState } from 'react'
import { getSize, sizeRatio } from '../data/sizes'
import { getTemplate } from '../data/templates'
import { photoUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import type { Photo } from '../types'

const THUMB_WIDTH = 46

export function Filmstrip({ photos }: { photos: Map<string, Photo> }) {
  const pages = useStore((s) => s.pages)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const setActivePage = useStore((s) => s.setActivePage)
  const movePage = useStore((s) => s.movePage)

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
            <button
              className={[
                'fs-page',
                index === activePageIndex && 'active',
                dragOver === index && 'drag-over',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ height }}
              onClick={() => setActivePage(index)}
              draggable
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
                      {photo && <img src={photoUrl(photo)} alt="" />}
                    </span>
                  )
                })}
              </span>
            </button>
            <span className="fs-num mono">{index + 1}</span>
          </div>
        )
      })}
    </footer>
  )
}
