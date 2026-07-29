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
  /** Set only when the selected slot belongs to one half of a Split at Fold page. */
  selectedHalfIndex?: 0 | 1
  onSelectSlot: (slotIndex: number, halfIndex?: 0 | 1) => void
  onDropPhoto: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) => void
  onPan: (slotIndex: number, offsetX: number, offsetY: number, halfIndex?: 0 | 1) => void
  onToggleLock: () => void
  /** Present only when this page's size belongs to the A4 family. */
  sizePicker?: { options: { id: string; label: string }[]; value: string; onChange: (sizeId: string) => void }
  /**
   * Present only when this page's size is one of the A4 Folded sizes — driven
   * by the page's size, not its template, so the crease still shows even on a
   * general layout that isn't fold-aware.
   */
  foldOrientation?: 'vertical' | 'horizontal'
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
  selectedHalfIndex,
  onSelectSlot,
  onDropPhoto,
  onPan,
  onToggleLock,
  sizePicker,
  foldOrientation,
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
      {foldOrientation && <div className={`fold-guide ${foldOrientation}`} aria-hidden="true" />}
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
        {template.halfSplit && page.halves
          ? template.slots.flatMap((halfRegion, halfIndex) => {
              const outer = slotPixelRect(halfRegion, width, height, 0)
              const half = page.halves![halfIndex as 0 | 1]
              const halfTemplate = getTemplate(half.templateId)
              const halfMargin = halfTemplate.bleed ? 0 : PAGE_MARGIN_RATIO
              const nested: JSX.Element[] = halfTemplate.slots.map((slot, slotIndex) => {
                const inner = slotPixelRect(slot, outer.w, outer.h, halfMargin)
                const rect = { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h }
                const placement = half.placements[slotIndex] ?? null
                const photo = placement ? photos.get(placement.photoId) : undefined
                return (
                  <SlotView
                    key={`${halfIndex}-${slotIndex}`}
                    rect={rect}
                    placement={placement}
                    photo={photo}
                    selected={selectedHalfIndex === halfIndex && selectedSlot === slotIndex}
                    onSelect={() => onSelectSlot(slotIndex, halfIndex as 0 | 1)}
                    onDropPhoto={(photoId) => onDropPhoto(slotIndex, photoId, halfIndex as 0 | 1)}
                    onPan={(x, y) => onPan(slotIndex, x, y, halfIndex as 0 | 1)}
                  />
                )
              })

              // This half's own note, positioned inside this half's region.
              if (halfTemplate.textSlot && half.text.trim()) {
                const inner = slotPixelRect(halfTemplate.textSlot, outer.w, outer.h, halfMargin)
                nested.push(
                  <div
                    key={`${halfIndex}-note`}
                    className="page-caption page-note"
                    style={{
                      left: outer.x + inner.x,
                      top: outer.y + inner.y,
                      width: inner.w,
                      height: inner.h,
                      fontSize: Math.max(6, outer.h * 0.026),
                    }}
                  >
                    {half.text}
                  </div>,
                )
              }
              return nested
            })
          : template.slots.map((slot, slotIndex) => {
              const rect = slotPixelRect(slot, width, height, marginRatio)
              const placement = page.placements[slotIndex] ?? null
              const photo = placement ? photos.get(placement.photoId) : undefined
              return (
                <SlotView
                  key={slotIndex}
                  rect={rect}
                  placement={placement}
                  photo={photo}
                  selected={selectedHalfIndex === undefined && selectedSlot === slotIndex}
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
