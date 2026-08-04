import { DEFAULT_TEXT_STYLE, FONT_OPTIONS, FONT_SIZE_OPTIONS, fontSizeScale, fontStack } from '../data/fonts'
import { foldOrientationForSize, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import { resolvePageSize } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { TextStyle } from '../types'

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

  if (!template.textSlot) return null

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
      <div className="filter-chips-row size-picker-row">
        {FONT_SIZE_OPTIONS.map((s) => (
          <button
            key={s.id}
            className={`filter-chip-btn${(style.size ?? 'md') === s.id ? ' active' : ''}`}
            onClick={() => setStyle({ ...style, size: s.id })}
            disabled={page.locked}
            aria-pressed={(style.size ?? 'md') === s.id}
            title={`${s.label === 'S' ? 'Small' : s.label === 'M' ? 'Medium' : s.label === 'L' ? 'Large' : 'Extra large'} text`}
          >
            {s.label}
          </button>
        ))}
      </div>
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
