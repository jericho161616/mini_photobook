/**
 * A fingerprint of what a picture *looks like*, so a re-export, a screenshot
 * or a messaging-app copy of a photo you already have can be recognised.
 *
 * The byte hash in imageUtils only catches files that are identical down to
 * the last byte — re-save the same photo at a different quality and it sails
 * straight through. This works on the pixels instead.
 *
 * dHash: shrink to 9x8 greyscale, then record whether each pixel is brighter
 * than the one to its right. That gives 64 bits describing the image's
 * gradients, which survives resizing, recompression and small colour shifts,
 * while genuinely different pictures land far apart.
 */

const W = 9
const H = 8

/** How many of the 64 bits may differ before two pictures count as different. */
export const PERCEPTUAL_MATCH_DISTANCE = 6

/** 64-bit dHash of an image blob, as 16 hex characters. */
export async function perceptualHash(blob: Blob): Promise<string | undefined> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    // A file the browser can't decode simply has no fingerprint; the caller
    // falls back to the byte hash rather than failing the whole import.
    return undefined
  }
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return undefined
  ctx.drawImage(bitmap, 0, 0, W, H)
  bitmap.close()

  const { data } = ctx.getImageData(0, 0, W, H)
  const grey: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma — closer to perceived brightness than a flat average.
    grey.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }

  let bits = ''
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      bits += grey[y * W + x] > grey[y * W + x + 1] ? '1' : '0'
    }
  }
  // 64 bits -> 16 hex characters, in nibbles.
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

/** How many bits differ between two fingerprints. Lower means more alike. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER
  let distance = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      distance += x & 1
      x >>= 1
    }
  }
  return distance
}

/** True when two fingerprints are close enough to be the same picture. */
export function looksLikeSame(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return hammingDistance(a, b) <= PERCEPTUAL_MATCH_DISTANCE
}
