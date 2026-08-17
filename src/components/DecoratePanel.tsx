import { useRef, useState } from 'react'
import { getTemplate, isFullSheetTemplate } from '../data/templates'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import type { Page, PhotoFilter, StickerType } from '../types'
import { BackgroundPhotoModal } from './BackgroundPhotoModal'
import { DoodlePad } from './DoodlePad'
import { PanelSection } from './PanelSection'
import { StickerGlyph } from './StickerGlyph'
import { Icon } from './Icon'

/** A handful of tinted "cardstock" options — swatches, not a full color picker, to keep this simple. */
const PAGE_TINTS: { id: string; color: string; label: string }[] = [
  { id: 'warm', color: '#e8ded0', label: 'Warm' },
  { id: 'sage', color: '#dfe3d8', label: 'Sage' },
  { id: 'blush', color: '#e3d6d0', label: 'Blush' },
  { id: 'dusty-blue', color: '#d8dfe3', label: 'Dusty blue' },
  { id: 'deep-linen', color: '#cabb92', label: 'Deep linen' },
  { id: 'night', color: '#141414', label: 'Night' },
  { id: 'midnight-navy', color: '#171d29', label: 'Midnight navy' },
]

const BG_FILTERS: { id: PhotoFilter | 'none'; label: string }[] = [
  { id: 'none', label: 'Color' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'negative', label: 'Negative' },
  { id: 'film', label: 'Film' },
  { id: 'paper', label: 'Paper' },
]

const COVERAGE_OPTIONS: { id: NonNullable<Page['backgroundPhotoCoverage']>; label: string; title: string }[] = [
  { id: 'full', label: 'Whole', title: 'Whole page' },
  { id: 'left', label: 'Left', title: 'Left half' },
  { id: 'right', label: 'Right', title: 'Right half' },
  { id: 'top', label: 'Top', title: 'Top half' },
  { id: 'bottom', label: 'Bottom', title: 'Bottom half' },
]

/** Longest edge kept for an uploaded sticker image — plenty for a decoration, and keeps the book's own storage small. */
const UPLOADED_STICKER_MAX_EDGE = 640

/** Downscales (if needed) and re-encodes as PNG, so an uploaded photo-sized image doesn't bloat the book. */
async function readStickerFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, UPLOADED_STICKER_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

const STICKERS: { type: StickerType; label: string }[] = [
  { type: 'tape-yellow', label: 'Tape' },
  { type: 'tape-pink', label: 'Tape' },
  { type: 'tape-sage', label: 'Tape' },
  { type: 'heart', label: 'Heart' },
  { type: 'star', label: 'Star' },
  { type: 'arrow', label: 'Arrow' },
]

/**
 * Stickers and free-form text boxes, placed anywhere on the page rather than
 * tied to a template's fixed slots — a wall poster, a doodle, a caption laid
 * right across a photo.
 *
 * Styling a *selected* sticker or text box lives in ContextualToolbar instead,
 * floating beside the thing itself — this panel is only for placing new ones
 * and for whole-page styling.
 */
