import Dexie, { type EntityTable } from 'dexie'
import { TRASH_RETENTION_MS } from '../types'
import type { Photo, Placement, Project } from '../types'

/**
 * Everything lives in the browser's own IndexedDB. No network calls, no
 * accounts — closing the tab keeps every book, and clearing site data drops
 * them all. Each book keeps its own fully separate set of photos.
 */
class PhotobookDB extends Dexie {
  photos!: EntityTable<Photo, 'id'>
  projects!: EntityTable<Project, 'id'>

  constructor() {
    super('mini-photobook')

    // v1 held exactly one project, fixed at this id, with a shared photo pool.
    this.version(1).stores({
      photos: 'id, addedAt',
      projects: 'id, updatedAt',
    })

    // v2 supports multiple books. Existing photos and the existing project
    // both already belong together — they just needed the id to say so.
    this.version(2)
      .stores({
        photos: 'id, projectId, addedAt',
        projects: 'id, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('photos')
          .toCollection()
          .modify((photo) => {
            photo.projectId = LEGACY_PROJECT_ID
          })
        await tx
          .table('projects')
          .toCollection()
          .modify((project) => {
            project.createdAt ??= project.updatedAt
          })
      })
  }
}

export const db = new PhotobookDB()

/** The one project id that existed before books were separable. */
const LEGACY_PROJECT_ID = 'current'

let projectSeq = 0
export function newProjectId(): string {
  projectSeq += 1
  return `project-${Date.now().toString(36)}-${projectSeq}`
}

export async function loadPhotosForProject(projectId: string): Promise<Photo[]> {
  return db.photos.where('projectId').equals(projectId).sortBy('addedAt')
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

export async function listProjects(): Promise<Project[]> {
  const all = await db.projects.orderBy('updatedAt').reverse().toArray()
  return all.filter((p) => !p.deletedAt)
}

export async function listTrashedProjects(): Promise<Project[]> {
  const all = await db.projects.toArray()
  return all.filter((p) => p.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
}

/** Soft-delete: hides the book from My Books but keeps it (and its photos) in Trash. */
export async function trashProject(id: string): Promise<void> {
  await db.projects.update(id, { deletedAt: Date.now() })
}

/** Brings a trashed book back to My Books. */
export async function restoreProject(id: string): Promise<void> {
  await db.projects.update(id, { deletedAt: undefined })
}

/** Removes every trashed book older than the retention window for good. */
export async function purgeExpiredTrash(): Promise<void> {
  const trashed = await listTrashedProjects()
  const cutoff = Date.now() - TRASH_RETENTION_MS
  for (const project of trashed) {
    if ((project.deletedAt ?? 0) < cutoff) await deleteProjectCascade(project.id)
  }
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() })
}

export async function createProject(project: Project): Promise<void> {
  await db.projects.put(project)
}

export async function renameProject(id: string, title: string): Promise<void> {
  await db.projects.update(id, { title, updatedAt: Date.now() })
}

/** Deletes a project and every photo that belongs to it. */
export async function deleteProjectCascade(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.photos, async () => {
    await db.photos.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

/**
 * Full independent copy: new project id, new photo ids and blobs (copied,
 * not shared), and the copied pages' placements rewritten to point at the
 * new photo ids. Editing the copy can never affect the original.
 */
export async function duplicateProjectCascade(
  sourceId: string,
  newTitle: string,
): Promise<Project> {
  const source = await db.projects.get(sourceId)
  if (!source) throw new Error('Project not found')

  const sourcePhotos = await loadPhotosForProject(sourceId)
  const idMap = new Map<string, string>()
  let photoSeq = 0
  const nextPhotoId = () => {
    photoSeq += 1
    return `photo-${Date.now().toString(36)}-${photoSeq}-${Math.random().toString(36).slice(2, 6)}`
  }

  const copiedPhotos: Photo[] = sourcePhotos.map((photo) => {
    const newId = nextPhotoId()
    idMap.set(photo.id, newId)
    return { ...photo, id: newId, projectId: '' } // projectId filled in below
  })

  const newProject: Project = {
    ...source,
    id: newProjectId(),
    title: newTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: source.pages.map((page) => {
      const remap = (placement: Placement | null): Placement | null =>
        placement ? { ...placement, photoId: idMap.get(placement.photoId) ?? placement.photoId } : null
      return {
        ...page,
        placements: page.placements.map(remap),
        ...(page.halves && {
          halves: [
            { ...page.halves[0], placements: page.halves[0].placements.map(remap) },
            { ...page.halves[1], placements: page.halves[1].placements.map(remap) },
          ] as typeof page.halves,
        }),
      }
    }),
  }

  for (const photo of copiedPhotos) photo.projectId = newProject.id

  await db.transaction('rw', db.projects, db.photos, async () => {
    await db.projects.put(newProject)
    if (copiedPhotos.length > 0) await db.photos.bulkAdd(copiedPhotos)
  })

  return newProject
}

/** Wipes only one project's photos and pages — the other saved books are untouched. */
export async function clearProject(id: string): Promise<void> {
  await db.photos.where('projectId').equals(id).delete()
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return db.photos.get(id)
}
