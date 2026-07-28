import type { Shape, Template } from '../types'

/**
 * Two families, deliberately different in voice:
 *
 * Minimal — one to three photos with room around them, the quiet coffee-table look.
 * Portfolio — editorial rows, covers, and collages, closer to a photographer's book.
 *
 * `fits` tags which page shapes a layout reads well in, so the shape filter can
 * offer square, tall, and wide options that can be mixed page by page.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'full',
    label: '1 · Full',
    family: 'Minimal',
    fits: ['square', 'tall', 'wide'],
    slots: [{ x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    id: 'duoV',
    label: '2 · Side',
    family: 'Minimal',
    fits: ['wide', 'square'],
    slots: [
      { x: 0, y: 0, w: 47, h: 100 },
      { x: 53, y: 0, w: 47, h: 100 },
    ],
  },
  {
    id: 'duoH',
    label: '2 · Stack',
    family: 'Minimal',
    fits: ['tall', 'square'],
    slots: [
      { x: 0, y: 0, w: 100, h: 47 },
      { x: 0, y: 53, w: 100, h: 47 },
    ],
  },
  {
    id: 'trioT',
    label: '3 · Feature',
    family: 'Minimal',
    fits: ['square', 'wide'],
    slots: [
      { x: 0, y: 0, w: 100, h: 58 },
      { x: 0, y: 64, w: 47, h: 36 },
      { x: 53, y: 64, w: 47, h: 36 },
    ],
  },
  {
    id: 'trioS',
    label: '3 · Column',
    family: 'Minimal',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 63, h: 100 },
      { x: 67, y: 0, w: 33, h: 47 },
      { x: 67, y: 53, w: 33, h: 47 },
    ],
  },
  {
    id: 'cover',
    label: '1 · Cover',
    family: 'Portfolio',
    fits: ['square', 'tall'],
    slots: [{ x: 18, y: 10, w: 64, h: 58 }],
    caption: { x: 10, y: 74, w: 80, h: 12 },
  },
  {
    id: 'wideBanner',
    label: '1 · Banner',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [{ x: 4, y: 18, w: 92, h: 58 }],
    caption: { x: 10, y: 82, w: 80, h: 10 },
  },
  {
    id: 'row3',
    label: '3 · Row',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 31, h: 100 },
      { x: 34.5, y: 0, w: 31, h: 100 },
      { x: 69, y: 0, w: 31, h: 100 },
    ],
  },
  {
    id: 'row5',
    label: '5 · Row',
    family: 'Portfolio',
    fits: ['wide'],
    slots: [
      { x: 0, y: 0, w: 18, h: 100 },
      { x: 20.5, y: 0, w: 18, h: 100 },
      { x: 41, y: 0, w: 18, h: 100 },
      { x: 61.5, y: 0, w: 18, h: 100 },
      { x: 82, y: 0, w: 18, h: 100 },
    ],
  },
  {
    id: 'bigStack',
    label: '4 · Collage',
    family: 'Portfolio',
    fits: ['wide', 'square'],
    slots: [
      { x: 0, y: 0, w: 58, h: 100 },
      { x: 61, y: 0, w: 39, h: 31 },
      { x: 61, y: 34.5, w: 39, h: 31 },
      { x: 61, y: 69, w: 39, h: 31 },
    ],
  },
  {
    id: 'asymGrid',
    label: '5 · Editorial',
    family: 'Portfolio',
    fits: ['square', 'wide'],
    slots: [
      { x: 0, y: 0, w: 48, h: 48 },
      { x: 51, y: 0, w: 22, h: 48 },
      { x: 76, y: 0, w: 24, h: 48 },
      { x: 0, y: 51, w: 32, h: 48 },
      { x: 35, y: 51, w: 65, h: 48 },
    ],
  },
  {
    id: 'squareGrid4',
    label: '4 · Grid',
    family: 'Portfolio',
    fits: ['square'],
    slots: [
      { x: 0, y: 0, w: 48, h: 48 },
      { x: 52, y: 0, w: 48, h: 48 },
      { x: 0, y: 52, w: 48, h: 48 },
      { x: 52, y: 52, w: 48, h: 48 },
    ],
  },
  {
    id: 'tallTrio',
    label: '3 · Tiers',
    family: 'Portfolio',
    fits: ['tall'],
    slots: [
      { x: 0, y: 0, w: 100, h: 31 },
      { x: 0, y: 34.5, w: 100, h: 31 },
      { x: 0, y: 69, w: 100, h: 31 },
    ],
  },
  {
    id: 'tallFeature',
    label: '2 · Tall Feature',
    family: 'Portfolio',
    fits: ['tall'],
    slots: [
      { x: 0, y: 0, w: 100, h: 68 },
      { x: 0, y: 72, w: 100, h: 28 },
    ],
  },
]

export const SHAPE_FILTERS: { id: Shape | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'square', label: 'Square' },
  { id: 'tall', label: 'Tall' },
  { id: 'wide', label: 'Wide' },
]

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

/** Templates that stay composed at the given book size. */
export function templatesForSize(maxPhotosPerPage: number): Template[] {
  return TEMPLATES.filter((t) => t.slots.length <= maxPhotosPerPage)
}
