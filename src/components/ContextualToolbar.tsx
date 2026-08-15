import { useLayoutEffect, useRef, useState } from 'react'
import { FONT_OPTIONS, FONT_SIZE_OPTIONS } from '../data/fonts'
import { decorationHost } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { PhotoBox, PhotoFilter, Sticker, TextBox, TextStyle } from '../types'
import { isTapeSticker } from './DecorationLayer'

/** Gap between the selection's own edge and the bar, in px. */
const OFFSET_PX = 12
/** Kept clear of the canvas edges so the bar never sits half off-screen or over the top bar. */
const MARGIN_PX = 10

const STICKER_COLORS = [
  { id: 'brass', hex: '#a9822f', label: 'Brass' },
  { id: 'ink', hex: '#4a3f2c', label: 'Ink' },
  { id: 'clay', hex: '#a8483f', label: 'Clay' },
  { id: 'sage', hex: '#6b7f5e', label: 'Sage' },
  { id: 'sky', hex: '#5b7c99', label: 'Sky' },
  { id: 'plum', hex: '#a8628f', label: 'Plum' },
]

const ALIGNS: { id: TextBox['align']; label: string; title: string }[] = [
  { id: 'left', label: '⟸', title: 'Align left' },
  { id: 'center', label: '☰', title: 'Align center' },
  { id: 'right', label: '⟹', title: 'Align right' },
]

const ROTATE_STEP_DEG = 15

