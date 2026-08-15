import { useEffect } from 'react'
import { useStore, type DrawTool } from '../state/useStore'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

interface Tool {
  id: DrawTool
  label: string
  /** Single-key shortcut. Rounded has none — it's the rectangle with a radius, not a fourth shape. */
  key?: string
  hint: string
  icon: React.ReactNode
}

const TOOLS: Tool[] = [
  {
    id: 'select',
    label: 'Select',
    key: 'v',
    hint: '',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M5 3l14 8-6 1.6L9.6 19z" />
      </svg>
    ),
  },
  {
    id: 'rect',
    label: 'Rectangle',
    key: 'r',
    hint: 'Drag to draw a box · Shift for a square',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="4" y="6" width="16" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'rounded',
    label: 'Rounded box',
    hint: 'Drag to draw a rounded box · Shift for a square',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="4" y="6" width="16" height="12" rx="4.5" />
      </svg>
    ),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    key: 'o',
    hint: 'Drag to draw an ellipse · Shift for a circle',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <ellipse cx="12" cy="12" rx="8" ry="6.5" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    key: 't',
    hint: 'Drag to draw a text box',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M5 6h14M12 6v12M9 18h6" />
      </svg>
    ),
  },
]

/** What the hint strip under the canvas says for the armed tool, if anything. */
export function drawHint(tool: DrawTool): string {
  return TOOLS.find((t) => t.id === tool)?.hint ?? ''
}

/**
 * The drawing tools, floating against the canvas rather than filed inside a
 * sidebar panel.
 *
 * Two reasons they live here. Arming one puts the editor in a mode — a drag on
 * the page draws instead of panning — and a mode needs something visibly lit
 * beside the thing it changes, which a button in a collapsed panel can't do.
 * And with the tools on the canvas, drawing a layout needs no panel open at
 * all, which leaves the artboard as large as the window allows.
 */
export function ToolCluster({ disabled }: { disabled: boolean }) {
  const drawTool = useStore((s) => s.drawTool)
  const setDrawTool = useStore((s) => s.setDrawTool)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Never steal a keystroke from a note, a title, or a text box being edited.
      const target = e.target as HTMLElement | null
      if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return
      if (e.key === 'Escape') {
        setDrawTool('select')
        return
      }
      if (disabled) return
      const tool = TOOLS.find((t) => t.key && t.key === e.key.toLowerCase())
      if (tool) {
        e.preventDefault()
        setDrawTool(tool.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setDrawTool, disabled])

  return (
    <div className="tool-cluster" role="toolbar" aria-label="Drawing tools" aria-orientation="vertical">
      {TOOLS.map((tool, i) => (
        <div key={tool.id} className="tool-cluster-item">
          {/* A rule after Select, separating "what does a drag do" from "what
              does a drag make" — the same split every drawing tool uses. */}
          {i === 1 && <span className="tool-sep" aria-hidden="true" />}
          <button
            className={`tool-btn${drawTool === tool.id ? ' active' : ''}`}
            onClick={() => setDrawTool(tool.id)}
            disabled={disabled && tool.id !== 'select'}
            aria-pressed={drawTool === tool.id}
            aria-label={tool.label}
            title={tool.key ? `${tool.label} (${tool.key.toUpperCase()})` : tool.label}
          >
            {tool.icon}
          </button>
        </div>
      ))}
    </div>
  )
}
