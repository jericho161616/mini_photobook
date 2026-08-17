import { useRef, useState } from 'react'
import {
  canScanLocalFonts,
  FONT_FILE_TYPES,
  fontFromFile,
  fontFromLocalFamily,
  scanLocalFonts,
} from '../lib/fonts'
import { useStore } from '../state/useStore'
import { Icon } from './Icon'

/**
 * Adding fonts to a book, by two routes.
 *
 * Dropping in a file is the one that always works and travels with the book,
 * so it leads. Scanning the machine's installed fonts is quicker when the
 * face you want is already there — but queryLocalFonts is Chromium-only, so
 * that button simply isn't rendered elsewhere rather than being shown broken.
 */
export function FontManager() {
  const customFonts = useStore((s) => s.customFonts)
  const addCustomFont = useStore((s) => s.addCustomFont)
  const removeCustomFont = useStore((s) => s.removeCustomFont)

  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [families, setFamilies] = useState<string[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [search, setSearch] = useState('')

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    for (const file of Array.from(files)) {
      try {
        addCustomFont(await fontFromFile(file))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That file could not be read.')
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onScan() {
    setError(null)
    setScanning(true)
    try {
      setFamilies(await scanLocalFonts())
    } catch {
      // Declining the permission prompt lands here, and so does a browser
      // that changes its mind about supporting this.
      setError('Your browser did not share its font list. You can still add a font file below.')
    } finally {
      setScanning(false)
    }
  }

  const added = new Set(customFonts.filter((f) => f.local).map((f) => f.name))
  const shown = families?.filter((f) => f.toLowerCase().includes(search.toLowerCase())) ?? []

  return (
    <div className="font-manager">
      {customFonts.length > 0 && (
        <ul className="font-list">
          {customFonts.map((font) => (
            <li key={font.id}>
              <span className="font-sample" style={{ fontFamily: `"${font.family}", Georgia, serif` }}>
                {font.name}
              </span>
              <button
                className="font-remove"
                onClick={() => removeCustomFont(font.id)}
                aria-label={`Remove ${font.name}`}
                title="Remove from this book"
              >
                <Icon name="close" size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn font-add-btn" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={13} /> Add a font file
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={FONT_FILE_TYPES.join(',')}
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />

      {canScanLocalFonts() && (
        <button className="btn font-add-btn" onClick={() => void onScan()} disabled={scanning}>
          <Icon name="grid" size={13} /> {scanning ? 'Scanning…' : 'Scan my fonts'}
        </button>
      )}

      {error && <p className="font-error">{error}</p>}

      {families && (
        <div className="font-scan">
          <input
            className="font-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${families.length} fonts`}
            aria-label="Search your installed fonts"
          />
          <ul className="font-scan-list">
            {shown.slice(0, 60).map((family) => (
              <li key={family}>
                <button
                  style={{ fontFamily: `"${family}", Georgia, serif` }}
                  onClick={() => addCustomFont(fontFromLocalFamily(family))}
                  disabled={added.has(family)}
                  title={added.has(family) ? 'Already added' : `Add ${family}`}
                >
                  {family}
                </button>
              </li>
            ))}
          </ul>
          {shown.length > 60 && <p className="hint">Showing 60 of {shown.length} — search to narrow it down.</p>}
          <p className="hint">
            A scanned font is stored by name only, so it needs to be installed on whichever machine
            opens this book. Add the file instead if you want it to travel.
          </p>
        </div>
      )}

      {customFonts.length === 0 && !families && (
        <p className="hint">
          Added fonts appear in every font menu in this book — page notes and text boxes alike, and
          in the exported PDF.
        </p>
      )}
    </div>
  )
}
