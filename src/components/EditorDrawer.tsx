import { DecoratePanel } from './DecoratePanel'
import type { RailSection } from './EditorRail'
import { PageTextPanel } from './PageTextPanel'
import { PhotoTray } from './PhotoTray'
import { SizePanel } from './SizePanel'
import { SlotInspector } from './SlotInspector'
import { TemplatePanel } from './TemplatePanel'

const SECTION_TITLES: Record<RailSection, string> = {
  photos: 'Photos',
  layout: 'Layout',
  decorate: 'Decorate',
  note: 'Note',
  size: 'Book size',
}

interface EditorDrawerProps {
  section: RailSection
  open: boolean
  /** True while a photo slot is selected — the drawer shows that photo instead of the rail's section. */
  showingSelectedPhoto: boolean
  onOpenLibrary: () => void
  onCollapse: () => void
}

/**
 * The one panel beside the rail.
 *
 * Shows whichever rail section is active — except while a photo slot is
 * selected, when it shows that photo's own controls instead. That's what
 * retires the old always-present "Photo" tab: rather than a tab that reads
 * "click a slot to adjust it" most of the time, the panel simply becomes the
 * photo's when there is one, and goes back to the rail's section when there
 * isn't. Sliders and the 3×3 position grid stay here rather than moving to the
 * floating toolbar, which suits discrete buttons far better than ranges.
 */
export function EditorDrawer({
  section,
  open,
  showingSelectedPhoto,
  onOpenLibrary,
  onCollapse,
}: EditorDrawerProps) {
  const title = showingSelectedPhoto ? 'Selected photo' : SECTION_TITLES[section]

  return (
    <aside className={`editor-drawer${open ? '' : ' collapsed'}`} aria-label={title} aria-hidden={!open}>
      <div className="drawer-head">
        <span className="drawer-title">{title}</span>
        <button className="drawer-collapse" onClick={onCollapse} title="Hide this panel" aria-label="Hide this panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>
      <div className="drawer-body">
        {showingSelectedPhoto ? (
          <SlotInspector />
        ) : section === 'photos' ? (
          <PhotoTray onOpenLibrary={onOpenLibrary} />
        ) : section === 'layout' ? (
          <TemplatePanel />
        ) : section === 'decorate' ? (
          <DecoratePanel />
        ) : section === 'note' ? (
          <PageTextPanel />
        ) : (
          <SizePanel />
        )}
      </div>
    </aside>
  )
}
