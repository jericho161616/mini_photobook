import { useEffect } from 'react'
import { useStore } from '../state/useStore'

interface ResetConfirmProps {
  onClose: () => void
}

/**
 * Deleting every photo and the whole layout can't be undone, so this always
 * sits behind a deliberate second step rather than firing straight off the
 * topbar button.
 */
export function ResetConfirm({ onClose }: ResetConfirmProps) {
  const reset = useStore((s) => s.reset)

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
      aria-label="Confirm reset"
      onClick={onClose}
    >
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <p>
          Start over? This deletes every photo and page in this book — it can't be undone.
        </p>
        <div className="slot-controls">
          <button className="btn" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              void reset()
              onClose()
            }}
          >
            Delete everything
          </button>
        </div>
      </div>
    </div>
  )
}
