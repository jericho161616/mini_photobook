import { bookShape, getSize } from '../data/sizes'
import { getTemplate, templatesForSize } from '../data/templates'
import { MAX_PAGES, MIN_PAGES } from '../types'
import type { BookSize, Page, Photo, Placement, Template } from '../types'

export function clampPages(n: number): number {
  return Math.max(MIN_PAGES, Math.min(MAX_PAGES, n))
}

/**
 * Suggest a page count that lets every photo sit on a page without crowding.
 * Minimalism argues for the lower end, so we aim at roughly half the size's
 * maximum density rather than packing pages full.
 */
export function suggestPageCount(photoCount: number, size: BookSize): number {
  if (photoCount === 0) return MIN_PAGES
  const comfortableDensity = Math.max(1, (size.maxPhotosPerPage + 1) / 2)
  return clampPages(Math.ceil(photoCount / comfortableDensity))
}

/**
 * How many photos fit in the given page range at this size. Used to warn when
 * the library can't be told in the pages available.
 */
export function capacityRange(pageCount: number, size: BookSize): [number, number] {
  return [pageCount, pageCount * size.maxPhotosPerPage]
}

function aspectOf(photo: Photo): number {
  return photo.height > 0 ? photo.width / photo.height : 1
}

function slotAspect(slot: { w: number; h: number }, pageRatio: number): number {
  // Slot percentages are relative to each axis, so the page's own aspect ratio
  // has to be folded back in to get the slot's true shape.
  return (slot.w / slot.h) * pageRatio
}

/**
 * Cost of showing `photo` in a slot of the given aspect. Log-ratio distance so
 * that a 2× mismatch costs the same whether the slot is too tall or too wide.
 * The cost is what a viewer actually loses: how much of the photo gets cropped.
 */
function fitCost(photoAspect: number, slotAspect: number): number {
  return Math.abs(Math.log(photoAspect / slotAspect))
}

/** Best assignment cost for laying `photos` into `template`'s slots, in order. */
function templateCost(template: Template, photos: Photo[], pageRatio: number): number {
  let total = 0
  for (let i = 0; i < template.slots.length; i++) {
    const photo = photos[i]
    if (!photo) return Number.POSITIVE_INFINITY
    total += fitCost(aspectOf(photo), slotAspect(template.slots[i], pageRatio))
  }
  return total / template.slots.length
}

/** Templates suited to this trim, falling back to everything if none match. */
function shapeFitting(candidates: Template[], size: BookSize): Template[] {
  const shape = bookShape(size)
  const fitting = candidates.filter((t) => t.fits.includes(shape))
  return fitting.length > 0 ? fitting : candidates
}

let pageSeq = 0
function nextPageId(): string {
  pageSeq += 1
  return `page-${Date.now().toString(36)}-${pageSeq}`
}

export function emptyPlacements(templateId: string): (Placement | null)[] {
  return getTemplate(templateId).slots.map(() => null)
}

export function placementFor(photoId: string): Placement {
  return { photoId, zoom: 1, offsetX: 0, offsetY: 0 }
}

export interface AutoLayoutOptions {
  photos: Photo[]
  size: BookSize
  pageCount: number
}

/**
 * Distribute photos across pages, choosing a template per page that suits the
 * orientations of the photos landing on it. Consecutive pages are nudged apart
 * so the book doesn't read as the same layout repeated.
 */
export function autoLayout({ photos, size, pageCount }: AutoLayoutOptions): Page[] {
  return layoutPages(photos, size, clampPages(pageCount))
}

/**
 * The actual layout pass, without the whole-book 10–30 page clamp — used
 * directly when laying out just the unlocked pages of a book, which may
 * legitimately number fewer than the book's own minimum.
 */
function layoutPages(photos: Photo[], size: BookSize, pages: number): Page[] {
  const candidates = templatesForSize(size)
  const pageRatio = size.widthIn / size.heightIn

  if (photos.length === 0) {
    // An empty book still needs a shape to pour photos into later.
    const starters = shapeFitting(candidates, size)
    return Array.from({ length: pages }, (_, i) => {
      const template = starters[i % starters.length]
      return {
        id: nextPageId(),
        templateId: template.id,
        placements: emptyPlacements(template.id),
        locked: false,
        text: '',
      }
    })
  }

  const shape = bookShape(size)

  const result: Page[] = []
  let cursor = 0
  let previousTemplateId: string | null = null

  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const pagesLeft = pages - pageIndex
    const photosLeft = photos.length - cursor

    // Every remaining page should get at least one photo where possible, and no
    // page should take so many that the tail runs dry.
    const maxTake = Math.min(
      size.maxPhotosPerPage,
      Math.max(1, photosLeft - (pagesLeft - 1)),
    )
    const minTake = photosLeft > 0 ? Math.min(1, photosLeft) : 0

    let best: { template: Template; cost: number } | null = null

    for (const template of candidates) {
      const take = template.slots.length
      if (take > maxTake || take < minTake) continue

      const window = photos.slice(cursor, cursor + take)
      if (window.length < take) continue

      let cost = templateCost(template, window, pageRatio)
      // A layout designed for a wide page reads awkwardly on a square one, so
      // steer hard toward templates meant for this trim. Still only a penalty,
      // so an odd size never runs out of options entirely.
      if (!template.fits.includes(shape)) cost += 1.5
      // Page one opens the book, so it wants the layout that carries the title;
      // every page after it does not.
      const wantsCover = pageIndex === 0
      if (wantsCover !== Boolean(template.caption)) cost += 1.0
      // Prefer variety: repeating the previous layout carries a small penalty,
      // enough to break ties but not enough to override a genuinely better fit.
      if (template.id === previousTemplateId) cost += 0.35

      if (!best || cost < best.cost) best = { template, cost }
    }

    // Nothing fit (we've run out of photos) — leave a clean single-photo page.
    const template = best?.template ?? candidates[0]
    const take = best ? template.slots.length : 0

    const placements: (Placement | null)[] = template.slots.map((_, slotIndex) => {
      const photo = photos[cursor + slotIndex]
      return slotIndex < take && photo ? placementFor(photo.id) : null
    })

    result.push({ id: nextPageId(), templateId: template.id, placements, locked: false, text: '' })
    cursor += take
    previousTemplateId = template.id
  }

  return result
}

