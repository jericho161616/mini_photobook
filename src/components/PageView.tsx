import { DEFAULT_TEXT_STYLE, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { decorationHost } from '../lib/autoLayout'
import { PAGE_MARGIN_RATIO } from '../lib/exportPdf'
import { slotPixelRect } from '../lib/imageUtils'
import type { DecorationRef } from '../state/useStore'
import type { Page, Photo, Sticker, TextBox } from '../types'
import { DecorationLayer } from './DecorationLayer'
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
  /** Stickers and free text boxes for this page — omitted where there's nothing to draw. */
  decorations?: {
    selected: DecorationRef | null
    onSelect: (ref: DecorationRef) => void
    onChangeSticker: (ref: DecorationRef, patch: Partial<Sticker>) => void
    onChangeTextBox: (ref: DecorationRef, patch: Partial<TextBox>) => void
    onDelete: (ref: DecorationRef) => void
  }
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
  decorations,
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
            className={`page-caption page-note${template.captionStyle === 'centered' ? ' centered' : ''}`}
            style={{
              left: textRect.x,
              top: textRect.y,
              width: textRect.w,
              height: textRect.h,
              fontSize: Math.max(6, height * 0.026),
              fontFamily: fontStack((page.textStyle ?? DEFAULT_TEXT_STYLE).font),
              fontWeight: (page.textStyle ?? DEFAULT_TEXT_STYLE).bold ? 700 : 400,
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
                    framed={halfTemplate.id === 'instantGrid'}
                    poster={halfTemplate.decoration === 'poster' && slotIndex === 1}
                  />
                )
              })

              // This half's own note, positioned inside this half's region.
              if (halfTemplate.textSlot && half.text.trim()) {
                const inner = slotPixelRect(halfTemplate.textSlot, outer.w, outer.h, halfMargin)
                const halfStyle = half.textStyle ?? DEFAULT_TEXT_STYLE
                nested.push(
                  <div
                    key={`${halfIndex}-note`}
                    className={`page-caption page-note${halfTemplate.captionStyle === 'centered' ? ' centered' : ''}`}
                    style={{
                      left: outer.x + inner.x,
                      top: outer.y + inner.y,
                      width: inner.w,
                      height: inner.h,
                      fontSize: Math.max(6, outer.h * 0.026),
                      fontFamily: fontStack(halfStyle.font),
                      fontWeight: halfStyle.bold ? 700 : 400,
                    }}
                  >
                    {half.text}
                  </div>,
                )
              }

              if (decorations) {
                const h = halfIndex as 0 | 1
                const host = decorationHost(page, h)
                nested.push(
                  <div
                    key={`${halfIndex}-decorations`}
                    // pointerEvents: none so this full-half overlay never blocks clicks/drops
                    // on the slots beneath it — only the actual decorations inside (which
                    // opt back in via .decoration's own pointer-events) should be interactive.
                    style={{
                      position: 'absolute',
                      left: outer.x,
                      top: outer.y,
                      width: outer.w,
                      height: outer.h,
                      pointerEvents: 'none',
                    }}
                  >
                    <DecorationLayer
                      stickers={host.stickers ?? []}
                      textBoxes={host.textBoxes ?? []}
                      containerSize={{ w: outer.w, h: outer.h }}
                      locked={page.locked}
                      isSelected={(kind, id) =>
                        decorations.selected?.pageIndex === pageIndex &&
                        decorations.selected.halfIndex === h &&
                        decorations.selected.kind === kind &&
                        decorations.selected.id === id
                      }
                      onSelect={(kind, id) => decorations.onSelect({ pageIndex, halfIndex: h, kind, id })}
                      onChangeSticker={(id, patch) =>
                        decorations.onChangeSticker({ pageIndex, halfIndex: h, kind: 'sticker', id }, patch)
                      }
                      onChangeTextBox={(id, patch) =>
                        decorations.onChangeTextBox({ pageIndex, halfIndex: h, kind: 'textBox', id }, patch)
                      }
                      onDelete={(kind, id) => decorations.onDelete({ pageIndex, halfIndex: h, kind, id })}
                      onEditText={(id, text) =>
                        decorations.onChangeTextBox({ pageIndex, halfIndex: h, kind: 'textBox', id }, { text })
                      }
                    />
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
                  framed={template.id === 'instantGrid'}
                  poster={template.decoration === 'poster' && slotIndex === 1}
                />
              )
            })}
        {!template.halfSplit && decorations && (
          <DecorationLayer
            stickers={page.stickers ?? []}
            textBoxes={page.textBoxes ?? []}
            containerSize={{ w: width, h: height }}
            locked={page.locked}
            isSelected={(kind, id) =>
              decorations.selected?.pageIndex === pageIndex &&
              decorations.selected.halfIndex === undefined &&
              decorations.selected.kind === kind &&
              decorations.selected.id === id
            }
            onSelect={(kind, id) => decorations.onSelect({ pageIndex, kind, id })}
            onChangeSticker={(id, patch) => decorations.onChangeSticker({ pageIndex, kind: 'sticker', id }, patch)}
            onChangeTextBox={(id, patch) => decorations.onChangeTextBox({ pageIndex, kind: 'textBox', id }, patch)}
            onDelete={(kind, id) => decorations.onDelete({ pageIndex, kind, id })}
            onEditText={(id, text) =>
              decorations.onChangeTextBox({ pageIndex, kind: 'textBox', id }, { text })
            }
          />
        )}
      </div>
    </div>
  )
}
