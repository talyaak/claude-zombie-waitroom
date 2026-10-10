// The mirror bridge: state machine effects, the child's lifetime, the control
// file, frames into the pane. Everything here reaches the engine through `Io`,
// which the hook builds from its own `$`.
import { type Action, MAX_EVENTS, type Control, type InputEvent, parseLine } from './protocol'
import { type Effect, type Ev, type Shown, initial, step } from './state'

export type Frame = { file: string; width: number; height: number }

export const PANE = 'waitroom'
export const VIEW = 'view'
export const INPUT = 'input'

export type Io = {
  root: string
  settings: () => Promise<{ url: string; cache: 'fresh' | 'persist' }>
  spawn: (argv: string[], env: Record<string, string>) => AsyncIterable<{ stream: string; text: string }>
  write: (path: string, text: string) => Promise<void>
  openPane: () => Promise<{ isPlaced: boolean }>
  closePane: () => Promise<void>
  blit: (frame: Frame) => Promise<unknown>
  toast: (text: string) => void
  now: () => Promise<number>
  after: (ms: number, fn: () => void) => { cancel: () => void }
}

const PENDING_MS = 2000
const COUNTDOWN_MS = 3000

type Timer = { cancel: () => void }

let shown: Shown = initial()
let pending: Timer | undefined
let countdown: Timer | undefined
let openedAt = 0
let running = false
let childDir: string | undefined
let nextId = 0
let writing: Promise<void> = Promise.resolve()
let control: Control = { paused: false, cols: 0, rows: 0, stop: false, events: [] }
let latest: Frame | undefined

export const phaseOf = () => shown.phase
export const roundStart = () => openedAt

// The newest frame as an Image source, or a 1x1 black picture until one arrives.
export function sourceFor(): { file: string; format: 'rgba'; width: number; height: number } | { rgba: string; width: number; height: number } {
  if (latest) return { file: latest.file, format: 'rgba', width: latest.width, height: latest.height }
  // Uint8Array.toBase64 is in the mod's environment; the DOM lib typing lacks it.
  return { rgba: (new Uint8Array(4) as unknown as { toBase64(): string }).toBase64(), width: 1, height: 1 }
}

// Queued so writes land in order; each write is the whole current control.
function writeControl(io: Io) {
  if (!childDir) return
  const path = `${childDir}/control.json`
  const text = JSON.stringify(control)
  writing = writing.then(() => io.write(path, text)).catch(() => {})
}

function setPaused(io: Io, paused: boolean) {
  if (control.paused === paused) return
  control = { ...control, paused }
  writeControl(io)
}

function stopChild(io: Io) {
  if (!running) return
  control = { ...control, stop: true }
  writeControl(io)
  running = false
  childDir = undefined
  control = { paused: false, cols: 0, rows: 0, stop: false, events: [] }
}

async function startChild(io: Io) {
  if (running) return
  running = true
  const { url, cache } = await io.settings()
  const stream = io.spawn(['node', `${io.root}/mirror/dist/index.js`], { WAITROOM_URL: url, WAITROOM_CACHE: cache })
  void consume(io, stream)
}

async function consume(io: Io, stream: AsyncIterable<{ stream: string; text: string }>) {
  let buf = ''
  try {
    for await (const chunk of stream) {
      if (chunk.stream !== 'stdout') continue
      buf += chunk.text
      let at: number
      while ((at = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, at)
        buf = buf.slice(at + 1)
        const msg = parseLine(line)
        if (!msg) continue
        if (msg.type === 'hello') {
          childDir = msg.dir
          writeControl(io)
        } else if (msg.type === 'frame') {
          latest = { file: msg.file, width: msg.width, height: msg.height }
          void io.blit(latest)
        } else if (msg.type === 'error') {
          io.toast(`waitroom: ${msg.message}`)
        }
      }
    }
  } finally {
    running = false
    childDir = undefined
  }
}

export function setView(io: Io, cols: number, rows: number) {
  if (cols === control.cols && rows === control.rows) return
  control = { ...control, cols, rows }
  writeControl(io)
}

export function addInput(io: Io, action: Action) {
  if (!running) return
  nextId++
  const ev = { id: nextId, ...action } as InputEvent
  control = { ...control, events: [...control.events, ev].slice(-MAX_EVENTS) }
  writeControl(io)
}

// One transition. Effects that need the engine are performed here through `io`.
export async function drive(io: Io, ev: Ev) {
  const result = step(shown, ev)
  shown = result.shown
  for (const effect of result.effects) await perform(io, effect)
}

async function perform(io: Io, effect: Effect) {
  if (effect === 'armPending') {
    pending?.cancel()
    pending = io.after(PENDING_MS, () => void drive(io, { kind: 'pendingElapsed' }))
  } else if (effect === 'cancelPending') {
    pending?.cancel()
    pending = undefined
  } else if (effect === 'open') {
    openedAt = await io.now()
    const opened = await io.openPane()
    if (!opened.isPlaced) io.toast('waitroom: widen the terminal to see the game')
    await startChild(io)
  } else if (effect === 'armCountdown') {
    countdown?.cancel()
    countdown = io.after(COUNTDOWN_MS, () => void drive(io, { kind: 'countdownElapsed' }))
  } else if (effect === 'handBack') {
    setPaused(io, true)
  } else if (effect === 'resume') {
    setPaused(io, false)
  } else if (effect === 'close') {
    await io.closePane()
    stopChild(io)
  } else if (effect === 'kill') {
    stopChild(io)
    pending?.cancel()
    countdown?.cancel()
  }
}

