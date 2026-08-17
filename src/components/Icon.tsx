import type { ReactNode } from 'react'

/**
 * One hairline icon set for every piece of UI chrome.
 *
 * The app used to reach for whichever Unicode glyph happened to be nearest —
 * 🔒 for a lock, ✋ for "place", ⤢ for expand, ☰ for centre-align. Those render
 * differently on every platform: colour emoji on one, a thin outline on
 * another, a tofu box wherever the font simply hasn't got them, and never at a
 * weight that matched the text beside them. Drawing them instead means one
 * 24×24 box, one stroke width, one set of joins — so a row of controls reads
 * as a set rather than a ransom note.
 *
 * Genuine typography stays as characters: the middle dot in "Moments · Editor",
 * the × in "1024×768", ellipses, degree signs. Those are punctuation doing
 * punctuation's job, not pictures standing in for icons.
 */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const SOLID = { fill: 'currentColor', stroke: 'none' }

const PATHS: Record<string, ReactNode> = {
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 7.6-1.6" />
    </>
  ),
  check: <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />,
  /** "Place" — a pointer about to set something down. */
  pointer: <path d="M6 3.5l11.5 7.6-5 1.1 2.5 5-2.3 1.1-2.5-5L6 16.6z" />,
  pencil: (
    <>
      <path d="M4 20l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.2 19z" />
      <path d="M14.2 6.6l3.2 3.2" />
    </>
  ),
  more: (
    <g {...SOLID}>
      <circle cx="5.2" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.8" cy="12" r="1.6" />
    </g>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6" />
    </>
  ),
  moon: <path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11z" />,
  chevronLeft: <path d="M14.5 5L7.5 12l7 7" />,
  chevronRight: <path d="M9.5 5l7 7-7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  play: <path d="M8 5.5v13l11-6.5z" {...SOLID} />,
  pause: (
    <g {...SOLID}>
      <rect x="7.6" y="5.5" width="3.2" height="13" rx="0.8" />
      <rect x="13.2" y="5.5" width="3.2" height="13" rx="0.8" />
    </g>
  ),
  /** Arrows pushing out of the corners — "show this bigger". */
  expand: (
    <>
      <path d="M14 4h6v6M20 4l-7.2 7.2" />
      <path d="M10 20H4v-6M4 20l7.2-7.2" />
    </>
  ),
  alignLeft: <path d="M4 6h16M4 11h10M4 16h13" />,
  alignCenter: <path d="M4 6h16M7 11h10M5.5 16h13" />,
  alignRight: <path d="M4 6h16M10 11h10M7 16h13" />,
  upload: <path d="M12 16.5V4M7.2 8.8L12 4l4.8 4.8M4 20h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" />,
  /** Whole-app full screen — arrows out to the corners, then back in. */
  fullscreen: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
  fullscreenExit: <path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" />,
  /** Send a page to the front / back of the book in one click. */
  toStart: <path d="M5 5v14M19 5l-7 7 7 7M12 5l-7 7 7 7" />,
  toEnd: <path d="M19 5v14M5 5l7 7-7 7M12 5l7 7-7 7" />,
  /** The fold direction of an A4 Folded sheet. */
  foldTall: (
    <>
      <rect x="7" y="3.5" width="10" height="17" rx="1" />
      <path d="M7 12h10" strokeDasharray="2 2" />
    </>
  ),
  foldWide: (
    <>
      <rect x="3.5" y="7" width="17" height="10" rx="1" />
      <path d="M12 7v10" strokeDasharray="2 2" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

/**
 * `size` is the rendered box in px. Icons inherit `currentColor`, so they take
 * the colour of whatever button they sit in without any extra styling.
 */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon-svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...STROKE}
    >
      {PATHS[name]}
    </svg>
  )
}
