// Decodes a JPEG frame and downscales it to half-block cells, using a helper
// page's canvas, so the mirror needs no image dependency. Each cell is U+2580
// (upper half block): foreground = the top pixel, background = the bottom.
import type { Page } from 'puppeteer-core'

export type Decoder = (jpegBase64: string, cols: number, rows: number) => Promise<string>

export async function makeDecoder(helper: Page): Promise<Decoder> {
  await helper.goto('about:blank')
  return (jpegBase64, cols, rows) =>
    helper.evaluate(
      async (b64: string, cols: number, rows: number) => {
        const img = new Image()
        img.src = 'data:image/jpeg;base64,' + b64
        await img.decode()

        const canvas = document.createElement('canvas')
        canvas.width = cols
        canvas.height = rows * 2
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('no 2d context')
        ctx.drawImage(img, 0, 0, cols, rows * 2)
        const px = ctx.getImageData(0, 0, cols, rows * 2).data

        const words = new Uint32Array(cols * rows * 3)
        const rgb = (i: number) => (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]
        let w = 0
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const top = (y * 2 * cols + x) * 4
            const bottom = ((y * 2 + 1) * cols + x) * 4
            words[w++] = 0x2580
            words[w++] = rgb(top)
            words[w++] = rgb(bottom)
          }
        }
        const bytes = new Uint8Array(words.buffer)
        let bin = ''
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        }
        return btoa(bin)
      },
      jpegBase64,
      cols,
      rows,
    )
}
