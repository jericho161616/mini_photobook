import { useState } from 'react'
import { foldOrientationForSize, getSize } from '../data/sizes'
import { getTemplate, MAX_PHOTOS_PER_HALF, templatesForHalf, templatesForPage } from '../data/templates'
import { maxPagesForSize, resolvePageSize, spanOf, totalSlides } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import type { Template } from '../types'
import { LayoutPickerModal } from './LayoutPickerModal'

/** A small preview of a template's own slot arrangement, at the size the summary row uses. */
function TemplateThumb({ template }: { template: Template }) {
  return (
    <span className="icon layout-current-icon" aria-hidden="true">
      {template.slots.map((slot, i) => (
        <span
          key={i}
          className="s"
          style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
        />
      ))}
    </span>
  )
}

/** The current layout plus a button that opens the full library — the same "show state, hide options" shape the Book Size panel uses. */
function CurrentLayoutRow({
  label,
  template,
  onOpen,
}: {
  label: string
  template: Template | undefined
  onOpen: () => void
}) {
  return (
    <div className="layout-current">
      {template && <TemplateThumb template={template} />}
      <div className="layout-current-text">
        <span className="layout-current-label">{label}</span>
        <span className="layout-current-name">{template?.label ?? 'None'}</span>
      </div>
      <button className="btn" onClick={onOpen}>
        Change
      </button>
    </div>
  )
}

export function TemplatePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const applyHalfTemplate = useStore((s) => s.applyHalfTemplate)
  const activeHalfIndex = useStore((s) => s.activeHalfIndex)
  const setActiveHalf = useStore((s) => s.setActiveHalf)

  // Which picker is open, if any — the whole sheet's, or one half's.
  const [picking, setPicking] = useState<'page' | 'half' | null>(null)

  const bookSize = getSize(sizeId)
  const currentPage = pages[activePageIndex]
  // A page's own orientation override changes which templates actually apply
  // to it (an A4 Folded page only ever offers its fold-aware layouts).
  const size = currentPage ? resolvePageSize(currentPage, bookSize) : bookSize

  const containerTemplate = currentPage ? getTemplate(currentPage.templateId) : undefined
  const isSplit = Boolean(containerTemplate?.halfSplit && currentPage?.halves)
  const foldOrientation = foldOrientationForSize(size.id)
  const isFolded = Boolean(foldOrientation)
  const halfLabels: [string, string] =
    foldOrientation === 'horizontal' ? ['Top half', 'Bottom half'] : ['Left half', 'Right half']

  const halfTemplateId = currentPage?.halves?.[activeHalfIndex].templateId
  const halfTemplate = halfTemplateId ? getTemplate(halfTemplateId) : undefined

  // What the rest of the project already costs in slides, so the picker can
  // leave out any spanning layout too wide to fit in what's left.
  const currentSpan = currentPage ? spanOf(currentPage) : 1
  const otherSlides = totalSlides(pages) - currentSpan
  const pageTemplates = templatesForPage(
    size,
    currentSpan,
    otherSlides,
    maxPagesForSize(bookSize),
  )

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
            Mix them freely across the book.
          </>
        )}
      </p>

      <CurrentLayoutRow
        label={isFolded ? 'The sheet' : 'Current layout'}
        template={containerTemplate}
        onOpen={() => setPicking('page')}
      />

      {/* One half at a time — showing both at once made for a very long panel
          and easy mis-clicks into the wrong half. */}
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
          <CurrentLayoutRow
            label={halfLabels[activeHalfIndex]}
            template={halfTemplate}
            onOpen={() => setPicking('half')}
          />
        </div>
      )}

      {picking === 'page' && (
        <LayoutPickerModal
          templates={pageTemplates}
          activeId={currentPage?.templateId}
          maxSlots={size.maxPhotosPerPage}
          // The two sheet templates decide how a folded page is divided, so
          // they're never filtered — filtering them away would strand the page
          // in whichever mode it's already in.
          showFilters={!isFolded}
          title={isFolded ? 'Choose a sheet layout' : 'Choose a layout'}
          onPick={applyTemplate}
          onClose={() => setPicking(null)}
        />
      )}

      {picking === 'half' && (
        <LayoutPickerModal
          templates={templatesForHalf()}
          activeId={halfTemplateId}
          maxSlots={MAX_PHOTOS_PER_HALF}
          showFilters
          title={`Choose a layout — ${halfLabels[activeHalfIndex].toLowerCase()}`}
          onPick={(templateId) => applyHalfTemplate(activePageIndex, activeHalfIndex, templateId)}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  )
}
