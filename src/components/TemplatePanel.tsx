import { Fragment, useState } from 'react'
import { foldOrientationForSize, getSize } from '../data/sizes'
import {
  getTemplate,
  MAX_PHOTOS_PER_HALF,
  SHAPE_FILTERS,
  STYLE_FILTERS,
  templateStyleCategory,
  templatesForHalf,
  templatesForSize,
} from '../data/templates'
import { resolvePageSize } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { Shape, Template, TemplateFamily } from '../types'

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

/** A collapsible group within the Layout panel — "Choose a template" vs. "Page styling" answer different questions, so each gets its own disclosure instead of one long scroll. */
function PanelSection({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`panel-section${open ? '' : ' collapsed'}`}>
      <button className="panel-section-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{title}</span>
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && <div className="panel-section-body">{children}</div>}
    </div>
  )
}

export function TemplatePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const shapeFilter = useStore((s) => s.shapeFilter)
  const setShapeFilter = useStore((s) => s.setShapeFilter)
  const styleFilter = useStore((s) => s.styleFilter)
  const setStyleFilter = useStore((s) => s.setStyleFilter)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const applyHalfTemplate = useStore((s) => s.applyHalfTemplate)
  const activeHalfIndex = useStore((s) => s.activeHalfIndex)
  const setActiveHalf = useStore((s) => s.setActiveHalf)
  const setPageBackground = useStore((s) => s.setPageBackground)
  const setPageMarginScale = useStore((s) => s.setPageMarginScale)

  const bookSize = getSize(sizeId)
  const currentPage = pages[activePageIndex]
  // A page's own orientation override changes which templates actually apply
  // to it (an A4 Folded page only ever offers its fold-aware layouts).
  const size = currentPage ? resolvePageSize(currentPage, bookSize) : bookSize

  const byShape = <T extends { fits: Shape[] }>(templates: T[]) =>
    templates.filter((t) => shapeFilter === 'all' || t.fits.includes(shapeFilter))
  const byStyle = (templates: Template[]) =>
    templates.filter((t) => styleFilter === 'all' || templateStyleCategory(t) === styleFilter)

  const visible = byStyle(byShape(templatesForSize(size)))
  const halfTemplates = byStyle(byShape(templatesForHalf()))

  const containerTemplate = currentPage ? getTemplate(currentPage.templateId) : undefined
  const isSplit = Boolean(containerTemplate?.halfSplit && currentPage?.halves)
  const foldOrientation = foldOrientationForSize(size.id)
  const isFolded = Boolean(foldOrientation)
  const halfLabels: [string, string] =
    foldOrientation === 'horizontal' ? ['Top half', 'Bottom half'] : ['Left half', 'Right half']

  // The two sheet templates decide how a folded page is divided, so they're
  // never shape-filtered — filtering them away would strand the page in
  // whichever mode it's already in.
  const sheetTemplates = isFolded ? templatesForSize(size) : visible
  // Shape chips only drive the general library, which a folded page reaches
  // through its halves — so they're pointless on an unsplit folded page.
  const showShapeChips = !isFolded || isSplit

  return (
    <section className="panel">
      <h2>Layout</h2>
      <p className="hint">
        {isFolded ? (
          isSplit ? (
            <>
              Each half of the folded sheet gets its own layout, so nothing lands across the
              crease — up to <span className="mono">{MAX_PHOTOS_PER_HALF}</span> photos per half.
            </>
          ) : (
            <>
              One photo across the whole sheet. It runs over the fold, so keep the subject clear
              of the dashed crease — or split the sheet to lay out each half on its own.
            </>
          )
        ) : (
          <>
            Up to <span className="mono">{size.maxPhotosPerPage}</span> photos per page at this size.
            Filter by shape and mix them freely across the book.
          </>
        )}
      </p>

      <PanelSection title="Choose a template" defaultOpen>
        {showShapeChips && (
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
        )}

        {showShapeChips && (
          <div className="style-chips">
            {STYLE_FILTERS.map((style) => (
              <button
                key={style.id}
                className={`style-chip${styleFilter === style.id ? ' active' : ''}`}
                onClick={() => setStyleFilter(style.id)}
                aria-pressed={styleFilter === style.id}
              >
                {style.label}
              </button>
            ))}
          </div>
        )}

        {isFolded ? (
          <>
            <div className="sheet-panel">
              <p className="layout-section-title">The sheet</p>
              <TemplateGrid
                templates={sheetTemplates}
                activeId={currentPage?.templateId}
                maxSlots={size.maxPhotosPerPage}
                onPick={applyTemplate}
              />
            </div>

            {/* One half at a time — showing both grids at once made for a very
                long panel and easy mis-clicks into the wrong half. */}
            {isSplit && currentPage?.halves && (
              <div className="half-panel">
                <div className="half-tabs" role="tablist" aria-label="Which half to lay out">
                  {([0, 1] as const).map((halfIndex) => (
                    <button
                      key={halfIndex}
                      role="tab"
                      className={`half-tab${activeHalfIndex === halfIndex ? ' active' : ''}`}
                      aria-selected={activeHalfIndex === halfIndex}
                      onClick={() => setActiveHalf(halfIndex)}
                    >
                      {halfLabels[halfIndex]}
                    </button>
                  ))}
                </div>
                <TemplateGrid
                  templates={halfTemplates}
                  activeId={currentPage.halves[activeHalfIndex].templateId}
                  maxSlots={MAX_PHOTOS_PER_HALF}
                  onPick={(templateId) => applyHalfTemplate(activePageIndex, activeHalfIndex, templateId)}
                />
              </div>
            )}
          </>
        ) : (
          <TemplateGrid
            templates={visible}
            activeId={currentPage?.templateId}
            maxSlots={size.maxPhotosPerPage}
            onPick={applyTemplate}
          />
        )}
      </PanelSection>

      {currentPage && (
        <PanelSection title="Page styling" defaultOpen={false}>
          <div className="inspector-row">
            <label>Background</label>
            <div className="filter-chips-row">
              <button
                className={`filter-chip-btn${!currentPage.backgroundColor ? ' active' : ''}`}
                onClick={() => setPageBackground(activePageIndex, undefined)}
                aria-pressed={!currentPage.backgroundColor}
              >
                None
              </button>
              {PAGE_TINTS.map((tint) => (
                <button
                  key={tint.id}
                  className={`filter-chip-btn${currentPage.backgroundColor === tint.color ? ' active' : ''}`}
                  onClick={() => setPageBackground(activePageIndex, tint.color)}
                  aria-pressed={currentPage.backgroundColor === tint.color}
                  title={tint.label}
                >
                  <span className="tint-swatch" style={{ background: tint.color }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="inspector-row">
            <label htmlFor="margin-scale">Margin</label>
            <input
              id="margin-scale"
              type="range"
              min={0.3}
              max={2}
              step={0.05}
              value={currentPage.marginScale ?? 1}
              onChange={(e) => setPageMarginScale(activePageIndex, Number(e.target.value))}
            />
            <span className="value mono">{Math.round((currentPage.marginScale ?? 1) * 100)}%</span>
          </div>
        </PanelSection>
      )}
    </section>
  )
}
