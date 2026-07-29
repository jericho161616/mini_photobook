import { create } from 'zustand'
import { DEFAULT_SIZE_ID, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import {
  autoLayout,
  fitPageToSize,
  placementFor,
  reconcileTemplates,
  regenerateUnlocked,
  resizePages,
} from '../lib/autoLayout'
import * as storage from '../lib/db'
import { clampOffset, clampZoom, importFiles, releasePhotoUrl } from '../lib/imageUtils'
import { MIN_PAGES } from '../types'
import type { Page, Photo, Placement, Project, Shape } from '../types'

export interface SlotRef {
  pageIndex: number
  slotIndex: number
}

interface StoreState {
  ready: boolean
  projectId: string | null
  photos: Photo[]
  title: string
  sizeId: string
  pages: Page[]
  activePageIndex: number
  selected: SlotRef | null
  shapeFilter: Shape | 'all'
  importing: boolean

  init: (projectId: string) => Promise<void>
  addFiles: (files: File[]) => Promise<void>
  removePhoto: (photoId: string) => Promise<void>
  removePhotos: (photoIds: string[]) => Promise<void>
  setTitle: (title: string) => void
  setSize: (sizeId: string) => void
  setPageCount: (count: number) => void
  regenerate: () => void
  setActivePage: (index: number) => void
  select: (ref: SlotRef | null) => void
  setShapeFilter: (shape: Shape | 'all') => void
  applyTemplate: (templateId: string) => void
  assignPhoto: (ref: SlotRef, photoId: string) => void
  clearSlot: (ref: SlotRef) => void
  updatePlacement: (ref: SlotRef, patch: Partial<Placement>) => void
  togglePageLock: (pageIndex: number) => void
  /** Overrides one page's size within the A4 family (e.g. A4 <-> A4 Folded — Landscape). */
  setPageSize: (pageIndex: number, sizeId: string) => void
  setPageText: (pageIndex: number, text: string) => void
  movePage: (from: number, to: number) => void
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
    selected: null,
    shapeFilter: 'all',
    importing: false,

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
          pages: project.pages,
          activePageIndex: 0,
          selected: null,
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
      set((state) => ({ photos: state.photos.filter((p) => !idSet.has(p.id)) }))
      mutatePages((pages) =>
        pages.map((page) => ({
          ...page,
          placements: page.placements.map((slot) =>
            slot && idSet.has(slot.photoId) ? null : slot,
          ),
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
      set({ activePageIndex: Math.max(0, Math.min(index, pages.length - 1)), selected: null })
    },

    select(ref) {
      // A locked page's slots aren't editable, so there's nothing to select.
      if (ref && get().pages[ref.pageIndex]?.locked) return
      set({ selected: ref })
    },

    setShapeFilter(shapeFilter) {
      set({ shapeFilter })
    },

    applyTemplate(templateId) {
      const { activePageIndex, pages: current } = get()
      if (current[activePageIndex]?.locked) return
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== activePageIndex) return page
          const template = getTemplate(templateId)
          // Carry the photos already on this page into the new arrangement.
          const kept = page.placements.filter((p): p is Placement => p !== null)
          const placements = template.slots.map((_, slotIndex) => kept[slotIndex] ?? null)
          return { ...page, templateId, placements }
        }),
      )
      set({ selected: null })
    },

    assignPhoto({ pageIndex, slotIndex }, photoId) {
      if (get().pages[pageIndex]?.locked) return
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          const placements = [...page.placements]
          placements[slotIndex] = placementFor(photoId)
          return { ...page, placements }
        }),
      )
    },

    clearSlot({ pageIndex, slotIndex }) {
      if (get().pages[pageIndex]?.locked) return
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          const placements = [...page.placements]
          placements[slotIndex] = null
          return { ...page, placements }
        }),
      )
    },

    updatePlacement({ pageIndex, slotIndex }, patch) {
      if (get().pages[pageIndex]?.locked) return
      mutatePages((pages) =>
        pages.map((page, i) => {
          if (i !== pageIndex) return page
          const placements = [...page.placements]
          const existing = placements[slotIndex]
          if (!existing) return page
          const next: Placement = { ...existing, ...patch }
          next.zoom = clampZoom(next.zoom)
          next.offsetX = clampOffset(next.offsetX)
          next.offsetY = clampOffset(next.offsetY)
          placements[slotIndex] = next
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
