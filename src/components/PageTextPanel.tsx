import { getTemplate } from '../data/templates'
import { useStore } from '../state/useStore'

/**
 * A free-form note for the active page — a date, a place, a line of text.
 * Only shows up when that page's layout actually reserves room for one;
 * most layouts don't, and that's fine, the text is always optional anyway.
 */
export function PageTextPanel() {
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const setPageText = useStore((s) => s.setPageText)

  const page = pages[activePageIndex]
  const template = page ? getTemplate(page.templateId) : null

  if (!template?.textSlot) return null

  return (
    <section className="panel">
      <h2>Page Note</h2>
      <p className="hint">Optional — shows under the photo on this page only.</p>
      <textarea
        className="page-text-input"
        value={page?.text ?? ''}
        onChange={(e) => setPageText(activePageIndex, e.target.value)}
        placeholder="e.g. Santorini, June 2024"
        disabled={page?.locked}
        rows={2}
        maxLength={120}
      />
    </section>
  )
}
