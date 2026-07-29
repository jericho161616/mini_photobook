import { create } from 'zustand'
import { DEFAULT_SIZE_ID, getSize } from '../data/sizes'
import { getTemplate } from '../data/templates'
import {
  autoLayout,
  clampPages,
  emptyPlacements,
  placementFor,
  reconcileTemplates,
  resizePages,
  suggestPageCount,
} from '../lib/autoLayout'
import * as storage from '../lib/db'
import { clampOffset, clampZoom, importFiles, releasePhotoUrl } from '../lib/imageUtils'
import type { Page, Photo, Placement, Project, Shape } from '../types'

export interface SlotRef {
  pageIndex: number
  slotIndex: number
}

interface StoreState {
  ready: boolean
  photos: Photo[]
  title: string
  sizeId: string
  pages: Page[]
  activePageIndex: number
  selected: SlotRef | null
  shapeFilter: Shape | 'all'
  importing: boolean

  init: () => Promise<void>
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
  movePage: (from: number, to: number) => void
  reset: () => Promise<void>
}

function projectFrom(state: Pick<StoreState, 'title' | 'sizeId' | 'pages'>): Project {
  return {
    id: storage.CURRENT_PROJECT_ID,
    title: state.title,
    sizeId: state.sizeId,
    pages: state.pages,
    updatedAt: Date.now(),
  }
}

export const useStore = create<StoreState>((set, get) => {
  /** Debounced write-behind so dragging a photo doesn't hammer IndexedDB. */
  let saveTimer: number | undefined
  const persist = () => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const { title, sizeId, pages } = get()
      void storage.saveProject(projectFrom({ title, sizeId, pages }))
    }, 400)
  }

  /** Apply a change to the pages array and persist it. */
  const mutatePages = (fn: (pages: Page[]) => Page[]) => {
    set((state) => ({ pages: fn(state.pages) }))
    persist()
  }

  return {
    ready: false,
    photos: [],
    title: 'Untitled Book',
    sizeId: DEFAULT_SIZE_ID,
    pages: [],
    activePageIndex: 0,
    selected: null,
    shapeFilter: 'all',
    importing: false,

    async init() {
      const [photos, project] = await Promise.all([storage.loadPhotos(), storage.loadProject()])
      if (project) {
        set({ ready: true, photos, title: project.title, sizeId: project.sizeId, pages: project.pages })
      } else {
        const size = getSize(DEFAULT_SIZE_ID)
        const pages = autoLayout({ photos, size, pageCount: suggestPageCount(photos.length, size) })
        set({ ready: true, photos, pages })
        persist()
      }
    },

    async addFiles(files) {
      set({ importing: true })
      try {
        const imported = await importFiles(files)
        if (imported.length === 0) return

        await storage.savePhotos(imported)
        const photos = [...get().photos, ...imported]
        set({ photos })

        // First import lays the book out; later imports flow into empty slots
        // so the designer's existing work survives.
        const { pages } = get()
        const hasContent = pages.some((p) => p.placements.some((slot) => slot !== null))

        if (!hasContent) {
          const size = getSize(get().sizeId)
          set({
            pages: autoLayout({ photos, size, pageCount: suggestPageCount(photos.length, size) }),
          })
        } else {
          const queue = [...imported]
          mutatePages((current) =>
            current.map((page) => {
              if (queue.length === 0) return page
              const placements = page.placements.map((slot) => {
                if (slot !== null || queue.length === 0) return slot
                return placementFor(queue.shift()!.id)
              })
              return { ...page, placements }
            }),
          )
        }
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
      set((state) => ({ sizeId, pages: reconcileTemplates(state.pages, size), selected: null }))
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
      set({
        pages: autoLayout({ photos, size, pageCount: clampPages(pages.length) }),
        selected: null,
      })
      persist()
    },

    setActivePage(index) {
      const { pages } = get()
      set({ activePageIndex: Math.max(0, Math.min(index, pages.length - 1)), selected: null })
    },

    select(ref) {
      set({ selected: ref })
    },

    setShapeFilter(shapeFilter) {
      set({ shapeFilter })
    },

    applyTemplate(templateId) {
      const { activePageIndex } = get()
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

    movePage(from, to) {
      mutatePages((pages) => {
        if (from === to || from < 0 || from >= pages.length) return pages
        const next = [...pages]
        const [moved] = next.splice(from, 1)
        next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
        return next
      })
      set({ activePageIndex: Math.max(0, Math.min(to, get().pages.length - 1)), selected: null })
    },

    async reset() {
      await storage.clearEverything()
      for (const photo of get().photos) releasePhotoUrl(photo.id)
      const size = getSize(DEFAULT_SIZE_ID)
      set({
        photos: [],
        title: 'Untitled Book',
        sizeId: DEFAULT_SIZE_ID,
        pages: autoLayout({ photos: [], size, pageCount: suggestPageCount(0, size) }),
        activePageIndex: 0,
        selected: null,
      })
      persist()
    },
  }
})

/** Slots with no photo, in reading order — used to place the next import. */
export function emptySlotCount(pages: Page[]): number {
  return pages.reduce((sum, page) => sum + page.placements.filter((p) => p === null).length, 0)
}

export { emptyPlacements }
