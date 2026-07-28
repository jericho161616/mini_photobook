import type { BookSize, Shape } from '../types'

/**
 * The nine standard photobook trims. Larger books can carry denser pages
 * without the images getting too small to read.
 */
export const SIZES: BookSize[] = [
  { id: 'sq-s', name: 'Small Square', widthIn: 6, heightIn: 6, maxPhotosPerPage: 3 },
  { id: 'sq-m', name: 'Medium Square', widthIn: 8, heightIn: 8, maxPhotosPerPage: 4 },
  { id: 'sq-l', name: 'Large Square', widthIn: 10, heightIn: 10, maxPhotosPerPage: 5 },
  { id: 'ls-s', name: 'Small Landscape', widthIn: 7, heightIn: 5, maxPhotosPerPage: 3 },
  { id: 'ls-m', name: 'Standard Landscape', widthIn: 11, heightIn: 8.5, maxPhotosPerPage: 4 },
  { id: 'ls-l', name: 'Large Landscape', widthIn: 14, heightIn: 11, maxPhotosPerPage: 5 },
  { id: 'pt-s', name: 'Small Portrait', widthIn: 5, heightIn: 7, maxPhotosPerPage: 3 },
  { id: 'pt-m', name: 'Standard Portrait', widthIn: 8, heightIn: 10, maxPhotosPerPage: 4 },
  { id: 'pt-l', name: 'Large Portrait', widthIn: 11, heightIn: 14, maxPhotosPerPage: 5 },
]

export const DEFAULT_SIZE_ID = 'sq-m'

export function getSize(id: string): BookSize {
  return SIZES.find((s) => s.id === id) ?? SIZES[1]
}

export function sizeRatio(size: BookSize): number {
  return size.widthIn / size.heightIn
}

/** Which layout family a trim naturally belongs to. */
export function bookShape(size: BookSize): Shape {
  const ratio = sizeRatio(size)
  if (ratio > 1.15) return 'wide'
  if (ratio < 0.87) return 'tall'
  return 'square'
}

export function formatDims(size: BookSize): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return `${fmt(size.widthIn)}×${fmt(size.heightIn)} in`
}
