import { create } from 'zustand'
import { DEFAULT_SIZE_ID, getSize } from '../data/sizes'
import { autoLayout, pagePlacements } from '../lib/autoLayout'
import * as storage from '../lib/db'
import { newProjectId } from '../lib/db'
import { MIN_PAGES } from '../types'
import type { Page, Photo, Project } from '../types'

export interface BookSummary {
  project: Project
  coverPhoto: Photo | undefined
}

interface LibraryState {
  ready: boolean
  books: BookSummary[]
  trashedBooks: BookSummary[]

  refresh: () => Promise<void>
  createBook: (title: string, sizeId: string) => Promise<string>
  renameBook: (id: string, title: string) => Promise<void>
  duplicateBook: (id: string) => Promise<string>
  /** Moves a book to Trash — recoverable with restoreBook for 30 days. */
  deleteBook: (id: string) => Promise<void>
  restoreBook: (id: string) => Promise<void>
  /** Removes a trashed book for good — cannot be undone. */
  permanentlyDeleteBook: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
}

/** The first photo actually placed on a page, in reading order — used as the cover art. */
function firstPlacedPhotoId(pages: Page[]): string | undefined {
  for (const page of pages) {
    for (const placement of pagePlacements(page)) {
      if (placement) return placement.photoId
    }
  }
  return undefined
}

async function toSummary(project: Project): Promise<BookSummary> {
  const photoId = firstPlacedPhotoId(project.pages)
  const coverPhoto = photoId ? await storage.getPhoto(photoId) : undefined
  return { project, coverPhoto }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ready: false,
  books: [],
  trashedBooks: [],

  async refresh() {
    await storage.purgeExpiredTrash()
    const [projects, trashed] = await Promise.all([storage.listProjects(), storage.listTrashedProjects()])
    const [books, trashedBooks] = await Promise.all([
      Promise.all(projects.map(toSummary)),
      Promise.all(trashed.map(toSummary)),
    ])
    set({ ready: true, books, trashedBooks })
  },

  async createBook(title, sizeId) {
    const size = getSize(sizeId || DEFAULT_SIZE_ID)
    const now = Date.now()
    const project: Project = {
      id: newProjectId(),
      title: title.trim() || 'Untitled Book',
      sizeId: size.id,
      pages: autoLayout({ photos: [], size, pageCount: MIN_PAGES }),
      createdAt: now,
      updatedAt: now,
    }
    await storage.createProject(project)
    await get().refresh()
    return project.id
  },

  async renameBook(id, title) {
    const trimmed = title.trim()
    if (!trimmed) return
    await storage.renameProject(id, trimmed)
    set((state) => ({
      books: state.books.map((b) =>
        b.project.id === id ? { ...b, project: { ...b.project, title: trimmed } } : b,
      ),
    }))
  },

  async duplicateBook(id) {
    const existing = get().books.find((b) => b.project.id === id)
    const newTitle = `${existing?.project.title ?? 'Untitled Book'} (Copy)`
    const copy = await storage.duplicateProjectCascade(id, newTitle)
    await get().refresh()
    return copy.id
  },

  async deleteBook(id) {
    await storage.trashProject(id)
    await get().refresh()
  },

  async restoreBook(id) {
    await storage.restoreProject(id)
    await get().refresh()
  },

  async permanentlyDeleteBook(id) {
    await storage.deleteProjectCascade(id)
    set((state) => ({ trashedBooks: state.trashedBooks.filter((b) => b.project.id !== id) }))
  },

  async emptyTrash() {
    const ids = get().trashedBooks.map((b) => b.project.id)
    await Promise.all(ids.map((id) => storage.deleteProjectCascade(id)))
    set({ trashedBooks: [] })
  },
}))
