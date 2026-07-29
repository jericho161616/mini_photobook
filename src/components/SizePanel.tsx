import { useState } from 'react'
import { formatDims, getSize, sizeRatio } from '../data/sizes'
import { useStore } from '../state/useStore'
import { SizePickerModal } from './SizePickerModal'

const GLYPH_MAX = 40

export function SizePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const [pickerOpen, setPickerOpen] = useState(false)

  const size = getSize(sizeId)
  const ratio = sizeRatio(size)
  const w = ratio >= 1 ? GLYPH_MAX : GLYPH_MAX * ratio
  const h = ratio >= 1 ? GLYPH_MAX / ratio : GLYPH_MAX

  return (
    <section className="panel">
      <h2>Book Size</h2>
      <div className="size-current">
        <span className="shape" style={{ width: w, height: h }} />
        <div className="size-current-text">
          <span className="name">{size.name}</span>
          <span className="dims mono">{formatDims(size)}</span>
        </div>
        <button className="btn" onClick={() => setPickerOpen(true)}>
          Change
        </button>
      </div>

      {pickerOpen && <SizePickerModal onClose={() => setPickerOpen(false)} />}
    </section>
  )
}
