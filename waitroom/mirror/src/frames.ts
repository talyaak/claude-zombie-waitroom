// Decodes a JPEG frame to raw RGBA at the mirror's full resolution, using a
// helper page's canvas, so the mirror needs no image dependency. The pixels
// go to a file; the terminal draws them with an Image element.
import type { Page } from 'puppeteer-core'

export type Decoder = (jpegBase64: string, width: number, height: number) => Promise<string>

export async function makeDecoder(helper: Page): Promise<Decoder> {
  await helper.goto('about:blank')
  return (jpegBase64, width, height) =>
    helper.evaluate(
      async (b64: string, width: number, height: number) => {
        const img = new Image()
        img.src = 'data:image/jpeg;base64,' + b64
        await img.decode()

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('no 2d context')
        ctx.drawImage(img, 0, 0, width, height)
        const px = ctx.getImageData(0, 0, width, height).data

        let bin = ''
        for (let i = 0; i < px.length; i += 0x8000) {
          bin += String.fromCharCode(...px.subarray(i, i + 0x8000))
        }
        return btoa(bin)
      },
      jpegBase64,
      width,
      height,
    )
}