const SIZE_TITLES: Record<string, string> = { sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' }

/** The same treatments a slotted photo offers, for a freely placed one. */
const PHOTO_FILTERS: { id: PhotoFilter | undefined; label: string }[] = [
  { id: undefined, label: 'Colour' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'film', label: 'Film' },
  { id: 'paper', label: 'Paper' },
]

const PHOTO_FRAMES: { id: 'hairline' | 'polaroid' | 'stamp' | undefined; label: string }[] = [
  { id: undefined, label: 'None' },
  { id: 'hairline', label: 'Hairline' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'stamp', label: 'Stamp' },
]

/**
 * Measures the currently selected decoration in viewport coordinates.
 *
 * Reads it back out of the DOM rather than threading page geometry down
 * through SpreadCanvas → PageView → DecorationLayer: the element already
 * knows exactly where it landed, including the page's own scale and
 * whichever half of a folded sheet it sits in. Re-measures whenever the
 * decoration's own box changes, which is what makes the bar track a drag.
 */
function useAnchorRect(x: number | undefined, y: number | undefined, w: number | undefined, h: number | undefined, id: string | undefined) {
  const [anchor, setAnchor] = useState<{ rect: DOMRect; areaTop: number; areaBottom: number } | null>(null)

  useLayoutEffect(() => {
    if (!id) {
      setAnchor(null)
      return
    }
    function measure() {
      // The zoom overlay mounts a second copy of the same page while it's
      // open, so the last match in document order is the one on top.
      const nodes = document.querySelectorAll('.decoration.selected')
      const el = nodes[nodes.length - 1] as HTMLElement | undefined
      if (!el) {
        setAnchor(null)
        return
      }
      // The bar is confined to the canvas rather than the whole viewport, so
      // it can never end up floating over the top bar or the filmstrip.
      const area = document.querySelector('.canvas-area')?.getBoundingClientRect()
      setAnchor({
        rect: el.getBoundingClientRect(),
        areaTop: area?.top ?? 0,
        areaBottom: area?.bottom ?? window.innerHeight,
      })
    }
    measure()
    // Capture phase: the canvas scrolls in its own container, not the window.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [x, y, w, h, id])

  return anchor
}

/**
 * The controls for whatever is selected, floating next to it on the canvas
 * instead of sitting in a sidebar panel — so your eye never leaves the thing
 * you're adjusting, and the controls disappear entirely when nothing is
 * selected.
 */
export function ContextualToolbar() {
  const selectedDecoration = useStore((s) => s.selectedDecoration)
  const pages = useStore((s) => s.pages)
  const updateSticker = useStore((s) => s.updateSticker)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updatePhotoBoxPlacement = useStore((s) => s.updatePhotoBoxPlacement)
  const movePhotoBox = useStore((s) => s.movePhotoBox)
  const removeDecoration = useStore((s) => s.removeDecoration)

  const page = selectedDecoration ? pages[selectedDecoration.pageIndex] : undefined
  const host = page && selectedDecoration ? decorationHost(page, selectedDecoration.halfIndex) : undefined

  const sticker: Sticker | undefined =
    selectedDecoration?.kind === 'sticker' ? host?.stickers?.find((s) => s.id === selectedDecoration.id) : undefined
  const textBox: TextBox | undefined =
    selectedDecoration?.kind === 'textBox' ? host?.textBoxes?.find((t) => t.id === selectedDecoration.id) : undefined

  const photoBox: PhotoBox | undefined =
    selectedDecoration?.kind === 'photoBox'
      ? host?.photoBoxes?.find((b) => b.id === selectedDecoration.id)
      : undefined

  const item = sticker ?? textBox ?? photoBox
  const anchor = useAnchorRect(item?.x, item?.y, item?.w, item?.h, item?.id)

  // The bar's own size decides whether it still fits above the selection, so
  // it's measured rather than assumed — the text-box variant is a good deal
  // wider and taller than the sticker one, and it wraps on a narrow window.
  const barRef = useRef<HTMLDivElement>(null)
  const [barSize, setBarSize] = useState({ w: 260, h: 42 })
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    // Guarded so this settles after one extra render instead of looping.
    if (w !== barSize.w || h !== barSize.h) setBarSize({ w, h })
  })

  if (!selectedDecoration || !item || !anchor || page?.locked) return null

  const { rect, areaTop, areaBottom } = anchor

  // Above the selection by default; underneath when sitting above would push
  // the bar out of the canvas and over the top bar.
  const fitsAbove = rect.top - OFFSET_PX - barSize.h >= areaTop + MARGIN_PX
  const flipBelow = !fitsAbove
  const rawTop = flipBelow ? rect.bottom + OFFSET_PX : rect.top - OFFSET_PX
  // Last resort for a selection taller than the canvas: keep the bar inside it.
  const top = flipBelow
    ? Math.min(rawTop, areaBottom - MARGIN_PX - barSize.h)
    : Math.max(rawTop, areaTop + MARGIN_PX + barSize.h)

  // Clamped by half the bar's own width, since it's centered on this point.
  const half = barSize.w / 2
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, MARGIN_PX + half),
    window.innerWidth - MARGIN_PX - half,
  )

  const patchSticker = (patch: Partial<Sticker>) => updateSticker(selectedDecoration, patch)
  const patchText = (patch: Partial<TextBox>) => updateTextBox(selectedDecoration, patch)
  const patchPhoto = (patch: Parameters<typeof updatePhotoBoxPlacement>[1]) =>
    updatePhotoBoxPlacement(selectedDecoration, patch)

  return (
    <div
      ref={barRef}
      className="ctx-toolbar"
      style={{
        top,
        left,
        transform: `translate(-50%, ${flipBelow ? '0' : '-100%'})`,
      }}
      role="toolbar"
      aria-label={sticker ? 'Sticker controls' : 'Text box controls'}
      // The canvas clears the selection on a background mousedown — this bar
      // sits over the canvas, so its own clicks must not count as that.
      onMouseDown={(e) => e.stopPropagation()}
    >
      {photoBox?.placement && (
        <>
          <button
            className="ctx-btn"
            onClick={() => movePhotoBox(selectedDecoration, 'back')}
            title="Send behind the other photo layers"
            aria-label="Send to back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="12" height="12" rx="1" />
              <path d="M9 21h12V9" />
            </svg>
          </button>
          <button
            className="ctx-btn"
            onClick={() => movePhotoBox(selectedDecoration, 'front')}
            title="Bring in front of the other photo layers"
            aria-label="Bring to front"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 15V3h12" />
              <rect x="9" y="9" width="12" height="12" rx="1" />
            </svg>
          </button>
          <span className="ctx-sep" />
          <button
            className="ctx-btn"
            onClick={() => patchPhoto({ rotation: (photoBox.placement!.rotation ?? 0) - ROTATE_STEP_DEG })}
            title={`Rotate left ${ROTATE_STEP_DEG}°`}
            aria-label={`Rotate left ${ROTATE_STEP_DEG} degrees`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
          <button
            className="ctx-btn"
            onClick={() => patchPhoto({ rotation: (photoBox.placement!.rotation ?? 0) + ROTATE_STEP_DEG })}
            title={`Rotate right ${ROTATE_STEP_DEG}°`}
            aria-label={`Rotate right ${ROTATE_STEP_DEG} degrees`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 4v5h-5" />
            </svg>
          </button>
          <span className="ctx-sep" />
          {PHOTO_FILTERS.map((f) => (
            <button
              key={f.label}
              className={`ctx-chip${(photoBox.placement!.filter ?? undefined) === f.id ? ' active' : ''}`}
              onClick={() => patchPhoto({ filter: f.id })}
              aria-pressed={(photoBox.placement!.filter ?? undefined) === f.id}
              title={`${f.label} treatment`}
            >
              {f.label}
            </button>
          ))}
          <span className="ctx-sep" />
          {PHOTO_FRAMES.map((f) => (
            <button
              key={f.label}
              className={`ctx-chip${(photoBox.placement!.frame ?? undefined) === f.id ? ' active' : ''}`}
              onClick={() => patchPhoto({ frame: f.id })}
              aria-pressed={(photoBox.placement!.frame ?? undefined) === f.id}
              title={`${f.label} frame`}
            >
              {f.label}
            </button>
          ))}
        </>
      )}

      {sticker && (
        <>
          <button
            className="ctx-btn"
            onClick={() => patchSticker({ rotation: (sticker.rotation ?? 0) - ROTATE_STEP_DEG })}
            title={`Rotate left ${ROTATE_STEP_DEG}°`}
            aria-label={`Rotate left ${ROTATE_STEP_DEG} degrees`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          </button>
          <button
            className="ctx-btn"
            onClick={() => patchSticker({ rotation: (sticker.rotation ?? 0) + ROTATE_STEP_DEG })}
            title={`Rotate right ${ROTATE_STEP_DEG}°`}
            aria-label={`Rotate right ${ROTATE_STEP_DEG} degrees`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 4v5h-5" />
            </svg>
          </button>
          <button
            className={`ctx-btn${sticker.flipX ? ' active' : ''}`}
            onClick={() => patchSticker({ flipX: !sticker.flipX })}
            title="Flip horizontally"
            aria-pressed={sticker.flipX ?? false}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18" />
              <path d="M8 8l-4 4 4 4" />
              <path d="M16 8l4 4-4 4" />
            </svg>
          </button>
          {(sticker.rotation || sticker.flipX) && (
            <button
              className="ctx-btn ctx-text-btn"
              onClick={() => patchSticker({ rotation: undefined, flipX: undefined })}
              title="Reset tilt and mirror"
            >
              Reset
            </button>
          )}

          <span className="ctx-sep" />

          {/*
           * A drawn sticker is the user's own artwork, often multi-colored —
           * flattening it to a single hue looks wrong, so it gets opacity
           * instead of the color swatches the built-in glyphs use.
           */}
          {sticker.type === 'custom' ? (
            <label className="ctx-slider" title="Opacity">
              <span className="ctx-slider-label">Opacity</span>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={sticker.opacity ?? 100}
                onChange={(e) => patchSticker({ opacity: Number(e.target.value) })}
                aria-label="Sticker opacity"
              />
            </label>
          ) : (
            <>
              <button
                className={`ctx-swatch ctx-swatch-default${sticker.color ? '' : ' active'}`}
                onClick={() => patchSticker({ color: undefined })}
                title="Original color"
                aria-pressed={!sticker.color}
              />
              {STICKER_COLORS.map((c) => (
                <button
                  key={c.id}
                  className={`ctx-swatch${sticker.color === c.hex ? ' active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => patchSticker({ color: c.hex })}
                  title={c.label}
                  aria-label={`${c.label}${isTapeSticker(sticker.type) ? ' tape' : ''}`}
                  aria-pressed={sticker.color === c.hex}
                />
              ))}
            </>
          )}
        </>
      )}

      {textBox && (
        <>
          <select
            className="ctx-select"
            value={textBox.font}
            onChange={(e) => patchText({ font: e.target.value as TextStyle['font'] })}
            aria-label="Font"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                {f.label}
              </option>
            ))}
          </select>

          <span className="ctx-sep" />

          <button
            className={`ctx-btn ctx-text-btn${textBox.bold ? ' active' : ''}`}
            onClick={() => patchText({ bold: !textBox.bold })}
            title="Bold"
            aria-pressed={textBox.bold}
            style={{ fontWeight: 700 }}
          >
            B
          </button>
          <button
            className={`ctx-btn ctx-text-btn${textBox.italic ? ' active' : ''}`}
            onClick={() => patchText({ italic: !textBox.italic })}
            title="Italic"
            aria-pressed={textBox.italic ?? false}
            style={{ fontStyle: 'italic' }}
          >
            I
          </button>

          <span className="ctx-sep" />

          {FONT_SIZE_OPTIONS.map((s) => (
            <button
              key={s.id}
              className={`ctx-btn ctx-text-btn${(textBox.size ?? 'md') === s.id ? ' active' : ''}`}
              onClick={() => patchText({ size: s.id })}
              title={`${SIZE_TITLES[s.id] ?? s.label} text`}
              aria-pressed={(textBox.size ?? 'md') === s.id}
            >
              {s.label}
            </button>
          ))}

          <span className="ctx-sep" />

          {ALIGNS.map((a) => (
            <button
              key={a.id}
              className={`ctx-btn ctx-text-btn${textBox.align === a.id ? ' active' : ''}`}
              onClick={() => patchText({ align: a.id })}
              title={a.title}
              aria-pressed={textBox.align === a.id}
            >
              {a.label}
            </button>
          ))}
        </>
      )}

      <span className="ctx-sep" />

      <button
        className="ctx-btn ctx-danger"
        onClick={() => removeDecoration(selectedDecoration)}
        title={sticker ? 'Remove sticker' : 'Remove text box'}
        aria-label={sticker ? 'Remove sticker' : 'Remove text box'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
