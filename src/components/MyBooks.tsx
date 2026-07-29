import { useEffect, useRef, useState } from 'react'
import { formatDims, getSize } from '../data/sizes'
import { photoThumbUrl } from '../lib/imageUtils'
import { useLibraryStore, type BookSummary } from '../state/useLibraryStore'
import { DeleteBookConfirm } from './DeleteBookConfirm'
import { NewBookModal } from './NewBookModal'

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day} days ago`
  const week = Math.round(day / 7)
  if (week < 5) return `${week}w ago`
  const month = Math.round(day / 30)
  if (month < 12) return `${month}mo ago`
  return `${Math.round(day / 365)}y ago`
}

function pageCountOf(book: BookSummary): number {
  return book.project.pages.length
}

interface BookCardProps {
  book: BookSummary
  onOpen: () => void
  onRename: (title: string) => void
  onDuplicate: () => void
  onDelete: () => void
}

function BookCard({ book, onOpen, onRename, onDuplicate, onDelete }: BookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(book.project.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  const size = getSize(book.project.sizeId)

  function commitRename() {
    setRenaming(false)
    const trimmed = draftTitle.trim()
    if (trimmed && trimmed !== book.project.title) onRename(trimmed)
    else setDraftTitle(book.project.title)
  }

  return (
    <div className="book-card">
      <button className="cover" onClick={onOpen} aria-label={`Open ${book.project.title}`}>
        {book.coverPhoto ? (
          <img
            className="cover-photo"
            src={photoThumbUrl(book.coverPhoto)}
            alt=""
            draggable={false}
          />
        ) : (
          <span className="placeholder-icon" aria-hidden="true">
            ＋
          </span>
        )}
      </button>

      <div className="book-meta">
        <div className="book-title-row">
          {renaming ? (
            <input
              ref={inputRef}
              className="book-title-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraftTitle(book.project.title)
                  setRenaming(false)
                }
              }}
            />
          ) : (
            <button className="book-title" onClick={onOpen} title={book.project.title}>
              {book.project.title}
            </button>
          )}

          <div className="card-actions">
            <button
              className="kebab"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="menu open" onMouseLeave={() => setMenuOpen(false)}>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setRenaming(true)
                  }}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onDuplicate()
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <span className="book-sub mono">
          {size.name} · {formatDims(size)} · {pageCountOf(book)}p
        </span>
        <span className="book-edited">Edited {relativeTime(book.project.updatedAt)}</span>
      </div>
    </div>
  )
}

interface MyBooksProps {
  onOpenBook: (projectId: string) => void
}

export function MyBooks({ onOpenBook }: MyBooksProps) {
  const ready = useLibraryStore((s) => s.ready)
  const books = useLibraryStore((s) => s.books)
  const refresh = useLibraryStore((s) => s.refresh)
  const createBook = useLibraryStore((s) => s.createBook)
  const renameBook = useLibraryStore((s) => s.renameBook)
  const duplicateBook = useLibraryStore((s) => s.duplicateBook)
  const deleteBook = useLibraryStore((s) => s.deleteBook)

  const [newBookOpen, setNewBookOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BookSummary | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleCreate(title: string, sizeId: string) {
    const id = await createBook(title, sizeId)
    setNewBookOpen(false)
    onOpenBook(id)
  }

  if (!ready) {
    return (
      <div className="app">
        <p className="empty-note">Opening your library…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Moments <span>·</span> Editor
        </div>
      </header>

      <div className="library-head">
        <div>
          <h1>My Books</h1>
          <p>Every book you've started, saved automatically. Pick one up where you left off, or start another.</p>
        </div>
        <button className="new-book-btn" onClick={() => setNewBookOpen(true)}>
          + New Book
        </button>
      </div>

      {books.length === 0 && <p className="empty-note">No books yet — create your first one below.</p>}

      <div className="shelf">
        {books.map((book) => (
          <BookCard
            key={book.project.id}
            book={book}
            onOpen={() => onOpenBook(book.project.id)}
            onRename={(title) => void renameBook(book.project.id, title)}
            onDuplicate={() => void duplicateBook(book.project.id)}
            onDelete={() => setPendingDelete(book)}
          />
        ))}
        <button className="book-card new-tile new-book-card" onClick={() => setNewBookOpen(true)}>
          <span className="plus">+</span>
          <span>New Book</span>
        </button>
      </div>

      {newBookOpen && (
        <NewBookModal onCreate={handleCreate} onClose={() => setNewBookOpen(false)} />
      )}

      {pendingDelete && (
        <DeleteBookConfirm
          title={pendingDelete.project.title}
          onConfirm={() => void deleteBook(pendingDelete.project.id)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
