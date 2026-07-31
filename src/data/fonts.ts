import type { FontId, TextStyle } from '../types'

/**
 * Every option is either already on virtually every Windows/Mac install (no
 * download, ever) or falls back gracefully to a similar system font — so
 * text always renders something reasonable with zero network calls.
 */
export const FONT_OPTIONS: { id: FontId; label: string; stack: string }[] = [
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'sans', label: 'Sans', stack: '-apple-system, "Segoe UI", sans-serif' },
  { id: 'mono', label: 'Typewriter', stack: '"Courier New", Courier, monospace' },
  { id: 'hand1', label: 'Handwritten', stack: '"Bradley Hand", "Segoe Script", cursive' },
  { id: 'hand2', label: 'Marker', stack: '"Comic Sans MS", "Segoe Print", cursive' },
]

export function fontStack(id: FontId | undefined): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack
}

export const DEFAULT_TEXT_STYLE: TextStyle = { font: 'serif', bold: false }
