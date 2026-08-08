/** How the tape/clip/paperclip pins a photo to the page — see Placement.attachment. */
export type Attachment = 'tape' | 'clip' | 'paperclip'

interface AttachmentGraphicProps {
  type: Attachment
  /** Tape's own color — ignored for clip/paperclip, which are always the same neutral material. */
  color?: string
}

export const DEFAULT_TAPE_COLOR = 'rgba(232, 217, 160, 0.85)'

/**
 * A small graphic pinning a photo to the page — independent of, and
 * combinable with, any frame the photo also has. Positioned by the parent
 * (SlotView), which knows the slot's own size.
 */
export function AttachmentGraphic({ type, color }: AttachmentGraphicProps) {
  if (type === 'tape') {
    return (
      <span
        className="attachment-tape"
        style={{ background: color ?? DEFAULT_TAPE_COLOR }}
        aria-hidden="true"
      />
    )
  }
  if (type === 'clip') {
    return (
      <svg className="attachment-clip" viewBox="0 0 26 34" aria-hidden="true">
        <rect x="2" y="6" width="22" height="14" rx="2" fill="#1c1a17" />
        <circle cx="8" cy="13" r="2.4" fill="none" stroke="#c9a24a" strokeWidth="1.6" />
        <circle cx="18" cy="13" r="2.4" fill="none" stroke="#c9a24a" strokeWidth="1.6" />
      </svg>
    )
  }
  return (
    <svg className="attachment-paperclip" viewBox="0 0 20 44" aria-hidden="true">
      <path
        d="M10 4 v28 a6 6 0 0 1 -12 0 v-22 a4 4 0 0 1 8 0 v20"
        fill="none"
        stroke="#8a97a3"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
