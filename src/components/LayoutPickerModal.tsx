import { Fragment, useEffect, useState } from 'react'
import { SHAPE_FILTERS, STYLE_FILTERS, templateStyleCategory } from '../data/templates'
import type { StyleCategory } from '../data/templates'
import type { Shape, Template, TemplateFamily } from '../types'

/** Families in the order they're shown; anything unlisted sorts to the end. */
const FAMILY_ORDER: TemplateFamily[] = ['Minimal', 'Portfolio', 'Instagram']

interface LayoutPickerModalProps {
  templates: Template[]
  activeId: string | undefined
  maxSlots: number
  /** Hidden for a folded sheet's own two layouts, where filtering would strand the page in its current mode. */
  showFilters: boolean
  title: string
  onPick: (templateId: string) => void
  onClose: () => void
}

/**
 * The full template library, opened deliberately rather than living in the
 * sidebar — 55 layouts two-per-row in a 240px column meant endless scrolling
 * past filter chips before seeing anything. Here they get five or six columns
 * and previews big enough to actually read.
 */
export function LayoutPickerModal({
  templates,
  activeId,
  maxSlots,
  showFilters,
  title,
  onPick,
  onClose,
}: LayoutPickerModalProps) {
  // Filter state is local: it's a way of finding something in this list, not
  // a setting worth remembering once the picker closes.
  const [shape, setShape] = useState<Shape | 'all'>('all')
  const [style, setStyle] = useState<StyleCategory | 'all'>('all')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible = templates
    .filter(
      (t) =>
        (!showFilters || shape === 'all' || t.fits.includes(shape)) &&
        (!showFilters || style === 'all' || templateStyleCategory(t) === style),
    )
    // Grouped so each family heading appears once. The library isn't stored in
    // family order, and at this width a repeating MINIMAL / PORTFOLIO / MINIMAL
    // run of headings reads as a mistake.
    .slice()
    .sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family))

  let lastFamily: TemplateFamily | null = null

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose a layout" onClick={onClose}>
      <div className="library-card layout-picker-card" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2 className="library-title">
            {title} <span className="count mono">{visible.length}</span>
          </h2>
          <div className="library-actions">
            <button className="btn" onClick={onClose} aria-label="Close layout picker">
              Close
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="layout-picker-filters">
            <div className="shape-chips">
              {SHAPE_FILTERS.map((s) => (
                <button
                  key={s.id}
                  className={`shape-chip${shape === s.id ? ' active' : ''}`}
                  data-shape={s.id}
                  onClick={() => setShape(s.id)}
                  aria-pressed={shape === s.id}
                >
                  {s.id !== 'all' && <span className="glyph" />}
                  {s.label}
                </button>
              ))}
            </div>
            <div className="style-chips">
              {STYLE_FILTERS.map((s) => (
                <button
                  key={s.id}
                  className={`style-chip${style === s.id ? ' active' : ''}`}
                  onClick={() => setStyle(s.id)}
                  aria-pressed={style === s.id}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="empty-note">No layouts match those filters.</p>
        ) : (
          <div className="layout-picker-grid">
            {visible.map((template) => {
              const showFamily = template.family !== lastFamily
              lastFamily = template.family
              const isActive = activeId === template.id
              const span = template.span ?? 1
              // Density is per slide, so a 3-wide strip carrying six photos is
              // two per slide, not six.
              const tooDense = template.slots.length / span > maxSlots
              return (
                <Fragment key={template.id}>
                  {showFamily && <div className="family-label">{template.family}</div>}
                  <button
                    className={`tmpl${isActive ? ' active' : ''}`}
                    onClick={() => {
                      onPick(template.id)
                      onClose()
                    }}
                    disabled={tooDense}
                    title={
                      tooDense
                        ? `Needs a larger book — ${template.slots.length} photos exceeds this size's limit of ${maxSlots}`
                        : span > 1
                          ? `${template.label} — one picture across ${span} slides`
                          : template.label
                    }
                    aria-pressed={isActive}
                  >
                    <span className={`icon${span > 1 ? ' spanning' : ''}`}>
                      {template.slots.map((slot, i) => (
                        <span
                          key={i}
                          className="s"
                          style={{
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.w}%`,
                            height: `${slot.h}%`,
                          }}
                        />
                      ))}
                      {span > 1 &&
                        Array.from({ length: span - 1 }, (_, i) => (
                          <span
                            key={`seam-${i}`}
                            className="tmpl-seam"
                            style={{ left: `${((i + 1) / span) * 100}%` }}
                          />
                        ))}
                    </span>
                    <span className="label">{template.label}</span>
                  </button>
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
