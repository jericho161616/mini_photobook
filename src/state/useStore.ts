import { create } from 'zustand'
import { DEFAULT_SIZE_ID, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import {
  applyTemplateToPage,
  autoLayout,
  fitPageToSize,
  normalizePages,
  placementFor,
  reconcileTemplates,
  regenerateUnlocked,
  resizePages,
} from '../lib/autoLayout'
import * as storage from '../lib/db'
import { clampOffset, clampZoom, importFiles, releasePhotoUrl } from '../lib/imageUtils'
import { MIN_PAGES } from '../types'
import type {
  HalfLayout,
  Page,
  Photo,
  Placement,
  Project,
  Shape,
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


interface StoreState {
  ready: boolean
  projectId: string | null
  photos: Photo[]
  title: string
  sizeId: string
  pages: Page[]
  activePageIndex: number
  /** Which side of a Split at Fold page the sidebar is currently editing. */
  activeHalfIndex: 0 | 1
  selected: SlotRef | null
  /** The one freely placed sticker or text box currently selected, if any. */
  selectedDecoration: DecorationRef | null
  shapeFilter: Shape | 'all'
  importing: boolean
  /**
   * A photo "picked up" by clicking it rather than dragging it — the next
   * slot clicked receives it. Exists for when dragging is awkward (a long
   * scroll to find the right photo, a trackpad, a small screen).
   */
  armedPhotoId: string | null

  init: (projectId: string) => Promise<void>
  addFiles: (files: File[]) => Promise<void>
  removePhoto: (photoId: string) => Promise<void>
  removePhotos: (photoIds: string[]) => Promise<void>
  setTitle: (title: string) => void
  setSize: (sizeId: string) => void
  setPageCount: (count: number) => void
  regenerate: () => void
  setActivePage: (index: number) => void
  setActiveHalf: (halfIndex: 0 | 1) => void
  select: (ref: SlotRef | null) => void
  setShapeFilter: (shape: Shape | 'all') => void
  applyTemplate: (templateId: string) => void
  /** Sets one half's own layout on a Split at Fold page. */
  applyHalfTemplate: (pageIndex: number, halfIndex: 0 | 1, templateId: string) => void
  assignPhoto: (ref: SlotRef, photoId: string) => void
  clearSlot: (ref: SlotRef) => void
  /** Arms a photo for click-to-place; passing the already-armed id, or null, disarms it. */
  armPhoto: (photoId: string | null) => void
  /** Places the armed photo (if any) into a slot, then disarms it. */
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
  movePage: (from: number, to: number) => void
  addSticker: (pageIndex: number, halfIndex: 0 | 1 | undefined, type: StickerType) => void
  addTextBox: (pageIndex: number, halfIndex: 0 | 1 | undefined) => void
  updateSticker: (ref: DecorationRef, patch: Partial<Sticker>) => void
  updateTextBox: (ref: DecorationRef, patch: Partial<TextBox>) => void
  removeDecoration: (ref: DecorationRef) => void
  selectDecoration: (ref: DecorationRef | null) => void
  reset: () => Promise<void>
  /** Writes immediately instead of waiting for the debounce — call before
   *  navigating away, so My Books never shows a moment-stale card. */
  flushPending: () => void
}

function projectFrom(
  state: Pick<StoreState, 'projectId' | 'title' | 'sizeId' | 'pages'>,
  createdAt: number,
): Project {
  return {
    id: state.projectId!,
    title: state.title,
    sizeId: state.sizeId,
    pages: state.pages,
    createdAt,
    updatedAt: Date.now(),
  }
}

export const useStore = create<StoreState>((set, get) => {
  /** Debounced write-behind so dragging a photo doesn't hammer IndexedDB. */
  let saveTimer: number | undefined
  let openedAt = Date.now()
  const writeNow = () => {
    const { projectId, title, sizeId, pages } = get()
    if (!projectId) return
    void storage.saveProject(projectFrom({ projectId, title, sizeId, pages }, openedAt))
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

  return {
    ready: false,
    projectId: null,
    photos: [],
    title: 'Untitled Book',
    sizeId: DEFAULT_SIZE_ID,
    pages: [],
    activePageIndex: 0,
    activeHalfIndex: 0,
    selected: null,
    selectedDecoration: null,
    shapeFilter: 'all',
    importing: false,
    armedPhotoId: null,

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
          activePageIndex: 0,
          selected: null,
          armedPhotoId: null,
        })
      } else {
        // Shouldn't normally happen — My Books always creates the project
        // record before opening it — but a blank starting book is a safe fallback.
        const size = getSize(DEFAULT_SIZE_ID)
        const pages = autoLayout({ photos: [], size, pageCount: MIN_PAGES })
        set({
          ready: true,
          projectId,
          photos: [],
          title: 'Untitled Book',
          sizeId: DEFAULT_SIZE_ID,
          pages,
          activePageIndex: 0,
          selected: null,
        })
        persist()
      }
    },

    async addFiles(files) {
      const { projectId } = get()
      if (!projectId) return
      set({ importing: true })
      try {
        const imported = await importFiles(files, projectId)
        if (imported.length === 0) return

        // Importing only adds photos to the library. Nothing is placed on any
        // page automatically — that's a deliberate choice the designer makes.
        await storage.savePhotos(imported)
        set((state) => ({ photos: [...state.photos, ...imported] }))
        persist()
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
        armedPhotoId: state.armedPhotoId && idSet.has(state.armedPhotoId) ? null : state.armedPhotoId,
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
      set({ title })
      persist()
    },

    setSize(sizeId) {
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

    regenerate() {
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
      set({ selected: ref, selectedDecoration: null })
    },

    setShapeFilter(shapeFilter) {
      set({ shapeFilter })
    },

    applyTemplate(templateId) {
      const { activePageIndex, pages: current } = get()
      if (current[activePageIndex]?.locked) return
      mutatePages((pages) =>
        pages.map((page, i) => (i === activePageIndex ? applyTemplateToPage(page, templateId) : page)),
      )
      set({ selected: null })
    },

    applyHalfTemplate(pageIndex, halfIndex, templateId) {
      if (get().pages[pageIndex]?.locked) return
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

    armPhoto(photoId) {
      set((state) => ({ armedPhotoId: state.armedPhotoId === photoId ? null : photoId }))
    },

    placeArmedPhoto(ref) {
      const { armedPhotoId } = get()
      if (!armedPhotoId) return
      get().assignPhoto(ref, armedPhotoId)
      set({ armedPhotoId: null })
    },

    clearSlot({ pageIndex, slotIndex, halfIndex }) {
      if (get().pages[pageIndex]?.locked) return
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
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, locked: !page.locked } : page)),
      )
    },

    setPageSize(pageIndex, sizeId) {
      const { sizeId: bookSizeId, pages: current } = get()
      if (current[pageIndex]?.locked) return
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
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, text } : page)),
      )
    },

    setHalfText(pageIndex, halfIndex, text) {
      if (get().pages[pageIndex]?.locked) return
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
      mutatePages((pages) =>
        pages.map((page, i) => (i === pageIndex ? { ...page, textStyle: style } : page)),
      )
    },

    setHalfTextStyle(pageIndex, halfIndex, style) {
      if (get().pages[pageIndex]?.locked) return
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

    addSticker(pageIndex, halfIndex, type) {
      if (get().pages[pageIndex]?.locked) return
      const id = nextDecorationId()
      const sticker: Sticker = { id, type, x: 32, y: 32, w: 26, h: 12 }
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

    updateSticker(ref, patch) {
      if (get().pages[ref.pageIndex]?.locked) return
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
        pages: autoLayout({ photos: [], size, pageCount: MIN_PAGES }),
        activePageIndex: 0,
        selected: null,
      })
      persist()
    },

    flushPending() {
      window.clearTimeout(saveTimer)
      writeNow()
    },
  }
})
