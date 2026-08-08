import { useRef } from 'react'
import { FONT_OPTIONS, FONT_SIZE_OPTIONS, fontSizeScale, fontStack } from '../data/fonts'
import { getTemplate } from '../data/templates'
import { decorationHost } from '../lib/autoLayout'
import { useStore } from '../state/useStore'
import { DoodlePad } from './DoodlePad'
import { StickerGlyph } from './StickerGlyph'
import type { StickerType, TextBox, TextStyle } from '../types'

/** Longest edge kept for an uploaded sticker image — plenty for a decoration, and keeps the book's own storage small. */
const UPLOADED_STICKER_MAX_EDGE = 640

/** Downscales (if needed) and re-encodes as PNG, so an uploaded photo-sized image doesn't bloat the book. */
async function readStickerFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, UPLOADED_STICKER_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

const STICKERS: { type: StickerType; label: string }[] = [
  { type: 'tape-yellow', label: 'Tape' },
  { type: 'tape-pink', label: 'Tape' },
  { type: 'tape-sage', label: 'Tape' },
  { type: 'heart', label: 'Heart' },
  { type: 'star', label: 'Star' },
  { type: 'arrow', label: 'Arrow' },
]

const ALIGNS: { id: TextBox['align']; label: string }[] = [
  { id: 'left', label: '⟸' },
  { id: 'center', label: '☰' },
  { id: 'right', label: '⟹' },
]

/**
 * Stickers and free-form text boxes, placed anywhere on the page rather than
 * tied to a template's fixed slots — a wall poster, a doodle, a caption laid
 * right across a photo.
 */
export function DecoratePanel() {
  const pages = useStore((s) => s.pages)
  const activePageIndex = useStore((s) => s.activePageIndex)
  const activeHalfIndex = useStore((s) => s.activeHalfIndex)
  const selectedDecoration = useStore((s) => s.selectedDecoration)
  const addSticker = useStore((s) => s.addSticker)
  const addTextBox = useStore((s) => s.addTextBox)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const removeDecoration = useStore((s) => s.removeDecoration)
  const addCustomSticker = useStore((s) => s.addCustomSticker)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const page = pages[activePageIndex]
  if (!page) return null

  const isSplit = Boolean(getTemplate(page.templateId).halfSplit && page.halves)
  const targetHalf = isSplit ? activeHalfIndex : undefined
  const host = decorationHost(page, targetHalf)

  const selectedTextBox =
    selectedDecoration &&
    selectedDecoration.pageIndex === activePageIndex &&
    selectedDecoration.halfIndex === targetHalf &&
    selectedDecoration.kind === 'textBox'
      ? host.textBoxes?.find((t) => t.id === selectedDecoration.id)
      : undefined

  const selectedAny =
    selectedDecoration &&
    selectedDecoration.pageIndex === activePageIndex &&
    selectedDecoration.halfIndex === targetHalf

  const setStyle = (patch: Partial<TextBox>) => {
    if (!selectedTextBox || !selectedDecoration) return
    updateTextBox(selectedDecoration, patch)
  }

  return (
    <section className="panel">
      <h2>Decorate</h2>
      <p className="hint">
        {isSplit
          ? 'Placed on whichever half is selected in the Layout panel above.'
          : 'Drag onto the page, resize from the corner, drag the × to remove.'}
      </p>

      <div className="sticker-tray">
        {STICKERS.map((s) => (
          <button
            key={s.type}
            className="sticker-tray-btn"
            onClick={() => addSticker(activePageIndex, targetHalf, s.type)}
            disabled={page.locked}
            title={`Add ${s.label.toLowerCase()}`}
          >
            <span className={`sticker-glyph-preview sticker-${s.type}`}>
              <StickerGlyph type={s.type} />
            </span>
          </button>
        ))}
      </div>

      <DoodlePad pageIndex={activePageIndex} targetHalf={targetHalf} locked={page.locked} />

      <button
        className="btn add-text-btn"
        onClick={() => uploadInputRef.current?.click()}
        disabled={page.locked}
        title="Add a PNG (or other image) from your own files as a placeable sticker"
      >
        ↑ Upload Image
      </button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const dataUrl = await readStickerFile(file)
          addCustomSticker(dataUrl)
        }}
      />

      <button
        className="btn add-text-btn"
        onClick={() => addTextBox(activePageIndex, targetHalf)}
        disabled={page.locked}
      >
        + Add Text
      </button>

      {selectedTextBox && (
        <div className="decoration-editor">
          <p className="hint">Selected text box</p>
          <div className="text-style-row">
            <select
              className="font-picker"
              value={selectedTextBox.font}
              onChange={(e) => setStyle({ font: e.target.value as TextStyle['font'] })}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              className={`bold-btn${selectedTextBox.bold ? ' active' : ''}`}
              onClick={() => setStyle({ bold: !selectedTextBox.bold })}
              aria-pressed={selectedTextBox.bold}
            >
              B
            </button>
            <button
              className={`bold-btn italic-btn${selectedTextBox.italic ? ' active' : ''}`}
              onClick={() => setStyle({ italic: !selectedTextBox.italic })}
              aria-pressed={selectedTextBox.italic ?? false}
              title="Italic"
            >
              I
            </button>
          </div>
          <div className="filter-chips-row size-picker-row">
            {FONT_SIZE_OPTIONS.map((s) => (
              <button
                key={s.id}
                className={`filter-chip-btn${(selectedTextBox.size ?? 'md') === s.id ? ' active' : ''}`}
                onClick={() => setStyle({ size: s.id })}
                aria-pressed={(selectedTextBox.size ?? 'md') === s.id}
                title={`${s.label === 'S' ? 'Small' : s.label === 'M' ? 'Medium' : s.label === 'L' ? 'Large' : 'Extra large'} text`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="align-row">
            {ALIGNS.map((a) => (
              <button
                key={a.id}
                className={`align-btn${selectedTextBox.align === a.id ? ' active' : ''}`}
                onClick={() => selectedDecoration && updateTextBox(selectedDecoration, { align: a.id })}
                aria-pressed={selectedTextBox.align === a.id}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p
            className="text-style-preview"
            style={{
              fontFamily: fontStack(selectedTextBox.font),
              fontWeight: selectedTextBox.bold ? 700 : 400,
              fontStyle: selectedTextBox.italic ? 'italic' : 'normal',
              fontSize: 13 * fontSizeScale(selectedTextBox.size),
            }}
          >
            {selectedTextBox.text}
          </p>
        </div>
      )}

      {selectedAny && (
        <button
          className="btn btn-danger decoration-remove-btn"
          onClick={() => selectedDecoration && removeDecoration(selectedDecoration)}
        >
          Remove {selectedDecoration?.kind === 'sticker' ? 'sticker' : 'text box'}
        </button>
      )}
    </section>
  )
}
