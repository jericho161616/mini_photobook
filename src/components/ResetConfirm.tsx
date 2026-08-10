import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/useStore'

/** Typed exactly, case-sensitively, to arm the button. */
const CONFIRM_WORD = 'DELETE'

interface ResetConfirmProps {
  onClose: () => void
}

/**
 * Deleting every photo and the whole layout can't be undone — not even by
 * Ctrl+Z, since the photo files themselves are gone — so this asks the word to
 * be typed out rather than settling for a second click. A click can be a
 * reflex; typing DELETE can't.
 */
export function ResetConfirm({ onClose }: ResetConfirmProps) {
  const reset = useStore((s) => s.reset)
  const photos = useStore((s) => s.photos)
  const pages = useStore((s) => s.pages)
  const title = useStore((s) => s.title)

  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const armed = typed === CONFIRM_WORD

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function confirm() {
    if (!armed) return
    void reset()
    onClose()
  }

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-label="Confirm reset" onClick={onClose}>
      <div className="overlay-card reset-card" onClick={(e) => e.stopPropagation()}>
        <p className="reset-title">Reset “{title || 'Untitled Book'}”?</p>
        <p className="reset-body">
          This permanently deletes{' '}
          <b>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </b>{' '}
          and all{' '}
          <b>
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </b>{' '}
          in this book. It can't be undone.
        </p>

        <label className="reset-field">
          <span>
            Type <code>{CONFIRM_WORD}</code> to confirm
          </span>
          <input
            ref={inputRef}
            type="text"
            className="reset-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label={`Type ${CONFIRM_WORD} to confirm`}
          />
        </label>

        <div className="slot-controls">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={confirm}
            disabled={!armed}
            title={armed ? 'Delete everything in this book' : `Type ${CONFIRM_WORD} first`}
          >
            Delete everything
          </button>
        </div>
      </div>
    </div>
  )
}
