import { DEFAULT_TEXT_STYLE, FONT_OPTIONS, FONT_SIZE_PRESETS, fontSizeNumber, fontSizeScale, fontStack } from '../data/fonts'
import { foldOrientationForSize, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import { resolvePageSize } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { TextStyle } from '../types'
import { FontManager } from './FontManager'
import { PanelSection } from './PanelSection'
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../types'

/**
 * A free-form note for the active page — a date, a place, a line of text.
 * Only shows up when that page's layout actually reserves room for one;
 * most layouts don't, and that's fine, the text is always optional anyway.
 *
 * On a Split at Fold page each half carries its own note, so this follows
 * whichever half the Layout panel is currently on.
 */
export function PageTextPanel() {
  const pages = useStore((s) => s.pages)
  const customFonts = useStore((s) => s.customFonts)
  const sizeId = useStore((s) => s.sizeId)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const activeHalfIndex = useStore((s) => s.activeHalfIndex)
  const setPageText = useStore((s) => s.setPageText)
  const setHalfText = useStore((s) => s.setHalfText)
  const setPageTextStyle = useStore((s) => s.setPageTextStyle)
  const setHalfTextStyle = useStore((s) => s.setHalfTextStyle)

  const page = pages[activePageIndex]
  if (!page) return null

  const half = getTemplate(page.templateId).halfSplit ? page.halves?.[activeHalfIndex] : undefined
  const template = getTemplate(half ? half.templateId : page.templateId)

  // Not `return null`: fonts belong to the book, not to one page, so they
  // can't vanish because the current layout has nowhere to put a note — and
  // returning nothing left the drawer showing a bare "NOTE" header anyway.
  if (!template.textSlot) {
    return (
      <section className="panel">
        <h2>Page Note</h2>
        <p className="hint">
          This layout has no place for a note. Pick a layout with a caption area, or add a free
          text box from Decorate.
        </p>
        <PanelSection title="Fonts" defaultOpen={false}>
          <FontManager />
        </PanelSection>
      </section>
    )
  }

  const foldOrientation = foldOrientationForSize(resolvePageSize(page, getSize(sizeId)).id)
  const halfName = half
    ? (foldOrientation === 'horizontal'
        ? ['the top half', 'the bottom half']
        : ['the left half', 'the right half'])[activeHalfIndex]
    : null

  const text = (half ? half.text : page.text) ?? ''
  const style = (half ? half.textStyle : page.textStyle) ?? DEFAULT_TEXT_STYLE
  const setText = (value: string) =>
    half ? setHalfText(activePageIndex, activeHalfIndex, value) : setPageText(activePageIndex, value)
  const setStyle = (next: TextStyle) =>
    half ? setHalfTextStyle(activePageIndex, activeHalfIndex, next) : setPageTextStyle(activePageIndex, next)

  return (
    <section className="panel">
      <h2>Page Note</h2>
      <p className="hint">
        {halfName
          ? `Optional — shows under the photo on ${halfName} of this sheet.`
          : 'Optional — shows under the photo on this page only.'}
      </p>
      <textarea
        className="page-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Santorini, June 2024"
        disabled={page.locked}
        rows={2}
        maxLength={120}
      />

      <div className="text-style-row">
        <select
          className="font-picker"
          value={style.font}
          onChange={(e) => setStyle({ ...style, font: e.target.value as TextStyle['font'] })}
          disabled={page.locked}
          aria-label="Note font"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
              {f.label}
            </option>
          ))}
          {customFonts.length > 0 && (
            <optgroup label="Your fonts">
              {customFonts.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: `"${f.family}", Georgia, serif` }}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          className={`bold-btn${style.bold ? ' active' : ''}`}
          onClick={() => setStyle({ ...style, bold: !style.bold })}
          disabled={page.locked}
          aria-pressed={style.bold}
          title={style.bold ? 'Remove bold' : 'Make bold'}
        >
          B
        </button>
      </div>
      <div className="inspector-row size-picker-row">
        <label htmlFor="note-size">Size</label>
        <input
          id="note-size"
          type="number"
          className="size-number"
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          step={5}
          value={fontSizeNumber(style.size)}
          disabled={page.locked}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) {
              setStyle({ ...style, size: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n)) })
            }
          }}
        />
        <span className="value mono">%</span>
        {FONT_SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={`filter-chip-btn${fontSizeNumber(style.size) === preset.value ? ' active' : ''}`}
            onClick={() => setStyle({ ...style, size: preset.value })}
            disabled={page.locked}
            aria-pressed={fontSizeNumber(style.size) === preset.value}
            title={`${preset.label} — ${preset.value}%`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {/* Fonts belong with the text controls: this is the panel you are in
          when you discover the eight built-ins aren't the one you wanted. */}
      <PanelSection title="Fonts" defaultOpen={false}>
        <FontManager />
      </PanelSection>

      {text.trim() && (
        <p
          className="text-style-preview"
          style={{
            fontFamily: fontStack(style.font),
            fontWeight: style.bold ? 700 : 400,
            fontSize: 13 * fontSizeScale(style.size),
          }}
        >
          {text}
        </p>
      )}
    </section>
  )
}
