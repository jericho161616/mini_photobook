import { useState } from 'react'
import { getTemplate } from '../data/templates'
import { isOverlaySlot, MAX_ZOOM, MIN_ZOOM } from '../lib/imageUtils'
import { useStore } from '../state/useStore'
import type { Placement, PhotoFilter } from '../types'
import { DEFAULT_TAPE_COLOR } from './AttachmentGraphic'

const FILTERS: { id: PhotoFilter | 'none'; label: string }[] = [
  { id: 'none', label: 'Color' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'negative', label: 'Negative' },
  { id: 'film', label: 'Film' },
  { id: 'paper', label: 'Paper' },
]

const FRAMES: { id: 'none' | 'hairline' | 'polaroid' | 'stamp'; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'hairline', label: 'Hairline' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'stamp', label: 'Stamp' },
]

const ATTACHMENTS: { id: 'none' | NonNullable<Placement['attachment']>; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'tape', label: 'Tape' },
  { id: 'clip', label: 'Clip' },
  { id: 'paperclip', label: 'Paperclip' },
]

const TAPE_COLORS = [
  { id: 'cream', color: DEFAULT_TAPE_COLOR, label: 'Cream' },
  { id: 'blush', color: 'rgba(227, 184, 176, 0.85)', label: 'Blush' },
  { id: 'sage', color: 'rgba(185, 196, 168, 0.85)', label: 'Sage' },
  { id: 'brass', color: 'rgba(169, 130, 47, 0.75)', label: 'Brass' },
  { id: 'ink', color: 'rgba(43, 36, 25, 0.7)', label: 'Ink' },
]

const OVERLAY_POSITIONS: { id: NonNullable<Placement['overlayPosition']>; label: string }[] = [
  { id: 'tl', label: 'Top left' },
  { id: 'tc', label: 'Top center' },
  { id: 'tr', label: 'Top right' },
  { id: 'ml', label: 'Middle left' },
  { id: 'mc', label: 'Center' },
  { id: 'mr', label: 'Middle right' },
  { id: 'bl', label: 'Bottom left' },
  { id: 'bc', label: 'Bottom center' },
  { id: 'br', label: 'Bottom right' },
]

/**
 * One styling choice, collapsed to its current value until opened.
 *
 * Deliberately inline rather than in a modal like the layout picker: these are
 * judged against the live photo on the canvas, and a modal would cover the very
 * thing you're looking at.
 */
function InspectorFold({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`inspector-fold${open ? ' open' : ''}`}>
      <button className="inspector-fold-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="chev" aria-hidden="true">
          ▸
        </span>
        {label}
        <span className="val">{value}</span>
      </button>
      {open && <div className="inspector-fold-body">{children}</div>}
    </div>
  )
}

const labelFor = <T extends string>(options: { id: T; label: string }[], id: T) =>
  options.find((o) => o.id === id)?.label ?? '—'

