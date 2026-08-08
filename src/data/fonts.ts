import type { FontId, FontSize, TextStyle } from '../types'

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
  { id: 'brush', label: 'Brush Script', stack: '"Brush Script MT", "Lucida Handwriting", "Snell Roundhand", cursive' },
  { id: 'condensed', label: 'Condensed', stack: '"Arial Narrow", "Bahnschrift", sans-serif' },
  { id: 'slab', label: 'Slab Serif', stack: 'Rockwell, "Roboto Slab", Georgia, serif' },
]

export function fontStack(id: FontId | undefined): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack
}

/** 'md' (1x) is the size every note and text box already rendered at before this option existed. */
export const FONT_SIZE_OPTIONS: { id: FontSize; label: string; scale: number }[] = [
  { id: 'sm', label: 'S', scale: 0.75 },
  { id: 'md', label: 'M', scale: 1 },
  { id: 'lg', label: 'L', scale: 1.35 },
  { id: 'xl', label: 'XL', scale: 1.75 },
]

export function fontSizeScale(size: FontSize | undefined): number {
  return FONT_SIZE_OPTIONS.find((f) => f.id === size)?.scale ?? 1
}

export const DEFAULT_TEXT_STYLE: TextStyle = { font: 'serif', bold: false }