export function DecoratePanel() {
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const activeHalfIndex = useStore((s) => s.activeHalfIndex)
  const addSticker = useStore((s) => s.addSticker)
  const addTextBox = useStore((s) => s.addTextBox)
  const addCustomSticker = useStore((s) => s.addCustomSticker)
  const photos = useStore((s) => s.photos)
  const setPageBackground = useStore((s) => s.setPageBackground)
  const setPageBackgroundPhoto = useStore((s) => s.setPageBackgroundPhoto)
  const togglePageLock = useStore((s) => s.togglePageLock)
  const setPageBackgroundDim = useStore((s) => s.setPageBackgroundDim)
  const setPageBackgroundOpacity = useStore((s) => s.setPageBackgroundOpacity)
  const setPageBackgroundGrain = useStore((s) => s.setPageBackgroundGrain)
  const setPageBackgroundCoverage = useStore((s) => s.setPageBackgroundCoverage)
  const setPageBackgroundFilter = useStore((s) => s.setPageBackgroundFilter)
  const setPageMarginScale = useStore((s) => s.setPageMarginScale)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [browsingPhotos, setBrowsingPhotos] = useState(false)
  const [photoGridOpen, setPhotoGridOpen] = useState(true)

  const page = pages[activePageIndex]
  if (!page) return null

  const template = getTemplate(page.templateId)
  const isSplit = Boolean(template.halfSplit && page.halves)
  const targetHalf = isSplit ? activeHalfIndex : undefined

  return (
    <section className="panel">
      <h2>Decorate</h2>
      {/* A locked page greys out every control below with no reason given,
          which reads as the panel being broken rather than the page being
          protected. Say which it is, and offer the way out. */}
      {page.locked ? (
        <p className="hint hint-blocked">
          This page is locked, so nothing can be added to it. Unlock it to
          decorate.{' '}
          <button className="link-btn" onClick={() => togglePageLock(activePageIndex)}>
            Unlock page {activePageIndex + 1}
          </button>
        </p>
      ) : (
        <p className="hint">
          {isSplit
            ? 'Placed on whichever half is selected in the Layout panel above.'
            : 'Drag onto the page, resize from the corner, drag the × to remove.'}
        </p>
      )}

      <PanelSection title="Page styling" defaultOpen>
        <div className="inspector-row">
          <label>Background</label>
          <div className="filter-chips-row">
            <button
              className={`filter-chip-btn${!page.backgroundColor && !page.backgroundPhotoId ? ' active' : ''}`}
              onClick={() => setPageBackground(activePageIndex, undefined)}
              aria-pressed={!page.backgroundColor && !page.backgroundPhotoId}
            >
              None
            </button>
            {PAGE_TINTS.map((tint) => (
              <button
                key={tint.id}
                className={`filter-chip-btn${page.backgroundColor === tint.color ? ' active' : ''}`}
                onClick={() => setPageBackground(activePageIndex, tint.color)}
                aria-pressed={page.backgroundColor === tint.color}
                title={tint.label}
              >
                <span className="tint-swatch" style={{ background: tint.color }} aria-hidden="true" />
              </button>
            ))}
            {!isFullSheetTemplate(template) && (
              <button
                className={`filter-chip-btn${page.backgroundPhotoId ? ' active' : ''}`}
                onClick={() => setPageBackgroundPhoto(activePageIndex, page.backgroundPhotoId ?? photos[0]?.id)}
                aria-pressed={!!page.backgroundPhotoId}
                disabled={photos.length === 0}
                title={photos.length === 0 ? 'Add photos first' : "Use a photo as this page's background"}
              >
                Photo
              </button>
            )}
          </div>
        </div>

        {page.backgroundPhotoId !== undefined && (
          <div className="inspector-row bg-photo-row">
            <div className="bg-photo-row-head">
              <button
                className={`bg-photo-toggle${photoGridOpen ? '' : ' collapsed'}`}
                onClick={() => setPhotoGridOpen((v) => !v)}
                aria-expanded={photoGridOpen}
              >
                <span className="chev" aria-hidden="true">
                  <Icon name="chevronDown" size={12} />
                </span>
                Choose photo
              </button>
              <button
                className="browse-photos-btn"
                onClick={() => setBrowsingPhotos(true)}
                disabled={photos.length === 0}
              >
                <Icon name="expand" size={12} /> Browse all
              </button>
            </div>
            {photoGridOpen && (
              <div className="bg-photo-grid">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    className={`bg-photo-thumb${page.backgroundPhotoId === p.id ? ' active' : ''}`}
                    style={{ backgroundImage: `url(${photoThumbUrl(p)})` }}
                    onClick={() => setPageBackgroundPhoto(activePageIndex, p.id)}
                    aria-pressed={page.backgroundPhotoId === p.id}
                    title={p.name}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {browsingPhotos && (
          <BackgroundPhotoModal pageIndex={activePageIndex} onClose={() => setBrowsingPhotos(false)} />
        )}

        {page.backgroundPhotoId !== undefined && (
          <div className="inspector-row">
            <label>Covers</label>
            <div className="filter-chips-row">
              {COVERAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`filter-chip-btn${(page.backgroundPhotoCoverage ?? 'full') === opt.id ? ' active' : ''}`}
                  onClick={() => setPageBackgroundCoverage(activePageIndex, opt.id === 'full' ? undefined : opt.id)}
                  aria-pressed={(page.backgroundPhotoCoverage ?? 'full') === opt.id}
                  title={opt.title}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {page.backgroundPhotoId !== undefined && (
          <div className="inspector-row">
            <label>Filter</label>
            <div className="filter-chips-row">
              {BG_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`filter-chip-btn${(page.backgroundPhotoFilter ?? 'none') === f.id ? ' active' : ''}`}
                  onClick={() => setPageBackgroundFilter(activePageIndex, f.id === 'none' ? undefined : f.id)}
                  aria-pressed={(page.backgroundPhotoFilter ?? 'none') === f.id}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Opacity fades the photo towards the paper; Darken lays a scrim over
            it. Both quiet a busy background, but only one keeps its color. */}
        {page.backgroundPhotoId !== undefined && (
          <div className="inspector-row">
            <label htmlFor="bg-opacity">Opacity</label>
            <input
              id="bg-opacity"
              type="range"
              min={10}
              max={100}
              step={5}
              value={page.backgroundPhotoOpacity ?? 100}
              onChange={(e) => setPageBackgroundOpacity(activePageIndex, Number(e.target.value))}
            />
            <span className="value mono">{page.backgroundPhotoOpacity ?? 100}%</span>
          </div>
        )}

        {page.backgroundPhotoId !== undefined && (
          <div className="inspector-row">
            <label htmlFor="bg-grain">Grain</label>
            <input
              id="bg-grain"
              type="range"
              min={0}
              max={100}
              step={5}
              value={page.backgroundGrain ?? 0}
              onChange={(e) => setPageBackgroundGrain(activePageIndex, Number(e.target.value))}
            />
            <span className="value mono">{page.backgroundGrain ?? 0}%</span>
          </div>
        )}

        {page.backgroundPhotoId !== undefined && (
          <div className="inspector-row">
            <label htmlFor="bg-dim">Darken</label>
            <input
              id="bg-dim"
              type="range"
              min={0}
              max={80}
              step={5}
              value={page.backgroundDim ?? 35}
              onChange={(e) => setPageBackgroundDim(activePageIndex, Number(e.target.value))}
            />
            <span className="value mono">{page.backgroundDim ?? 35}%</span>
          </div>
        )}

        <div className="inspector-row">
          <label htmlFor="margin-scale">Margin</label>
          <input
            id="margin-scale"
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={page.marginScale ?? 1}
            onChange={(e) => setPageMarginScale(activePageIndex, Number(e.target.value))}
          />
          <span className="value mono">{Math.round((page.marginScale ?? 1) * 100)}%</span>
        </div>
      </PanelSection>

      <div className="sticker-tray">
        {STICKERS.map((s) => (
          <button
            key={s.type}
            className="sticker-tray-btn"
            onClick={() => addSticker(activePageIndex, targetHalf, s.type)}
            disabled={page.locked}
            title={`Add ${s.label.toLowerCase()}`}
          >
            <span className={`sticker-glyph-preview sticker-${s.type}`}>
              <StickerGlyph type={s.type} />
            </span>
          </button>
        ))}
      </div>

      <DoodlePad pageIndex={activePageIndex} targetHalf={targetHalf} locked={page.locked} />

      <button
        className="btn add-text-btn"
        onClick={() => uploadInputRef.current?.click()}
        disabled={page.locked}
        title="Add a PNG (or other image) from your own files as a placeable sticker"
      >
        <Icon name="upload" size={14} /> Upload Image
      </button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const dataUrl = await readStickerFile(file)
          addCustomSticker(dataUrl)
        }}
      />

      <button
        className="btn add-text-btn"
        onClick={() => addTextBox(activePageIndex, targetHalf)}
        disabled={page.locked}
      >
        + Add Text
      </button>

    </section>
  )
}
