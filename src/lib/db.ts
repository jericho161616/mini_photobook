import Dexie, { type EntityTable } from 'dexie'
import type { Photo, Project } from '../types'

/**
 * Everything lives in the browser's own IndexedDB. No network calls, no
 * accounts — closing the tab keeps the book, and clearing site data drops it.
 */
class PhotobookDB extends Dexie {
  photos!: EntityTable<Photo, 'id'>
  projects!: EntityTable<Project, 'id'>

  constructor() {
    super('mini-photobook')
    this.version(1).stores({
      photos: 'id, addedAt',
      projects: 'id, updatedAt',
    })
  }
}

export const db = new PhotobookDB()

export const CURRENT_PROJECT_ID = 'current'

export async function loadPhotos(): Promise<Photo[]> {
  return db.photos.orderBy('addedAt').toArray()
}

export async function savePhotos(photos: Photo[]): Promise<void> {
  await db.photos.bulkPut(photos)
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id)
}

export async function deletePhotos(ids: string[]): Promise<void> {
  await db.photos.bulkDelete(ids)
}

export async function loadProject(): Promise<Project | undefined> {
  return db.projects.get(CURRENT_PROJECT_ID)
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() })
}

export async function clearEverything(): Promise<void> {
  await Promise.all([db.photos.clear(), db.projects.clear()])
}
