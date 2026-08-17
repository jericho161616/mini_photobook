import { useState } from 'react'
import { Icon } from './Icon'

/** A collapsible group within a sidebar panel — for splitting a panel that answers more than one question into its own disclosures instead of one long scroll. */
export function PanelSection({
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
          <Icon name="chevronDown" size={13} />
        </span>
      </button>
      {open && <div className="panel-section-body">{children}</div>}
    </div>
  )
}
