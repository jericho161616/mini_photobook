import { create } from 'zustand'
import { DEFAULT_SIZE_ID, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import {
  applyTemplateToPage,
  autoLayout,
  fitPageToSize,
  insertPage,
  maxPagesForSize,
  normalizePages,
  placementFor,
  reconcileTemplates,
  regenerateUnlocked,
  removePageAt as removePageFromList,
  resizePages,
  sizeMinPages,
  totalSlides,
} from '../lib/autoLayout'
import * as storage from '../lib/db'
import { clampOffset, clampZoom, importFiles, releasePhotoUrl } from '../lib/imageUtils'
import type {
  CustomSticker,
  HalfLayout,
  Page,
  Photo,
  PhotoFilter,
  Placement,
  Project,
  Sticker,
  StickerType,
  TextBox,
  TextStyle,
} from '../types'

export interface SlotRef {
  pageIndex: number
  slotIndex: number
  /** Set only when the slot belongs to one side of a Split at Fold page. */
  halfIndex?: 0 | 1
}

/** Identifies one freely placed sticker or text box, wherever it lives. */
export interface DecorationRef {
  pageIndex: number
  halfIndex?: 0 | 1
  kind: 'sticker' | 'textBox'
  id: string
}

let decorationSeq = 0
function nextDecorationId(): string {
  decorationSeq += 1
  return `deco-${Date.now().toString(36)}-${decorationSeq}`
}

let customStickerSeq = 0
function nextCustomStickerId(): string {
  customStickerSeq += 1
  return `doodle-${Date.now().toString(36)}-${customStickerSeq}`
}


interface StoreState {
  ready: boolean
  projectId: string | null
  photos: Photo[]
  title: string
  sizeId: string
  pages: Page[]
  /** This book's own drawn-sticker library — reused across as many pages as you like. */
  customStickers: CustomSticker[]
  activePageIndex: number
  /** Which side of a Split at Fold page the sidebar is currently editing. */
  activeHalfIndex: 0 | 1
  selected: SlotRef | null
  /** The one freely placed sticker or text box currently selected, if any. */
  selectedDecoration: DecorationRef | null
  importing: boolean
  /**
   * Photos "picked up" by clicking them rather than dragging — each slot
   * clicked takes the next one off the front of this list, in the order they
   * were picked up, so several photos can be stamped into consecutive slots
   * in one go. Exists for when dragging is awkward (a long scroll to find
   * the right photo, a trackpad, a small screen).
   */
  armedPhotoIds: string[]
  /** A brief, self-clearing message about the last import — e.g. how many duplicate photos were skipped. */
  importNotice: string | null
  /** Snapshots of {pages, title, sizeId, customStickers} to step back/forward through — photo library changes aren't included, since a deleted photo's file is truly gone. */
  undoStack: HistorySnapshot[]
  redoStack: HistorySnapshot[]

  init: (projectId: string) => Promise<void>
  addFiles: (files: File[]) => Promise<void>
  removePhoto: (photoId: string) => Promise<void>
  removePhotos: (photoIds: string[]) => Promise<void>
  setTitle: (title: string) => void
  setSize: (sizeId: string) => void
  setPageCount: (count: number) => void
  /** Inserts one new blank page at `position` (shifting later pages back), instead of only ever appending at the end. No-op once the size's own ceiling is reached. */
  insertPageAt: (position: number) => void
  /** Removes the single page at `index`, shifting later pages forward. No-op on a locked page or at the book's page-count floor. */
  removePageAt: (index: number) => void
  regenerate: () => void
  setActivePage: (index: number) => void
  setActiveHalf: (halfIndex: 0 | 1) => void
  select: (ref: SlotRef | null) => void
  applyTemplate: (templateId: string) => void
  /** Sets one half's own layout on a Split at Fold page. */
  applyHalfTemplate: (pageIndex: number, halfIndex: 0 | 1, templateId: string) => void
  assignPhoto: (ref: SlotRef, photoId: string) => void
  /**
   * Drops several photos into the next empty slots in reading order, starting
   * at the active page — for filling a run of upcoming layouts in one go
   * instead of placing each one by hand. Locked pages and already-filled
   * slots are skipped; leftover photos beyond the last empty slot just stay
   * in the tray.
   */
  fillNextEmptySlots: (photoIds: string[]) => void
  clearSlot: (ref: SlotRef) => void
  /**
   * Toggles a photo into (or out of) the pick-up list for click-to-place —
   * clicking more than one queues them in click order. Passing null clears
   * the whole list (used by Cancel/Escape).
   */
  armPhoto: (photoId: string | null) => void
  /** Places the front of the pick-up list into a slot, then advances the queue. */
  placeArmedPhoto: (ref: SlotRef) => void
  updatePlacement: (ref: SlotRef, patch: Partial<Placement>) => void
  togglePageLock: (pageIndex: number) => void
  /** Overrides one page's size within the A4 family (e.g. A4 <-> A4 Folded — Landscape). */
  setPageSize: (pageIndex: number, sizeId: string) => void
  setPageText: (pageIndex: number, text: string) => void
  /** Sets one half's own note on a Split at Fold page. */
  setHalfText: (pageIndex: number, halfIndex: 0 | 1, text: string) => void
  setPageTextStyle: (pageIndex: number, style: TextStyle) => void
  /** Sets one half's own note style on a Split at Fold page. */
  setHalfTextStyle: (pageIndex: number, halfIndex: 0 | 1, style: TextStyle) => void
  /** A tinted "cardstock" background for one page — undefined restores the default paper color. Clears backgroundPhotoId. */
  setPageBackground: (pageIndex: number, color: string | undefined) => void
  /** A full-bleed background photo for one page — undefined removes it. Clears backgroundColor. */
  setPageBackgroundPhoto: (pageIndex: number, photoId: string | undefined) => void
  /** How much to darken the background photo, 0–100. */
  setPageBackgroundDim: (pageIndex: number, dim: number) => void
  /** How much of the page the background photo covers — undefined means edge to edge. */
  setPageBackgroundCoverage: (pageIndex: number, coverage: Page['backgroundPhotoCoverage']) => void
  /** Same B&W/sepia/negative treatment as a slotted photo — undefined restores full color. */
  setPageBackgroundFilter: (pageIndex: number, filter: PhotoFilter | undefined) => void
  /** Multiplies the template's own margin for one page — 1 restores the default. */
  setPageMarginScale: (pageIndex: number, scale: number) => void
  movePage: (from: number, to: number) => void
  /** customId is required (and only meaningful) when type is 'custom'. */
  addSticker: (pageIndex: number, halfIndex: 0 | 1 | undefined, type: StickerType, customId?: string) => void
  addTextBox: (pageIndex: number, halfIndex: 0 | 1 | undefined) => void
  /** Saves a drawing to this book's sticker library; returns its new id. */
  addCustomSticker: (dataUrl: string) => string
  /** Removes a drawing from the library and strips any already-placed copies of it. */
  removeCustomSticker: (id: string) => void
  updateSticker: (ref: DecorationRef, patch: Partial<Sticker>) => void
  updateTextBox: (ref: DecorationRef, patch: Partial<TextBox>) => void
  removeDecoration: (ref: DecorationRef) => void
  selectDecoration: (ref: DecorationRef | null) => void
  reset: () => Promise<void>
  /** Writes immediately instead of waiting for the debounce — call before
   *  navigating away, so My Books never shows a moment-stale card. */
  flushPending: () => void
  /** Steps back to the previous layout/content snapshot, if any. */
  undo: () => void
  /** Steps forward again after an undo, if nothing new was done since. */
  redo: () => void
}

interface HistorySnapshot {
  pages: Page[]
  title: string
  sizeId: string
  customStickers: CustomSticker[]
}

const MAX_HISTORY = 50
/** Edits fired within this window of the last one (a drag, a slider) are treated as one undo step. */
const HISTORY_COALESCE_MS = 500

function projectFrom(
  state: Pick<StoreState, 'projectId' | 'title' | 'sizeId' | 'pages' | 'customStickers'>,
  createdAt: number,
): Project {
  return {
    id: state.projectId!,
    title: state.title,
    sizeId: state.sizeId,
    pages: state.pages,
    customStickers: state.customStickers,
    createdAt,
    updatedAt: Date.now(),
  }
}

export const useStore = create<StoreState>((set, get) => {
  /** Debounced write-behind so dragging a photo doesn't hammer IndexedDB. */
  let saveTimer: number | undefined
  let importNoticeTimer: number | undefined
  let openedAt = Date.now()
  const writeNow = () => {
    const { projectId, title, sizeId, pages, customStickers } = get()
    if (!projectId) return
    void storage.saveProject(projectFrom({ projectId, title, sizeId, pages, customStickers }, openedAt))
  }
  const persist = () => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(writeNow, 400)
  }

  /** Apply a change to the pages array and persist it. */
  const mutatePages = (fn: (pages: Page[]) => Page[]) => {
    set((state) => ({ pages: fn(state.pages) }))
    persist()
  }

  /**
   * Captures an undo checkpoint of the pre-mutation state — call this first,
   * before applying a state-changing action. Rapid successive calls (dragging
   * a slider, panning a photo) within HISTORY_COALESCE_MS collapse into the
   * one checkpoint from before the whole burst, so undo reverts the burst as
   * a single step rather than one tiny step at a time.
   */
  let lastRecordAt = 0
  const recordHistory = () => {
    const now = Date.now()
    const { undoStack, pages, title, sizeId, customStickers } = get()
    if (now - lastRecordAt > HISTORY_COALESCE_MS || undoStack.length === 0) {
      const snapshot: HistorySnapshot = { pages, title, sizeId, customStickers }
      set({ undoStack: [...undoStack, snapshot].slice(-MAX_HISTORY), redoStack: [] })
    }
    lastRecordAt = now
  }

  return {
    ready: false,
    projectId: null,
    photos: [],
    title: 'Untitled Book',
    sizeId: DEFAULT_SIZE_ID,
    pages: [],
    customStickers: [],
    activePageIndex: 0,
    activeHalfIndex: 0,
    selected: null,
    selectedDecoration: null,
    importing: false,
    armedPhotoIds: [],
    importNotice: null,
    undoStack: [],
    redoStack: [],

    async init(projectId) {
      set({ ready: false })
      const [photos, project] = await Promise.all([
        storage.loadPhotosForProject(projectId),
        storage.loadProject(projectId),
      ])
      openedAt = project?.createdAt ?? Date.now()
      if (project) {
        set({
          ready: true,
          projectId,
          photos,
          title: project.title,
          sizeId: project.sizeId,
          pages: normalizePages(project.pages),
          customStickers: project.customStickers ?? [],
          activePageIndex: 0,
          selected: null,
          armedPhotoIds: [],
          undoStack: [],
          redoStack: [],
        })
      } else {
        // Shouldn't normally happen — My Books always creates the project
        // record before opening it — but a blank starting book is a safe fallback.
        const size = getSize(DEFAULT_SIZE_ID)
        const pages = autoLayout({ photos: [], size, pageCount: sizeMinPages(size) })
        set({
          ready: true,
          projectId,
          photos: [],
          title: 'Untitled Book',
          sizeId: DEFAULT_SIZE_ID,
          pages,
          customStickers: [],
          activePageIndex: 0,
          selected: null,
          undoStack: [],
          redoStack: [],
        })
        persist()
      }
    },

    async addFiles(files) {
      const { projectId, photos: existing } = get()
      if (!projectId) return
      set({ importing: true })
      try {
        const existingHashes = new Set(existing.map((p) => p.hash).filter((h): h is string => !!h))
        const { photos: imported, duplicateCount } = await importFiles(files, projectId, existingHashes)

        if (imported.length > 0) {
          // Importing only adds photos to the library. Nothing is placed on any
          // page automatically — that's a deliberate choice the designer makes.
          await storage.savePhotos(imported)
          set((state) => ({ photos: [...state.photos, ...imported] }))
          persist()
        }

        if (duplicateCount > 0) {
          const notice =
            duplicateCount === 1
              ? 'Skipped 1 photo — already in this book.'
              : `Skipped ${duplicateCount} photos — already in this book.`
          set({ importNotice: notice })
          window.clearTimeout(importNoticeTimer)
          importNoticeTimer = window.setTimeout(() => set({ importNotice: null }), 4000)
        }
      } finally {
        set({ importing: false })
      }
    },

    async removePhoto(photoId) {
      await get().removePhotos([photoId])
    },

    async removePhotos(photoIds) {
      const idSet = new Set(photoIds)
      if (idSet.size === 0) return

      await storage.deletePhotos(photoIds)
      for (const id of idSet) releasePhotoUrl(id)
      set((state) => ({
        photos: state.photos.filter((p) => !idSet.has(p.id)),
        armedPhotoIds: state.armedPhotoIds.filter((id) => !idSet.has(id)),
      }))
      const strip = (placements: (Placement | null)[]) =>
        placements.map((slot) => (slot && idSet.has(slot.photoId) ? null : slot))
      mutatePages((pages) =>
        pages.map((page) => ({
          ...page,
          placements: strip(page.placements),
          ...(page.halves && {
            halves: [
              { ...page.halves[0], placements: strip(page.halves[0].placements) },
              { ...page.halves[1], placements: strip(page.halves[1].placements) },
            ] as [HalfLayout, HalfLayout],
          }),
        })),
      )
    },

    setTitle(title) {
      recordHistory()
      set({ title })
      persist()
    },

    setSize(sizeId) {
      recordHistory()
      const size = getSize(sizeId)
      set((state) => {
        // A page's own orientation override only makes sense against the book
        // size it was chosen relative to — a fresh book size clears it, except
        // on locked pages, which stay exactly as they are like everything else
        // about them.
        const pages = state.pages.map((page) =>
          page.locked || !page.sizeId ? page : { ...page, sizeId: undefined },
        )
        return { sizeId, pages: reconcileTemplates(pages, size), selected: null }
      })
      persist()
    },

    setPageCount(count) {
      recordHistory()
      const size = getSize(get().sizeId)
      set((state) => {
        const pages = resizePages(state.pages, count, size)
        return {
          pages,
          activePageIndex: Math.min(state.activePageIndex, pages.length - 1),
          selected: null,
        }
      })
      persist()
    },

    insertPageAt(position) {
      const { pages, sizeId } = get()
      const size = getSize(sizeId)
      const ceiling = maxPagesForSize(size)
      // Both counts matter: pages, and the slides they export to — a strip of
      // spanning artboards runs out of slides long before it runs out of pages.
      if (pages.length >= ceiling || totalSlides(pages) >= ceiling) return
      recordHistory()
      set({
        pages: insertPage(pages, position, size),
        activePageIndex: position,
        activeHalfIndex: 0,
        selected: null,
      })
      persist()
    },

    removePageAt(index) {
      const { pages, activePageIndex, sizeId } = get()
      const page = pages[index]
      const size = getSize(sizeId)
      if (!page || page.locked || pages.length <= sizeMinPages(size)) return
      recordHistory()
      const nextPages = removePageFromList(pages, index, size)
      // Keep viewing the same content: a page removed ahead of the active one
      // shifts everything after it back by one index.
      const nextActive = index < activePageIndex ? activePageIndex - 1 : activePageIndex
      set({
        pages: nextPages,
        activePageIndex: Math.min(nextActive, nextPages.length - 1),
        activeHalfIndex: 0,
        selected: null,
      })
      persist()
    },

    regenerate() {
      recordHistory()
      const { photos, sizeId, pages } = get()
      const size = getSize(sizeId)
      // Locked pages, and the photos already on them, are left untouched —
      // only the unlocked pages get relaid out.
      set({ pages: regenerateUnlocked(pages, photos, size), selected: null })
      persist()
    },

    setActivePage(index) {
      const { pages } = get()
      set({
        activePageIndex: Math.max(0, Math.min(index, pages.length - 1)),
        // A new page starts on its first half, not wherever the last one was.
        activeHalfIndex: 0,
        selected: null,
        selectedDecoration: null,
      })
    },

    setActiveHalf(halfIndex) {
      set({ activeHalfIndex: halfIndex, selected: null, selectedDecoration: null })
    },

    select(ref) {
      // A locked page's slots aren't editable, so there's nothing to select.
      if (ref && get().pages[ref.pageIndex]?.locked) return
      // Clicking a slot inside one half of a Split at Fold page also switches
      // the Layout panel to that same half — otherwise picking a template
      // there could silently land on whichever half was last active instead
      // of the one you just clicked.
      set({
        selected: ref,
        selectedDecoration: null,
        ...(ref?.halfIndex !== undefined ? { activeHalfIndex: ref.halfIndex } : {}),
      })
    },

    applyTemplate(templateId) {
      const { activePageIndex, pages: current, sizeId } = get()
      if (current[activePageIndex]?.locked) return
      // A spanning layout turns one page into several slides, which can carry
      // a carousel past the platform's own limit. Refuse rather than export
      // more images than anyone can post; templatesFitting hides these in the
      // picker, so this is the backstop, not the message.
      const next = current.map((page, i) =>
        i === activePageIndex ? applyTemplateToPage(page, templateId) : page,
      )
      if (totalSlides(next) > maxPagesForSize(getSize(sizeId))) return
      recordHistory()
      mutatePages(() => next)
      set({ selected: null })
    },

    applyHalfTemplate(pageIndex, halfIndex, templateId) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex || !page.halves) return page
          const template = getTemplate(templateId)
          const existing = page.halves[halfIndex]
          const kept = existing.placements.filter((p): p is Placement => p !== null)
          const placements = template.slots.map((_, slotIndex) => kept[slotIndex] ?? null)
          const halves = [...page.halves] as [HalfLayout, HalfLayout]
          // The note survives a layout change, the same way photos do.
          halves[halfIndex] = { templateId, placements, text: existing.text }
          return { ...page, halves }
        }),
      )
      set({ selected: null })
    },

    assignPhoto({ pageIndex, slotIndex, halfIndex }, photoId) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          if (halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const placements = [...halves[halfIndex].placements]
            placements[slotIndex] = placementFor(photoId)
            halves[halfIndex] = { ...halves[halfIndex], placements }
            return { ...page, halves }
          }
          const placements = [...page.placements]
          placements[slotIndex] = placementFor(photoId)
          return { ...page, placements }
        }),
      )
    },

    fillNextEmptySlots(photoIds) {
      if (photoIds.length === 0) return
      recordHistory()
      const startIndex = get().activePageIndex
      const queue = [...photoIds]
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i < startIndex || page.locked || queue.length === 0) return page
          if (page.halves) {
            const halves = page.halves.map((half) => ({
              ...half,
              placements: half.placements.map((p) => (p || queue.length === 0 ? p : placementFor(queue.shift()!))),
            })) as [HalfLayout, HalfLayout]
            return { ...page, halves }
          }
          return {
            ...page,
            placements: page.placements.map((p) => (p || queue.length === 0 ? p : placementFor(queue.shift()!))),
          }
        }),
      )
    },

    armPhoto(photoId) {
      set((state) => {
        if (photoId === null) return { armedPhotoIds: [] }
        const already = state.armedPhotoIds.includes(photoId)
        return {
          armedPhotoIds: already
            ? state.armedPhotoIds.filter((id) => id !== photoId)
            : [...state.armedPhotoIds, photoId],
        }
      })
    },

    placeArmedPhoto(ref) {
      const [next, ...rest] = get().armedPhotoIds
      if (!next) return
      get().assignPhoto(ref, next)
      set({ armedPhotoIds: rest })
    },

    clearSlot({ pageIndex, slotIndex, halfIndex }) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          if (halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const placements = [...halves[halfIndex].placements]
            placements[slotIndex] = null
            halves[halfIndex] = { ...halves[halfIndex], placements }
            return { ...page, halves }
          }
          const placements = [...page.placements]
          placements[slotIndex] = null
          return { ...page, placements }
        }),
      )
    },

    updatePlacement({ pageIndex, slotIndex, halfIndex }, patch) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      const applyPatch = (existing: Placement | null): Placement | null => {
        if (!existing) return existing
        const next: Placement = { ...existing, ...patch }
        next.zoom = clampZoom(next.zoom)
        next.offsetX = clampOffset(next.offsetX)
        next.offsetY = clampOffset(next.offsetY)
        return next
      }
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          if (halfIndex !== undefined && page.halves) {
            const existing = page.halves[halfIndex].placements[slotIndex]
            if (!existing) return page
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const placements = [...halves[halfIndex].placements]
            placements[slotIndex] = applyPatch(existing)
            halves[halfIndex] = { ...halves[halfIndex], placements }
            return { ...page, halves }
          }
          const existing = page.placements[slotIndex]
          if (!existing) return page
          const placements = [...page.placements]
          placements[slotIndex] = applyPatch(existing)
          return { ...page, placements }
        }),
      )
    },

    togglePageLock(pageIndex) {
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, locked: !page.locked } : page)),
      )
    },

    setPageSize(pageIndex, sizeId) {
      const { sizeId: bookSizeId, pages: current } = get()
      if (current[pageIndex]?.locked) return
      recordHistory()
      const newSize = getSize(sizeId)
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          const fitted = fitPageToSize(page, newSize)
          return { ...fitted, sizeId: sizeId === bookSizeId ? undefined : sizeId }
        }),
      )
    },

    setPageText(pageIndex, text) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, text } : page)),
      )
    },

    setHalfText(pageIndex, halfIndex, text) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex || !page.halves) return page
          const halves = [...page.halves] as [HalfLayout, HalfLayout]
          halves[halfIndex] = { ...halves[halfIndex], text }
          return { ...page, halves }
        }),
      )
    },

    setPageTextStyle(pageIndex, style) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, textStyle: style } : page)),
      )
    },

    setPageBackground(pageIndex, color) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) =>
          i === pageIndex ? { ...page, backgroundColor: color, backgroundPhotoId: undefined } : page,
        ),
      )
    },

    setPageBackgroundPhoto(pageIndex, photoId) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) =>
          i === pageIndex ? { ...page, backgroundPhotoId: photoId, backgroundColor: undefined } : page,
        ),
      )
    },

    setPageBackgroundDim(pageIndex, dim) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, backgroundDim: dim } : page)),
      )
    },

    setPageBackgroundCoverage(pageIndex, coverage) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, backgroundPhotoCoverage: coverage } : page)),
      )
    },

    setPageBackgroundFilter(pageIndex, filter) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, backgroundPhotoFilter: filter } : page)),
      )
    },

    setPageMarginScale(pageIndex, scale) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, marginScale: scale } : page)),
      )
    },

    setHalfTextStyle(pageIndex, halfIndex, style) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex || !page.halves) return page
          const halves = [...page.halves] as [HalfLayout, HalfLayout]
          halves[halfIndex] = { ...halves[halfIndex], textStyle: style }
          return { ...page, halves }
        }),
      )
    },

    movePage(from, to) {
      recordHistory()
      mutatePages((pages) => {
        if (from === to || from < 0 || from >= pages.length) return pages
        if (pages[from].locked) return pages
        const next = [...pages]
        const [moved] = next.splice(from, 1)
        next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
        return next
      })
      set({ activePageIndex: Math.max(0, Math.min(to, get().pages.length - 1)), selected: null })
    },

    addSticker(pageIndex, halfIndex, type, customId) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      const id = nextDecorationId()
      // A doodle is usually closer to square than the built-in tape/icon
      // stickers, which read better in a wider box.
      const sticker: Sticker =
        type === 'custom'
          ? { id, type, customId, x: 34, y: 32, w: 22, h: 18 }
          : { id, type, x: 32, y: 32, w: 26, h: 12 }
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          if (halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const host = halves[halfIndex]
            halves[halfIndex] = { ...host, stickers: [...(host.stickers ?? []), sticker] }
            return { ...page, halves }
          }
          return { ...page, stickers: [...(page.stickers ?? []), sticker] }
        }),
      )
      set({ selectedDecoration: { pageIndex, halfIndex, kind: 'sticker', id }, selected: null })
    },

    addTextBox(pageIndex, halfIndex) {
      if (get().pages[pageIndex]?.locked) return
      recordHistory()
      const id = nextDecorationId()
      const textBox: TextBox = {
        id,
        x: 20,
        y: 40,
        w: 60,
        h: 16,
        text: 'Tap to edit',
        font: 'hand1',
        bold: false,
        align: 'center',
      }
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          if (halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const host = halves[halfIndex]
            halves[halfIndex] = { ...host, textBoxes: [...(host.textBoxes ?? []), textBox] }
            return { ...page, halves }
          }
          return { ...page, textBoxes: [...(page.textBoxes ?? []), textBox] }
        }),
      )
      set({ selectedDecoration: { pageIndex, halfIndex, kind: 'textBox', id }, selected: null })
    },

    addCustomSticker(dataUrl) {
      recordHistory()
      const id = nextCustomStickerId()
      set((state) => ({ customStickers: [...state.customStickers, { id, dataUrl }] }))
      persist()
      return id
    },

    removeCustomSticker(id) {
      recordHistory()
      set((state) => ({ customStickers: state.customStickers.filter((c) => c.id !== id) }))
      // Any already-placed copies of this drawing would otherwise linger as
      // invisible, still-draggable boxes once the artwork behind them is gone.
      mutatePages((pages) =>
        pages.map((page) => {
          const stripFrom = (stickers: Sticker[] | undefined) =>
            stickers?.filter((s) => !(s.type === 'custom' && s.customId === id))
          if (page.halves) {
            const halves = page.halves.map((half) => ({ ...half, stickers: stripFrom(half.stickers) })) as [
              HalfLayout,
              HalfLayout,
            ]
            return { ...page, halves }
          }
          return { ...page, stickers: stripFrom(page.stickers) }
        }),
      )
    },

    updateSticker(ref, patch) {
      if (get().pages[ref.pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== ref.pageIndex) return page
          if (ref.halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const host = halves[ref.halfIndex]
            const stickers = (host.stickers ?? []).map((s) => (s.id === ref.id ? { ...s, ...patch } : s))
            halves[ref.halfIndex] = { ...host, stickers }
            return { ...page, halves }
          }
          const stickers = (page.stickers ?? []).map((s) => (s.id === ref.id ? { ...s, ...patch } : s))
          return { ...page, stickers }
        }),
      )
    },

    updateTextBox(ref, patch) {
      if (get().pages[ref.pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== ref.pageIndex) return page
          if (ref.halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const host = halves[ref.halfIndex]
            const textBoxes = (host.textBoxes ?? []).map((t) => (t.id === ref.id ? { ...t, ...patch } : t))
            halves[ref.halfIndex] = { ...host, textBoxes }
            return { ...page, halves }
          }
          const textBoxes = (page.textBoxes ?? []).map((t) => (t.id === ref.id ? { ...t, ...patch } : t))
          return { ...page, textBoxes }
        }),
      )
    },

    removeDecoration(ref) {
      if (get().pages[ref.pageIndex]?.locked) return
      recordHistory()
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== ref.pageIndex) return page
          if (ref.halfIndex !== undefined && page.halves) {
            const halves = [...page.halves] as [HalfLayout, HalfLayout]
            const host = halves[ref.halfIndex]
            halves[ref.halfIndex] =
              ref.kind === 'sticker'
                ? { ...host, stickers: (host.stickers ?? []).filter((s) => s.id !== ref.id) }
                : { ...host, textBoxes: (host.textBoxes ?? []).filter((t) => t.id !== ref.id) }
            return { ...page, halves }
          }
          return ref.kind === 'sticker'
            ? { ...page, stickers: (page.stickers ?? []).filter((s) => s.id !== ref.id) }
            : { ...page, textBoxes: (page.textBoxes ?? []).filter((t) => t.id !== ref.id) }
        }),
      )
      set({ selectedDecoration: null })
    },

    selectDecoration(ref) {
      set({ selectedDecoration: ref, selected: null })
    },

    async reset() {
      const { projectId, photos } = get()
      if (!projectId) return
      // Only this book's photos are cleared — the rest of My Books is untouched.
      await storage.clearProject(projectId)
      for (const photo of photos) releasePhotoUrl(photo.id)
      const size = getSize(DEFAULT_SIZE_ID)
      set({
        photos: [],
        title: 'Untitled Book',
        sizeId: DEFAULT_SIZE_ID,
        pages: autoLayout({ photos: [], size, pageCount: sizeMinPages(size) }),
        customStickers: [],
        activePageIndex: 0,
        selected: null,
        undoStack: [],
        redoStack: [],
      })
      persist()
    },

    flushPending() {
      window.clearTimeout(saveTimer)
      writeNow()
    },

    undo() {
      const { undoStack, redoStack, pages, title, sizeId, customStickers } = get()
      const prev = undoStack[undoStack.length - 1]
      if (!prev) return
      const current: HistorySnapshot = { pages, title, sizeId, customStickers }
      lastRecordAt = 0
      set({
        ...prev,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, current],
        selected: null,
        selectedDecoration: null,
      })
      persist()
    },

    redo() {
      const { undoStack, redoStack, pages, title, sizeId, customStickers } = get()
      const next = redoStack[redoStack.length - 1]
      if (!next) return
      const current: HistorySnapshot = { pages, title, sizeId, customStickers }
      lastRecordAt = 0
      set({
        ...next,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, current],
        selected: null,
        selectedDecoration: null,
      })
      persist()
    },
  }
})
