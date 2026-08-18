import { useEffect, useState } from 'react'
import type { DuplicateReason } from '../lib/imageUtils'
import { photoThumbUrl } from '../lib/imageUtils'
import { useStore } from '../state/useStore'

/**
 * What each kind of match means, in the terms the person doing the importing
 * thinks in — not "SHA-256 collision".
 */
const REASON: Record<DuplicateReason, { label: string; detail: string }> = {
  identical: {
    label: 'Same file',
    detail: 'Byte for byte the same as one already here — adding it gives you two of the same.',
  },
  looksSame: {
    label: 'Same picture',
    detail: 'A different file, but the same shot — a re-export, a screenshot, or a copy from a chat app.',
  },
  sameName: {
    label: 'Same name',
    detail: 'A different picture that happens to share a filename. Usually fine to add.',
  },
}

/**
 * Asks before dropping anything.
 *
 * The old behaviour skipped duplicates and mentioned it in a toast, which was
 * easy to miss and impossible to argue with. Now every match is shown next to
 * what it matched, and each one can be kept or dropped — defaulting to keeping
 * only the ones we're least sure about (a shared filename says very little).
 */
export function DuplicateImportModal() {
  const pending = useStore((s) => s.pendingDuplicates)
  const resolveDuplicates = useStore((s) => s.resolveDuplicates)
  const photos = useStore((s) => s.photos)

  const [keep, setKeep] = useState<Set<string>>(new Set())

  // A shared filename is weak evidence — two cameras both produce IMG_0042 —
  // so those start ticked, while an identical file or the same picture doesn't.
  useEffect(() => {
    setKeep(new Set(pending.filter((d) => d.reason === 'sameName').map((d) => d.photo.id)))
  }, [pending])

  useEffect(() => {
    if (pending.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') void resolveDuplicates([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending.length, resolveDuplicates])

  if (pending.length === 0) return null

  const toggle = (id: string) =>
    setKeep((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const count = pending.length

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-label="Photos that look familiar">
      <div className="overlay-card dupe-card">
        <p className="dupe-title">
          {count === 1 ? '1 photo looks familiar' : `${count} photos look familiar`}
        </p>
        <p className="dupe-body">
          Tick the ones you want to add anyway. Anything left unticked isn't imported — nothing has
          been added yet either way.
        </p>

        <ul className="dupe-list">
          {pending.map((d) => {
            const existing = photos.find((p) => p.id === d.existingId)
            const reason = REASON[d.reason]
            return (
              <li key={d.photo.id}>
                <label className="dupe-row">
                  <input
                    type="checkbox"
                    checked={keep.has(d.photo.id)}
                    onChange={() => toggle(d.photo.id)}
                    aria-label={`Add ${d.photo.name} anyway`}
                  />
                  <span className="dupe-pair">
                    <img src={photoThumbUrl(d.photo)} alt="" className="dupe-thumb" />
                    <span className="dupe-arrow" aria-hidden="true">
                      ≈
                    </span>
                    {existing ? (
                      <img src={photoThumbUrl(existing)} alt="" className="dupe-thumb existing" />
                    ) : (
                      <span className="dupe-thumb placeholder" aria-hidden="true" />
                    )}
                  </span>
                  <span className="dupe-text">
                    <span className="dupe-name">{d.photo.name}</span>
                    <span className={`dupe-reason ${d.reason}`}>{reason.label}</span>
                    <span className="dupe-detail">{reason.detail}</span>
                    <span className="dupe-match">Matches “{d.matchedName}”</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <div className="slot-controls dupe-actions">
          <button className="btn" onClick={() => setKeep(new Set())}>
            Tick none
          </button>
          <button className="btn" onClick={() => setKeep(new Set(pending.map((d) => d.photo.id)))}>
            Tick all
          </button>
          <span className="dupe-spacer" />
          <button className="btn-primary" onClick={() => void resolveDuplicates([...keep])}>
            {keep.size === 0
              ? 'Skip all'
              : `Add ${keep.size} ${keep.size === 1 ? 'photo' : 'photos'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
