import { fontFamilyById } from '../lib/fonts'
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

/**
 * An id that is neither a built-in nor one of the open book's added fonts
 * falls back to the default serif — which is exactly what should happen when
 * a book is opened on a machine that hasn't got its scanned font installed.
 */
export function fontStack(id: FontId | undefined): string {
  const builtIn = FONT_OPTIONS.find((f) => f.id === id)
  if (builtIn) return builtIn.stack
  const family = id ? fontFamilyById(id) : undefined
  return family ? `"${family}", Georgia, serif` : FONT_OPTIONS[0].stack
}

/** 'md' (1x) is the size every note and text box already rendered at before this option existed. */
/** Quick presets beside the number box — the old S/M/L/XL, as the numbers they always were. */
export const FONT_SIZE_PRESETS: { label: string; value: number }[] = [
  { label: 'S', value: 75 },
  { label: 'M', value: 100 },
  { label: 'L', value: 135 },
  { label: 'XL', value: 175 },
]

/** What the four old preset ids meant, so books made before the number box keep their sizing. */
const LEGACY_SCALES: Record<string, number> = { sm: 0.75, md: 1, lg: 1.35, xl: 1.75 }

export function fontSizeScale(size: FontSize | undefined): number {
  if (typeof size === 'number') return size / 100
  if (typeof size === 'string') return LEGACY_SCALES[size] ?? 1
  return 1
}

/** The number to show in the box for a given stored size, presets included. */
export function fontSizeNumber(size: FontSize | undefined): number {
  return Math.round(fontSizeScale(size) * 100)
}

export const DEFAULT_TEXT_STYLE: TextStyle = { font: 'serif', bold: false }
