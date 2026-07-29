import { Fragment } from 'react'
import { foldOrientationForSize, getSize } from '../data/sizes'
import {
  getTemplate,
  MAX_PHOTOS_PER_HALF,
  SHAPE_FILTERS,
  templatesForHalf,
  templatesForSize,
} from '../data/templates'
import { halfShape, resolvePageSize } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { HalfLayout, Template, TemplateFamily } from '../types'

/** A grid of template swatches — reused for both the whole-page picker and each half's own. */
function TemplateGrid({
  templates,
  activeId,
  maxSlots,
  onPick,
}: {
  templates: Template[]
  activeId: string | undefined
  maxSlots: number
  onPick: (templateId: string) => void
}) {
  let lastFamily: TemplateFamily | null = null
  return (
    <div className="template-grid">
      {templates.map((template) => {
        const showFamily = template.family !== lastFamily
        lastFamily = template.family
        const isActive = activeId === template.id
        const tooDense = template.slots.length > maxSlots

        return (
          <Fragment key={template.id}>
            {showFamily && <div className="family-label">{template.family}</div>}
            <button
              className={`tmpl${isActive ? ' active' : ''}`}
              onClick={() => onPick(template.id)}
              disabled={tooDense}
              title={
                tooDense
                  ? `Needs a larger book — ${template.slots.length} photos exceeds this size's limit of ${maxSlots}`
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
  )
}

export function TemplatePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const shapeFilter = useStore((s) => s.shapeFilter)
  const setShapeFilter = useStore((s) => s.setShapeFilter)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const applyHalfTemplate = useStore((s) => s.applyHalfTemplate)

  const bookSize = getSize(sizeId)
  const currentPage = pages[activePageIndex]
  // A page's own orientation override changes which templates actually apply
  // to it (an A4 Folded page only ever offers its fold-aware layouts).
  const size = currentPage ? resolvePageSize(currentPage, bookSize) : bookSize

  const visible = templatesForSize(size).filter(
    (t) => shapeFilter === 'all' || t.fits.includes(shapeFilter),
  )

  const containerTemplate = currentPage ? getTemplate(currentPage.templateId) : undefined
  const isSplit = Boolean(containerTemplate?.halfSplit && currentPage?.halves)
  const foldOrientation = foldOrientationForSize(size.id)
  const halfLabels: [string, string] = foldOrientation === 'horizontal' ? ['Top half', 'Bottom half'] : ['Left half', 'Right half']

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

      <TemplateGrid
        templates={visible}
        activeId={currentPage?.templateId}
        maxSlots={size.maxPhotosPerPage}
        onPick={applyTemplate}
      />

      {isSplit && currentPage?.halves && (
        <div className="half-panels">
          {(['0', '1'] as const).map((key) => {
            const halfIndex = Number(key) as 0 | 1
            const half: HalfLayout = currentPage.halves![halfIndex]
            const shape = halfShape(size)
            return (
              <div className="half-panel" key={halfIndex}>
                <p className="half-panel-title">{halfLabels[halfIndex]}</p>
                <TemplateGrid
                  templates={templatesForHalf(shape)}
                  activeId={half.templateId}
                  maxSlots={MAX_PHOTOS_PER_HALF}
                  onPick={(templateId) => applyHalfTemplate(activePageIndex, halfIndex, templateId)}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