/** Fewest pages the book can shrink to without cutting off a locked page. */
export function minPageCount(pages: Page[]): number {
  const lastLockedIndex = pages.reduce((last, p, i) => (p.locked ? i : last), -1)
  return Math.max(MIN_PAGES, lastLockedIndex + 1)
}

/**
 * Resize an existing book to a new page count, keeping the pages the designer
 * has already worked on and only adding or trimming from the end. Trimming
 * never removes a locked page — the count just stops shrinking at whichever
 * locked page sits furthest back in the book.
 */
export function resizePages(pages: Page[], pageCount: number, size: BookSize): Page[] {
  const target = Math.max(clampPages(pageCount), minPageCount(pages))
  if (pages.length === target) return pages
  if (pages.length > target) return pages.slice(0, target)

  const candidates = shapeFitting(templatesForSize(size), size)
  const added = Array.from({ length: target - pages.length }, (_, i) => {
    const template = candidates[(pages.length + i) % candidates.length]
    return {
      id: nextPageId(),
      templateId: template.id,
      placements: emptyPlacements(template.id),
      locked: false,
      text: '',
    }
  })
  return [...pages, ...added]
}

/**
 * When the book size changes, some templates may now be too dense. Swap those
 * pages to the closest allowed layout, carrying over as many photos as fit.
 */
export function reconcileTemplates(pages: Page[], size: BookSize): Page[] {
  const allowed = templatesForSize(size)
  const allowedIds = new Set(allowed.map((t) => t.id))

  return pages.map((page) => {
    // A locked page is protected from every kind of edit, including the
    // knock-on effect of resizing the whole book.
    if (page.locked || allowedIds.has(page.templateId)) return page
    return fitPageToSize(page, size)
  })
}

/**
 * Re-fit a single page to a new size, picking the densest template that
 * suits the new shape and carrying over as many of its photos as fit. Used
 * both by whole-book resize (above) and by flipping one page's orientation
 * within the A4 family.
 */
export function fitPageToSize(page: Page, size: BookSize): Page {
  const allowed = shapeFitting(templatesForSize(size), size)
  const photos = page.placements.filter((p): p is Placement => p !== null)
  const replacement = [...allowed].sort((a, b) => b.slots.length - a.slots.length)[0]
  const placements = replacement.slots.map((_, i) => photos[i] ?? null)
  return { ...page, templateId: replacement.id, placements }
}

/** The size actually in effect for this page — its own override, or the book's. */
export function resolvePageSize(page: Page, bookSize: BookSize): BookSize {
  if (!page.sizeId) return bookSize
  return getSize(page.sizeId)
}

/**
 * Re-run auto-layout for a book that already has some pages locked. Locked
 * pages, and whatever photos are already sitting on them, are left exactly as
 * they are; every other photo is redistributed across the remaining pages.
 */
export function regenerateUnlocked(pages: Page[], photos: Photo[], size: BookSize): Page[] {
  const reservedIds = new Set(
    pages
      .filter((p) => p.locked)
      .flatMap((p) => p.placements.filter((pl): pl is Placement => pl !== null))
      .map((pl) => pl.photoId),
  )
  const freePhotos = photos.filter((p) => !reservedIds.has(p.id))
  const unlockedIndexes = pages.map((_, i) => i).filter((i) => !pages[i].locked)

  if (unlockedIndexes.length === 0) return pages

  const replacements = layoutPages(freePhotos, size, unlockedIndexes.length)

  const result = [...pages]
  unlockedIndexes.forEach((pageIndex, i) => {
    if (replacements[i]) result[pageIndex] = replacements[i]
  })
  return result
}

/** Photo ids currently placed anywhere in the book. */
export function usedPhotoIds(pages: Page[]): Set<string> {
  const used = new Set<string>()
  for (const page of pages) {
    for (const placement of page.placements) {
      if (placement) used.add(placement.photoId)
    }
  }
  return used
}
