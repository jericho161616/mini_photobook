import { Fragment } from 'react'
import { SIZE_GROUPS, formatDims, sizeRatio } from '../data/sizes'
import { useStore } from '../state/useStore'

const GLYPH_MAX = 34

export function SizePanel() {
  const sizeId = useStore((s) => s.sizeId)
  const setSize = useStore((s) => s.setSize)

  return (
    <section className="panel">
      <h2>Book Size</h2>
      <div className="size-grid">
        {SIZE_GROUPS.map((group) => (
          <Fragment key={group.label}>
            <div className="family-label">{group.label}</div>
            {group.sizes.map((size) => {
              const ratio = sizeRatio(size)
              const w = ratio >= 1 ? GLYPH_MAX : GLYPH_MAX * ratio
              const h = ratio >= 1 ? GLYPH_MAX / ratio : GLYPH_MAX
              return (
                <button
                  key={size.id}
                  className={`size-swatch${size.id === sizeId ? ' active' : ''}`}
                  onClick={() => setSize(size.id)}
                  aria-pressed={size.id === sizeId}
                >
                  <span className="shape" style={{ width: w, height: h }} />
                  <span className="name">{size.name}</span>
                  <span className="dims mono">{formatDims(size)}</span>
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
