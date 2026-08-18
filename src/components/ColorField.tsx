import { useEffect, useRef, useState } from 'react'
import { alphaOf, applyHexKeepingAlpha, hexOf, normaliseHex } from '../lib/colors'
import { useStore } from '../state/useStore'

export interface Swatch {
  id: string
  color: string
  label: string
}

/**
 * The one colour control, used everywhere a colour is chosen.
 *
 * Three ways to the same value, in the order people reach for them: the
 * palette for speed, a hex box for a colour you already know, and the OS
 * colour wheel for browsing (which on most systems also brings an eyedropper,
 * so a colour can be lifted straight off a photo).
 *
 * Typing applies live but only once the code is valid — a half-finished "7B3"
 * changes nothing rather than flashing the page through wrong colours, and an
 * outright invalid one marks the box instead of throwing an error mid-keystroke.
 */
export function ColorField({
  label,
  value,
  swatches,
  onChange,
  compact,
}: {
  label: string
  /** The colour in force, in whatever form its palette uses — hex or rgba. */
  value: string | undefined
  swatches: Swatch[]
  onChange: (color: string) => void
  /** Drops the label row, for the floating toolbar where space is tight. */
  compact?: boolean
}) {
  const recentColors = useStore((s) => s.recentColors)
  const rememberColor = useStore((s) => s.rememberColor)

  const currentHex = hexOf(value, swatches[0]?.color ?? '#000000')
  const [typed, setTyped] = useState(currentHex.slice(1).toUpperCase())

  // Follow the value when it changes from outside — picking a different
  // sticker, say — but never while the box is mid-edit.
  useEffect(() => {
    setTyped(currentHex.slice(1).toUpperCase())
  }, [currentHex])

  const parsed = normaliseHex(typed)
  const invalid = typed.trim() !== '' && parsed === null
  // Tape and clips are translucent on purpose; a raw hex would flatten them.
  const translucent = alphaOf(value) < 1

  function apply(hex: string, fromPalette: boolean) {
    onChange(applyHexKeepingAlpha(value, hex))
    // Palette colours are always one click away, so remembering them would
    // just crowd out the ones that took effort.
    if (!fromPalette) rememberColor(hex)
  }

  return (
    <div className={`color-field${compact ? ' compact' : ''}`}>
      {!compact && <span className="color-field-label">{label}</span>}

      <div className="color-swatches">
        {swatches.map((s) => (
          <button
            key={s.id}
            className={`color-swatch${hexOf(s.color) === currentHex ? ' active' : ''}`}
            style={{ background: s.color }}
            onClick={() => apply(hexOf(s.color), true)}
            aria-pressed={hexOf(s.color) === currentHex}
            aria-label={`${s.label} ${label.toLowerCase()}`}
            title={s.label}
          />
        ))}
      </div>

      <div className="color-entry">
        <label className={`color-hex${invalid ? ' invalid' : ''}`}>
          <span className="hash" aria-hidden="true">
            #
          </span>
          <input
            type="text"
            value={typed}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-label={`${label} hex code`}
            onChange={(e) => {
              setTyped(e.target.value)
              const next = normaliseHex(e.target.value)
              if (next) onChange(applyHexKeepingAlpha(value, next))
            }}
            onBlur={() => {
              if (parsed) rememberColor(parsed)
              else setTyped(currentHex.slice(1).toUpperCase())
            }}
          />
        </label>
        <span className="color-wheel" style={{ background: currentHex }} title="Pick a colour">
          <input
            type="color"
            value={currentHex}
            onChange={(e) => apply(e.target.value, false)}
            aria-label={`Pick a ${label.toLowerCase()}`}
          />
        </span>
      </div>

      {recentColors.length > 0 && (
        <div className="color-recents">
          <span className="cap">Recent</span>
          {recentColors.map((c) => (
            <button
              key={c}
              className="color-swatch small"
              style={{ background: c }}
              onClick={() => apply(c, true)}
              aria-label={`Reuse ${c.toUpperCase()}`}
              title={c.toUpperCase()}
            />
          ))}
        </div>
      )}

      {translucent && !compact && (
        <p className="color-note">Kept see-through, so the photo still shows underneath.</p>
      )}
    </div>
  )
}

/**
 * The same field behind a swatch button, for the floating toolbar — which is a
 * single horizontal row and has no room for a stacked palette, hex box and
 * recents. Closes on outside click or Escape, like the other menus.
 */
export function ColorPopover({
  label,
  value,
  swatches,
  onChange,
  title,
}: {
  label: string
  value: string | undefined
  swatches: Swatch[]
  onChange: (color: string) => void
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="color-pop" ref={ref}>
      <button
        className="ctx-btn color-pop-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={title ?? label}
      >
        <span className="color-pop-chip" style={{ background: value ?? 'transparent' }} />
      </button>
      {open && (
        <div className="color-pop-panel" role="dialog" aria-label={label}>
          <ColorField label={label} value={value} swatches={swatches} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
