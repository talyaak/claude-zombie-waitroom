// The waitroom mirror child. Launched by the mod with `node dist/index.js`.
// Frames out as JSON lines on stdout; control and lifecycle in control.json.
// Exits on a `stop` control event, on a missing parent, or on a fatal error.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer, { type Browser, type CDPSession, type Page } from 'puppeteer-core'

import { findBrowser } from './browser.js'
import { makeDecoder, type Decoder } from './frames.js'
import { applyInput } from './input.js'
import { type Control, emit } from './protocol.js'

const VIEW = { width: 640, height: 360 }
const POLL_MS = 50
const STATUS_MS = 5000

const url = process.env.WAITROOM_URL ?? ''
// `persist` keeps one profile across starts; `fresh` (default) removes it on exit.
const persist = process.env.WAITROOM_CACHE === 'persist'
const parentPid = process.ppid

let browser: Browser | undefined
let dir = ''
let cdp: CDPSession | undefined
let decode: Decoder | undefined
let control: Control = { paused: true, cols: 0, rows: 0, stop: false, events: [] }
let lastEventId = 0
let screencasting = false
let shuttingDown = false
let framesSent = 0
let lastStatusAt = Date.now()

const fail = async (message: string, code: number) => {
  emit({ type: 'error', message })
  await shutdown(code)
}

async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (cdp) await cdp.send('Page.stopScreencast').catch(() => {})
  if (browser) {
    const closing = browser.close().catch(() => {})
    await Promise.race([closing, new Promise(r => setTimeout(r, 1500))])
    browser.process()?.kill('SIGKILL')
  }
  if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  process.exit(code)
}

async function setPaused(page: Page, paused: boolean) {
  if (!cdp) return
  if (paused && screencasting) {
    await cdp.send('Page.stopScreencast')
    screencasting = false
  } else if (!paused && !screencasting) {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: VIEW.width, maxHeight: VIEW.height, everyNthFrame: 1 })
    screencasting = true
  }
  void page
}

async function readControl(): Promise<Control | undefined> {
  try {
    return JSON.parse(await readFile(join(dir, 'control.json'), 'utf8')) as Control
  } catch {
    return undefined
  }
}

async function main() {
  if (!/^https:\/\//.test(url) && !/^http:\/\/127\.0\.0\.1[:/]/.test(url)) {
    return fail('WAITROOM_URL must be an https:// address', 2)
  }
  const exe = findBrowser()
  if (!exe) return fail('no Chromium, Chrome or Edge found; set WAITROOM_BROWSER to its path', 3)

  dir = await mkdtemp(join(tmpdir(), 'waitroom-'))
  const profile = persist ? join(tmpdir(), 'waitroom-profile') : join(dir, 'profile')
  emit({ type: 'hello', dir, pid: process.pid })

  browser = await puppeteer.launch({
    executablePath: exe,
    headless: true,
    userDataDir: profile,
    defaultViewport: VIEW,
    args: [
      '--mute-audio',
      `--window-size=${VIEW.width},${VIEW.height}`,
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      // Chromium's sandbox cannot start as root (containers); a desktop user keeps it.
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    ],
  })

  const page = await browser.newPage()
  const helper = await browser.newPage()
  decode = await makeDecoder(helper)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  // A background tab gets no screencast frames; the helper tab opened after it would take focus.
  await page.bringToFront()
  cdp = await page.createCDPSession()

  let busy = false
  cdp.on('Page.screencastFrame', frame => {
    void cdp?.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
    if (busy || control.cols === 0 || control.paused || !decode) return // drop, never queue
    busy = true
    const { cols, rows } = control
    decode(frame.data, cols, rows)
      .then((cells: string) => {
        framesSent++
        emit({ type: 'frame', cols, rows, cells })
      })
      .catch((err: unknown) => emit({ type: 'status', text: `decode failed: ${String(err).slice(0, 120)}` }))
      .finally(() => {
        busy = false
      })
  })
  await setPaused(page, control.paused)

  const timer = setInterval(async () => {
    if (Date.now() - lastStatusAt >= STATUS_MS) {
      emit({ type: 'status', text: `fps ${(framesSent / ((Date.now() - lastStatusAt) / 1000)).toFixed(1)}` })
      framesSent = 0
      lastStatusAt = Date.now()
    }
    if (process.ppid !== parentPid) return shutdown(0)
    const next = await readControl()
    if (!next) return
    if (next.stop) return shutdown(0)
    if (next.paused !== control.paused) {
      control = next
      await setPaused(page, next.paused)
    }
    control = next
    for (const ev of next.events) {
      if (ev.id <= lastEventId) continue
      lastEventId = ev.id
      await applyInput(cdp!, ev, VIEW.width, VIEW.height)
    }
  }, POLL_MS)
  timer.unref?.()

  process.on('SIGTERM', () => void shutdown(0))
  process.on('SIGINT', () => void shutdown(0))
}

main().catch(err => fail(`mirror crashed: ${String(err).slice(0, 200)}`, 1))
