import { Fragment } from 'react'
import { getSize } from '../data/sizes'
import { SHAPE_FILTERS, TEMPLATES } from '../data/templates'
import { useStore } from '../state/useStore'
import type { TemplateFamily } from '../types'

export function TemplatePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const shapeFilter = useStore((s) => s.shapeFilter)
  const setShapeFilter = useStore((s) => s.setShapeFilter)
  const applyTemplate = useStore((s) => s.applyTemplate)

  const size = getSize(sizeId)
  const currentPage = pages[activePageIndex]

  const visible = TEMPLATES.filter(
    (t) => shapeFilter === 'all' || t.fits.includes(shapeFilter),
  )

  let lastFamily: TemplateFamily | null = null

  return (
    <section className="panel">
      <h2>Layout</h2>
      <p className="hint">
        Up to <span className="mono">{size.maxPhotosPerPage}</span> photos per page at this size.
        Filter by shape and mix them freely across the book.
      </p>

      <div className="shape-chips">
        {SHAPE_FILTERS.map((shape) => (
          <button
            key={shape.id}
            className={`shape-chip${shapeFilter === shape.id ? ' active' : ''}`}
            data-shape={shape.id}
            onClick={() => setShapeFilter(shape.id)}
            aria-pressed={shapeFilter === shape.id}
          >
            {shape.id !== 'all' && <span className="glyph" />}
            {shape.label}
          </button>
        ))}
      </div>

      <div className="template-grid">
        {visible.map((template) => {
          const showFamily = template.family !== lastFamily
          lastFamily = template.family
          const isActive = currentPage?.templateId === template.id
          const tooDense = template.slots.length > size.maxPhotosPerPage

          return (
            <Fragment key={template.id}>
              {showFamily && <div className="family-label">{template.family}</div>}
              <button
                className={`tmpl${isActive ? ' active' : ''}`}
                onClick={() => applyTemplate(template.id)}
                disabled={tooDense}
                title={
                  tooDense
                    ? `Needs a larger book — ${template.slots.length} photos exceeds this size's limit of ${size.maxPhotosPerPage}`
                    : template.label
                }
                aria-pressed={isActive}
              >
                <span className="icon">
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
                </span>
                <span className="label">{template.label}</span>
              </button>
            </Fragment>
          )
        })}
      </div>
    </section>
  )
}