export function SlotInspector() {
  const pages = useStore((s) => s.pages)
  const photos = useStore((s) => s.photos)
  const selected = useStore((s) => s.selected)
  const updatePlacement = useStore((s) => s.updatePlacement)
  const clearSlot = useStore((s) => s.clearSlot)

  const selectedPage = selected ? pages[selected.pageIndex] : undefined
  const placement = selected
    ? selected.halfIndex !== undefined
      ? selectedPage?.halves?.[selected.halfIndex].placements[selected.slotIndex]
      : selectedPage?.placements[selected.slotIndex]
    : null
  const photo = placement ? photos.find((p) => p.id === placement.photoId) : undefined

  const templateId =
    selected?.halfIndex !== undefined
      ? selectedPage?.halves?.[selected.halfIndex].templateId
      : selectedPage?.templateId
  const template = templateId ? getTemplate(templateId) : undefined
  const isOverlay = !!(template && selected && isOverlaySlot(template, selected.slotIndex))
  const isPosterSlot = isOverlay && template?.decoration === 'poster'

  return (
    <section className="panel">
      <h2>Selected Photo</h2>

      {!selected ? (
        <p className="empty-note">Click a slot on the page to adjust the photo inside it.</p>
      ) : !placement || !photo ? (
        <p className="empty-note">
          This slot is empty. Drag a photo onto it, or click it for a quick picker of your
          unplaced photos.
        </p>
      ) : (
        <>
          <p className="hint" title={photo.name}>
            {photo.name.length > 28 ? `${photo.name.slice(0, 26)}…` : photo.name}
            <br />
            <span className="mono">
              {photo.width}×{photo.height}
            </span>
          </p>

          <p className="cluster-title">Crop</p>
          <div className="inspector-row">
            <label htmlFor="zoom">Zoom</label>
            <input
              id="zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={placement.zoom}
              onChange={(e) => updatePlacement(selected, { zoom: Number(e.target.value) })}
            />
            <span className="value mono">{placement.zoom.toFixed(2)}×</span>
          </div>

          <p className="cluster-title">Style</p>
          <InspectorFold label="Filter" value={labelFor(FILTERS, placement.filter ?? 'none')}>
            <div className="filter-chips-row">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`filter-chip-btn${(placement.filter ?? 'none') === f.id ? ' active' : ''}`}
                  onClick={() => updatePlacement(selected, { filter: f.id === 'none' ? undefined : f.id })}
                  aria-pressed={(placement.filter ?? 'none') === f.id}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </InspectorFold>

          <InspectorFold label="Frame" value={labelFor(FRAMES, placement.frame ?? 'none')}>
            <div className="filter-chips-row">
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  className={`filter-chip-btn${(placement.frame ?? 'none') === f.id ? ' active' : ''}`}
                  onClick={() => updatePlacement(selected, { frame: f.id === 'none' ? undefined : f.id })}
                  aria-pressed={(placement.frame ?? 'none') === f.id}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </InspectorFold>

          {!isPosterSlot && (
            <InspectorFold label="Attachment" value={labelFor(ATTACHMENTS, placement.attachment ?? 'none')}>
              <div className="filter-chips-row">
                {ATTACHMENTS.map((a) => (
                  <button
                    key={a.id}
                    className={`filter-chip-btn${(placement.attachment ?? 'none') === a.id ? ' active' : ''}`}
                    onClick={() => updatePlacement(selected, { attachment: a.id === 'none' ? undefined : a.id })}
                    aria-pressed={(placement.attachment ?? 'none') === a.id}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </InspectorFold>
          )}

          {(isPosterSlot || placement.attachment === 'tape') && (
            <InspectorFold
              label="Tape color"
              value={TAPE_COLORS.find((t) => t.color === placement.attachmentColor)?.label ?? 'Cream'}
            >
              <div className="filter-chips-row">
                {TAPE_COLORS.map((t) => (
                  <button
                    key={t.id}
                    className={`filter-chip-btn${placement.attachmentColor === t.color ? ' active' : ''}`}
                    onClick={() => updatePlacement(selected, { attachmentColor: t.color })}
                    aria-pressed={placement.attachmentColor === t.color}
                    title={t.label}
                  >
                    <span className="tint-swatch" style={{ background: t.color }} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </InspectorFold>
          )}

          <p className="cluster-title">Position</p>
          {isOverlay && (
            <div className="inspector-row">
              <label>Position</label>
              <div className="overlay-pos-grid">
                {OVERLAY_POSITIONS.map((p) => (
                  <button
                    key={p.id}
                    className={`overlay-pos-btn${placement.overlayPosition === p.id ? ' active' : ''}`}
                    onClick={() => updatePlacement(selected, { overlayPosition: p.id })}
                    aria-pressed={placement.overlayPosition === p.id}
                    aria-label={p.label}
                    title={p.label}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="inspector-row">
            <label htmlFor="tilt">Tilt</label>
            <input
              id="tilt"
              type="range"
              min={-20}
              max={20}
              step={1}
              value={placement.rotation ?? 0}
              onChange={(e) => updatePlacement(selected, { rotation: Number(e.target.value) || undefined })}
            />
            <span className="value mono">{placement.rotation ?? 0}°</span>
          </div>

          <div className="slot-controls">
            <button
              className="btn"
              onClick={() => updatePlacement(selected, { zoom: 1, offsetX: 0, offsetY: 0 })}
            >
              Recenter
            </button>
            <button className="btn" onClick={() => clearSlot(selected)}>
              Remove
            </button>
          </div>
          <p className="del-hint">
            or press <kbd>Delete</kbd> / <kbd>Backspace</kbd>
          </p>
        </>
      )}
    </section>
  )
}
