import type { StickerType } from '../types'

/** Drawn with inline SVG paths — no image assets, nothing to fetch or license. */
export function StickerGlyph({ type }: { type: StickerType }) {
  switch (type) {
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 20s-7-4.6-9.3-9C1 7.7 2.3 4 6 4c2 0 3.3 1.2 4 2.4C10.7 5.2 12 4 14 4c3.7 0 5 3.7 3.3 7-2.3 4.4-9.3 9-9.3 9z" />
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.8l2.7 6.1 6.6.6-5 4.5 1.5 6.5-5.8-3.5-5.8 3.5 1.5-6.5-5-4.5 6.6-.6z" />
        </svg>
      )
    case 'arrow':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h15M13 6l6 6-6 6" />
        </svg>
      )
    default:
      return null
  }
}
