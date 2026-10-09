// Maps waitroom input events onto CDP Input.* calls. Key events carry no
// release, so a move is a press held for a fixed time.
import type { CDPSession } from 'puppeteer-core'

import type { InputEvent } from './protocol.js'

const HOLD_MS = 180
const LOOK_STEP_PX = 40

const KEYS: Record<'w' | 'a' | 's' | 'd', { code: string; vk: number }> = {
  w: { code: 'KeyW', vk: 87 },
  a: { code: 'KeyA', vk: 65 },
  s: { code: 'KeyS', vk: 83 },
  d: { code: 'KeyD', vk: 68 },
}

export async function applyInput(cdp: CDPSession, ev: InputEvent, width: number, height: number) {
  if (ev.kind === 'move') {
    const k = KEYS[ev.dir]
    const base = { key: ev.dir, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk }
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
    setTimeout(() => {
      void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }).catch(() => {})
    }, HOLD_MS)
    return
  }
  if (ev.kind === 'fire') {
    const x = Math.round(width / 2)
    const y = Math.round(height / 2)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    return
  }
  // look: synthetic mouse movement; the page must read it (pointer-lock deltas or clientX).
  const dx = ev.dir === 'left' ? -LOOK_STEP_PX : LOOK_STEP_PX
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(width / 2) + dx, y: Math.round(height / 2) })
}
