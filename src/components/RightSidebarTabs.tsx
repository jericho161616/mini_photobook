import { useState } from 'react'
import { DecoratePanel } from './DecoratePanel'
import { PageTextPanel } from './PageTextPanel'
import { SlotInspector } from './SlotInspector'
import { TemplatePanel } from './TemplatePanel'

type Tab = 'photo' | 'note' | 'layout' | 'decorate'

const TABS: { id: Tab; label: string }[] = [
  { id: 'photo', label: 'Photo' },
  { id: 'note', label: 'Note' },
  { id: 'layout', label: 'Layout' },
  { id: 'decorate', label: 'Decorate' },
]

/**
 * The right sidebar used to stack Selected Photo, Page Note, Layout, and
 * Decorate one after another — tall enough to need scrolling on its own even
 * before the doodle pad existed. Tabs keep it a fixed height regardless of
 * how much any one section grows.
 */
export function RightSidebarTabs() {
  const [tab, setTab] = useState<Tab>('photo')

  return (
    <aside className="sidebar sidebar-tabbed">
      <div className="tab-row" role="tablist" aria-label="Editing panels">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={`tab-btn${tab === t.id ? ' active' : ''}`}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === 'photo' && <SlotInspector />}
        {tab === 'note' && <PageTextPanel />}
        {tab === 'layout' && <TemplatePanel />}
        {tab === 'decorate' && <DecoratePanel />}
      </div>
    </aside>
  )
}
