export type RailSection = 'photos' | 'layout' | 'decorate' | 'note' | 'size'

interface RailItem {
  id: RailSection
  label: string
  icon: React.ReactNode
  /** Pinned to the bottom of the rail — set once and rarely revisited. */
  atEnd?: boolean
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const RAIL_ITEMS: RailItem[] = [
  {
    id: 'photos',
    label: 'Photos',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M21 15l-5-5L5 19" />
      </svg>
    ),
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="3" width="7.5" height="18" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="8" rx="1.5" />
        <rect x="13.5" y="13" width="7.5" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'decorate',
    label: 'Decorate',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 15.9 6.8 19l1.4-5.9-4.6-4 6-.5z" />
      </svg>
    ),
  },
  {
    id: 'note',
    label: 'Note',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: 'size',
    label: 'Size',
    atEnd: true,
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 4v16M4 9h16" />
      </svg>
    ),
  },
]

interface EditorRailProps {
  active: RailSection
  /** False while the drawer is collapsed — the rail still shows which section it would open. */
  open: boolean
  onPick: (section: RailSection) => void
}

/**
 * The editor's one persistent navigation surface. Replaces the two fixed
 * sidebars: whichever section is picked here is the one the drawer beside it
 * shows, and picking the open one again closes the drawer entirely.
 */
export function EditorRail({ active, open, onPick }: EditorRailProps) {
  const render = (item: RailItem) => {
    const on = active === item.id && open
    return (
      <button
        key={item.id}
        className={`rail-btn${on ? ' active' : ''}`}
        onClick={() => onPick(item.id)}
        aria-pressed={on}
        title={on ? `Hide ${item.label.toLowerCase()}` : item.label}
      >
        {item.icon}
        <span className="rail-label">{item.label}</span>
      </button>
    )
  }

  return (
    <nav className="editor-rail" aria-label="Editor sections">
      {RAIL_ITEMS.filter((i) => !i.atEnd).map(render)}
      <span className="rail-spacer" />
      {RAIL_ITEMS.filter((i) => i.atEnd).map(render)}
    </nav>
  )
}
