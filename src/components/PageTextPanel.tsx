import { foldOrientationForSize, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import { resolvePageSize } from '../lib/autoLayout'
import { useStore } from '../state/useStore'

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
        value={(half ? half.text : page.text) ?? ''}
        onChange={(e) =>
          half
            ? setHalfText(activePageIndex, activeHalfIndex, e.target.value)
            : setPageText(activePageIndex, e.target.value)
        }
        placeholder="e.g. Santorini, June 2024"
        disabled={page.locked}
        rows={2}
        maxLength={120}
      />
    </section>
  )
}
