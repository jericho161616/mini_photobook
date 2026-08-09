import { useState } from 'react'
import { formatDims, getSize, sizeRatio } from '../data/sizes'
import { useStore } from '../state/useStore'
import { SizePickerModal } from './SizePickerModal'

const GLYPH_MAX = 22

/**
 * The book's trim, as a single slim row rather than its own titled card — it's
 * a one-time decision that was taking permanent space at the top of the
 * sidebar, and the full grid already lives behind the Change button.
 */
export function SizePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const [pickerOpen, setPickerOpen] = useState(false)

  const size = getSize(sizeId)
  const ratio = sizeRatio(size)
  const w = ratio >= 1 ? GLYPH_MAX : GLYPH_MAX * ratio
  const h = ratio >= 1 ? GLYPH_MAX / ratio : GLYPH_MAX

  return (
    <section className="panel size-panel-compact">
      <span className="shape" style={{ width: w, height: h }} aria-hidden="true" />
      <span className="size-compact-name">{size.name}</span>
      <span className="size-compact-dims mono">{formatDims(size)}</span>
      <button className="btn" onClick={() => setPickerOpen(true)} title="Change the book's size">
        Change
      </button>

      {pickerOpen && <SizePickerModal onClose={() => setPickerOpen(false)} />}
    </section>
  )
}
