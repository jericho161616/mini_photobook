import { useEffect, useState } from 'react'
import { photoThumbUrl } from '../lib/imageUtils'
import { useLibraryStore, type BookSummary } from '../state/useLibraryStore'
import { TRASH_RETENTION_MS } from '../types'
import { Icon } from './Icon'

function daysLeft(deletedAt: number | undefined): number {
  if (!deletedAt) return 0
  const remaining = deletedAt + TRASH_RETENTION_MS - Date.now()
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
}

interface TrashCardProps {
  book: BookSummary
  onRestore: () => void
  onDeleteForever: () => void
}

function TrashCard({ book, onRestore, onDeleteForever }: TrashCardProps) {
  const left = daysLeft(book.project.deletedAt)
  return (
    <div className="book-card trash-card">
      <div className="cover">
        {book.coverPhoto ? (
          <img className="cover-photo" src={photoThumbUrl(book.coverPhoto)} alt="" draggable={false} />
        ) : (
          <span className="placeholder-icon" aria-hidden="true">
            <Icon name="plus" size={24} />
          </span>
        )}
      </div>
      <div className="book-meta">
        <span className="book-title" title={book.project.title}>
          {book.project.title}
        </span>
        <span className="book-sub mono">
          {left === 0 ? 'Removed soon' : `${left} day${left === 1 ? '' : 's'} left`}
        </span>
      </div>
      <div className="trash-card-actions">
        <button className="btn" onClick={onRestore}>
          Restore
        </button>
        <button className="btn btn-danger" onClick={onDeleteForever}>
          Delete Forever
        </button>
      </div>
    </div>
  )
}

interface TrashViewProps {
  onClose: () => void
}

export function TrashView({ onClose }: TrashViewProps) {
  const trashedBooks = useLibraryStore((s) => s.trashedBooks)
  const restoreBook = useLibraryStore((s) => s.restoreBook)
  const permanentlyDeleteBook = useLibraryStore((s) => s.permanentlyDeleteBook)
  const emptyTrash = useLibraryStore((s) => s.emptyTrash)

  const [pendingForever, setPendingForever] = useState<BookSummary | null>(null)
  const [pendingEmpty, setPendingEmpty] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingForever) setPendingForever(null)
        else if (pendingEmpty) setPendingEmpty(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pendingForever, pendingEmpty])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Trash" onClick={onClose}>
      <div className="library-card" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2 className="library-title">
            Trash <span className="count mono">{trashedBooks.length}</span>
          </h2>
          <div className="library-actions">
            <button className="btn" onClick={onClose} aria-label="Close trash">
              Close
            </button>
          </div>
        </div>

        {trashedBooks.length === 0 ? (
          <p className="empty-note">Trash is empty.</p>
        ) : (
          <>
            <p className="hint">
              Books here are deleted for good after 30 days. Restore one to bring it back to My
              Books, or delete it forever right away.
            </p>
            <div className="shelf trash-shelf">
              {trashedBooks.map((book) => (
                <TrashCard
                  key={book.project.id}
                  book={book}
                  onRestore={() => void restoreBook(book.project.id)}
                  onDeleteForever={() => setPendingForever(book)}
                />
              ))}
            </div>
            <div className="library-actions trash-footer">
              <button className="btn btn-danger" onClick={() => setPendingEmpty(true)}>
                Empty Trash
              </button>
            </div>
          </>
        )}
      </div>

      {pendingForever && (
        <div className="overlay" role="alertdialog" aria-modal="true" onClick={() => setPendingForever(null)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <p>
              Delete <strong>{pendingForever.project.title}</strong> forever? This can't be undone.
            </p>
            <div className="slot-controls">
              <button className="btn" onClick={() => setPendingForever(null)} autoFocus>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  void permanentlyDeleteBook(pendingForever.project.id)
                  setPendingForever(null)
                }}
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingEmpty && (
        <div className="overlay" role="alertdialog" aria-modal="true" onClick={() => setPendingEmpty(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <p>
              Empty Trash? All {trashedBooks.length} book{trashedBooks.length === 1 ? '' : 's'} in it
              will be deleted forever.
            </p>
            <div className="slot-controls">
              <button className="btn" onClick={() => setPendingEmpty(false)} autoFocus>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  void emptyTrash()
                  setPendingEmpty(false)
                }}
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
