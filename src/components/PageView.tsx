import { DEFAULT_TEXT_STYLE, fontSizeScale, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { decorationHost } from '../lib/autoLayout'
import { PAGE_MARGIN_RATIO } from '../lib/exportPdf'
import {
  isDarkColor,
  isOverlaySlot,
  photoUrl,
  resolveOverlayPosition,
  resolveSlotStyle,
  slotPixelRect,
  slotRotationDeg,
  stampClipPathCss,
} from '../lib/imageUtils'
import type { DecorationRef } from '../state/useStore'
import type { CustomSticker, Page, Photo, Sticker, TextBox } from '../types'
import { DecorationLayer } from './DecorationLayer'
import { SlotView } from './SlotView'

const CAPTION_CLASS: Record<string, string> = {
  centered: ' centered',
  ruled: ' ruled',
  quote: ' quote',
  divider: ' divider',
  stamp: ' stamp',
}

interface PageViewProps {
  page: Page | undefined
  pageIndex: number
  photos: Map<string, Photo>
  width: number
  height: number
  side: 'single'
  title: string
  selectedSlot: number | null
  /** Set only when the selected slot belongs to one half of a Split at Fold page. */
  selectedHalfIndex?: 0 | 1
  onSelectSlot: (slotIndex: number, halfIndex?: 0 | 1) => void
  onDropPhoto: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) => void
  onPan: (slotIndex: number, offsetX: number, offsetY: number, halfIndex?: 0 | 1) => void
  onToggleLock: () => void
  /** Opens this page even larger in a full-screen overlay — omitted for the overlay's own PageView instance. */
  onFullscreen?: () => void
  /** True while a photo is picked up for click-to-place — an empty slot places it instead of opening the quick picker. */
  hasArmedPhoto: boolean
  /** Lets an empty slot pop open a small picker of recently-unplaced photos instead of requiring a drag. */
  quickPick: {
    openKey: string | null
    keyFor: (slotIndex: number, halfIndex?: 0 | 1) => string
    photos: Photo[]
    onOpen: (key: string) => void
    onClose: () => void
    onPick: (slotIndex: number, photoId: string, halfIndex?: 0 | 1) => void
    onOpenLibrary: () => void
  }
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
  /** The book's own drawn-sticker library, for resolving a placed 'custom' sticker's artwork. */
  customStickers: CustomSticker[]
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
  onFullscreen,
  hasArmedPhoto,
  quickPick,
  sizePicker,
  foldOrientation,
  decorations,
  customStickers,
}: PageViewProps) {
  if (!page) {
    // Odd page counts leave the final verso empty rather than inventing a page.
    return <div className={`page ${side} blank`} style={{ width, height }} />
  }

  const template = getTemplate(page.templateId)
  const marginRatio = template.bleed ? 0 : PAGE_MARGIN_RATIO * (page.marginScale ?? 1)
  const captionRect = template.caption
    ? slotPixelRect(template.caption, width, height, marginRatio)
    : null
  const textRect = template.textSlot
    ? slotPixelRect(template.textSlot, width, height, marginRatio)
    : null
  const backgroundPhoto = page.backgroundPhotoId ? photos.get(page.backgroundPhotoId) : undefined
  // A dark page background (the Night preset, or any background photo — which
  // reads busy enough on its own to warrant the same light parchment text as
  // a dark tint) needs light text instead of the usual dark ink.
  const onDark = Boolean(backgroundPhoto) || (page.backgroundColor ? isDarkColor(page.backgroundColor) : false)

  return (
    <div
      className={`page ${side}${page.locked ? ' locked' : ''}`}
      style={{ width, height, backgroundColor: page.backgroundColor }}
      data-page-index={pageIndex}
    >
      {backgroundPhoto && (
        <>
          <div
            className="page-bg-photo"
            style={{ backgroundImage: `url(${photoUrl(backgroundPhoto)})` }}
            aria-hidden="true"
          />
          <div
            className="page-bg-dim"
            style={{ opacity: (page.backgroundDim ?? 35) / 100 }}
            aria-hidden="true"
          />
        </>
      )}
      <button
        className="page-lock"
        onClick={onToggleLock}
        aria-label={page.locked ? `Unlock page ${pageIndex + 1}` : `Lock page ${pageIndex + 1}`}
        title={page.locked ? 'Unlock this page' : 'Lock this page to protect it from edits'}
      >
        {page.locked ? '🔒' : '🔓'}
      </button>
      {onFullscreen && (
        <button
          className="page-fullscreen"
          onClick={(e) => {
            e.stopPropagation()
            onFullscreen()
          }}
          aria-label={`View page ${pageIndex + 1} full-screen`}
          title="View even larger, full-screen"
        >
          ⤢
        </button>
      )}
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
              color: onDark ? '#f2ead2' : undefined,
            }}
          >
            {title}
          </div>
        )}
        {textRect && page.text.trim() && (
          <div
            className={`page-caption page-note${CAPTION_CLASS[template.captionStyle ?? ''] ?? ''}`}
            style={{
              left: textRect.x,
              top: textRect.y,
              width: textRect.w,
              height: textRect.h,
              fontSize:
                Math.max(6, height * (template.captionStyle === 'divider' ? 0.052 : 0.026)) *
                fontSizeScale((page.textStyle ?? DEFAULT_TEXT_STYLE).size),
              fontFamily: fontStack((page.textStyle ?? DEFAULT_TEXT_STYLE).font),
              fontWeight: (page.textStyle ?? DEFAULT_TEXT_STYLE).bold ? 700 : 400,
              color: onDark ? '#c9bfa4' : undefined,
              clipPath: template.captionStyle === 'stamp' ? stampClipPathCss(textRect.w, textRect.h) : undefined,
            }}
          >
            {template.captionStyle === 'quote' && <span className="quote-mark" aria-hidden="true">&ldquo;</span>}
            {page.text}
            {template.captionStyle === 'divider' && <span className="divider-rule" aria-hidden="true" />}
          </div>
        )}
        {template.halfSplit && page.halves
          ? template.slots.flatMap((halfRegion, halfIndex) => {
              const outer = slotPixelRect(halfRegion, width, height, 0)
              const half = page.halves![halfIndex as 0 | 1]
              const halfTemplate = getTemplate(half.templateId)
              const halfMargin = halfTemplate.bleed ? 0 : PAGE_MARGIN_RATIO * (page.marginScale ?? 1)
              const nested: JSX.Element[] = halfTemplate.slots.map((slot, slotIndex) => {
                const placement = half.placements[slotIndex] ?? null
                const positioned = isOverlaySlot(halfTemplate, slotIndex)
                  ? resolveOverlayPosition(slot, placement?.overlayPosition)
                  : slot
                const inner = slotPixelRect(positioned, outer.w, outer.h, halfMargin)
                const rect = { x: outer.x + inner.x, y: outer.y + inner.y, w: inner.w, h: inner.h }
                const photo = placement ? photos.get(placement.photoId) : undefined
                const key = quickPick.keyFor(slotIndex, halfIndex as 0 | 1)
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
                    {...resolveSlotStyle(halfTemplate, slotIndex, placement)}
                    rotationDeg={slotRotationDeg(halfTemplate, slotIndex, placement)}
                    hasArmedPhoto={hasArmedPhoto}
                    quickPick={
                      photo
                        ? undefined
                        : {
                            open: quickPick.openKey === key,
                            photos: quickPick.photos,
                            onOpen: () => quickPick.onOpen(key),
                            onClose: quickPick.onClose,
                            onPick: (photoId) => quickPick.onPick(slotIndex, photoId, halfIndex as 0 | 1),
                            onOpenLibrary: quickPick.onOpenLibrary,
                          }
                    }
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
                    className={`page-caption page-note${CAPTION_CLASS[halfTemplate.captionStyle ?? ''] ?? ''}`}
                    style={{
                      left: outer.x + inner.x,
                      top: outer.y + inner.y,
                      width: inner.w,
                      height: inner.h,
                      fontSize:
                        Math.max(6, outer.h * (halfTemplate.captionStyle === 'divider' ? 0.052 : 0.026)) *
                        fontSizeScale(halfStyle.size),
                      fontFamily: fontStack(halfStyle.font),
                      fontWeight: halfStyle.bold ? 700 : 400,
                      color: onDark ? '#c9bfa4' : undefined,
                      clipPath:
                        halfTemplate.captionStyle === 'stamp' ? stampClipPathCss(inner.w, inner.h) : undefined,
                    }}
                  >
                    {halfTemplate.captionStyle === 'quote' && (
                      <span className="quote-mark" aria-hidden="true">&ldquo;</span>
                    )}
                    {half.text}
                    {halfTemplate.captionStyle === 'divider' && <span className="divider-rule" aria-hidden="true" />}
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
                      customStickers={customStickers}
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
              const placement = page.placements[slotIndex] ?? null
              const positioned = isOverlaySlot(template, slotIndex)
                ? resolveOverlayPosition(slot, placement?.overlayPosition)
                : slot
              const rect = slotPixelRect(positioned, width, height, marginRatio)
              const photo = placement ? photos.get(placement.photoId) : undefined
              const key = quickPick.keyFor(slotIndex)
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
                  {...resolveSlotStyle(template, slotIndex, placement)}
                  rotationDeg={slotRotationDeg(template, slotIndex, placement)}
                  hasArmedPhoto={hasArmedPhoto}
                  quickPick={
                    photo
                      ? undefined
                      : {
                          open: quickPick.openKey === key,
                          photos: quickPick.photos,
                          onOpen: () => quickPick.onOpen(key),
                          onClose: quickPick.onClose,
                          onPick: (photoId) => quickPick.onPick(slotIndex, photoId),
                          onOpenLibrary: quickPick.onOpenLibrary,
                        }
                  }
                />
              )
            })}
        {template.decoration === 'beforeAfter' && (
          <>
            <div className="before-after-divider" style={{ left: width / 2 }} aria-hidden="true" />
            <span className="before-after-label" style={{ left: width * 0.06, top: height * 0.05 }}>
              Before
            </span>
            <span className="before-after-label" style={{ left: width * 0.56, top: height * 0.05 }}>
              After
            </span>
          </>
        )}
        {!template.halfSplit && decorations && (
          <DecorationLayer
            stickers={page.stickers ?? []}
            textBoxes={page.textBoxes ?? []}
            customStickers={customStickers}
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
