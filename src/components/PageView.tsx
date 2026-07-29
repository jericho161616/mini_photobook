import { getTemplate } from '../data/templates'
import { PAGE_MARGIN_RATIO } from '../lib/exportPdf'
import { slotPixelRect } from '../lib/imageUtils'
import type { Page, Photo } from '../types'
import { SlotView } from './SlotView'

interface PageViewProps {
  page: Page | undefined
  pageIndex: number
  photos: Map<string, Photo>
  width: number
  height: number
  side: 'left' | 'right'
  title: string
  selectedSlot: number | null
  onSelectSlot: (slotIndex: number) => void
  onDropPhoto: (slotIndex: number, photoId: string) => void
  onPan: (slotIndex: number, offsetX: number, offsetY: number) => void
  onToggleLock: () => void
  /** Present only when this page's size belongs to the A4 family. */
  sizePicker?: { options: { id: string; label: string }[]; value: string; onChange: (sizeId: string) => void }
}

export function PageView({
  page,
  pageIndex,
  photos,
  width,
  height,
  side,
  title,
  selectedSlot,
  onSelectSlot,
  onDropPhoto,
  onPan,
  onToggleLock,
  sizePicker,
}: PageViewProps) {
  if (!page) {
    // Odd page counts leave the final verso empty rather than inventing a page.
    return <div className={`page ${side} blank`} style={{ width, height }} />
  }

  const template = getTemplate(page.templateId)
  const marginRatio = template.bleed ? 0 : PAGE_MARGIN_RATIO
  const captionRect = template.caption
    ? slotPixelRect(template.caption, width, height, marginRatio)
    : null
  const textRect = template.textSlot
    ? slotPixelRect(template.textSlot, width, height, marginRatio)
    : null

  return (
    <div
      className={`page ${side}${page.locked ? ' locked' : ''}`}
      style={{ width, height }}
      data-page-index={pageIndex}
    >
      <button
        className="page-lock"
        onClick={onToggleLock}
        aria-label={page.locked ? `Unlock page ${pageIndex + 1}` : `Lock page ${pageIndex + 1}`}
        title={page.locked ? 'Unlock this page' : 'Lock this page to protect it from edits'}
      >
        {page.locked ? '🔒' : '🔓'}
      </button>
      {sizePicker && (
        <select
          className="page-size-picker"
          value={sizePicker.value}
          onChange={(e) => sizePicker.onChange(e.target.value)}
          disabled={page.locked}
          title={page.locked ? 'Unlock this page to change its size' : "This page's size, within the A4 family"}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Page ${pageIndex + 1} size`}
        >
          {sizePicker.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {template.foldLine && (
        <div className={`fold-guide ${template.foldLine}`} aria-hidden="true" />
      )}
      <div className="slots" style={{ inset: 0 }}>
        {captionRect && title.trim() && (
          <div
            className="page-caption"
            style={{
              left: captionRect.x,
              top: captionRect.y,
              width: captionRect.w,
              height: captionRect.h,
              fontSize: Math.max(7, height * 0.032),
              letterSpacing: `${height * 0.0022}px`,
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
              fontSize: Math.max(6, height * 0.026),
            }}
          >
            {page.text}
          </div>
        )}
        {template.slots.map((slot, slotIndex) => {
          const rect = slotPixelRect(slot, width, height, marginRatio)
          const placement = page.placements[slotIndex] ?? null
          const photo = placement ? photos.get(placement.photoId) : undefined
          return (
            <SlotView
              key={slotIndex}
              rect={rect}
              placement={placement}
              photo={photo}
              selected={selectedSlot === slotIndex}
              onSelect={() => onSelectSlot(slotIndex)}
              onDropPhoto={(photoId) => onDropPhoto(slotIndex, photoId)}
              onPan={(x, y) => onPan(slotIndex, x, y)}
            />
          )
        })}
      </div>
    </div>
  )
}
