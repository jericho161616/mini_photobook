import { useEffect } from 'react'

interface DeleteBookConfirmProps {
  title: string
  onConfirm: () => void
  onClose: () => void
}

export function DeleteBookConfirm({ title, onConfirm, onClose }: DeleteBookConfirmProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="overlay"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm delete"
      onClick={onClose}
    >
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <p>
          Delete <strong>{title}</strong>? Every photo and page in it goes with it — this can't be
          undone.
        </p>
        <div className="slot-controls">
          <button className="btn" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Delete book
          </button>
        </div>
      </div>
    </div>
  )
}
