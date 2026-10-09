import { expect, test } from 'claude-code/testing'

import { type Io, drive } from '../hooks/mirror'

const flush = () => new Promise<void>(r => setTimeout(r, 0))

// A fake engine: records timers, spawns, writes, pane and blit calls.
function fakeIo(lines: string[]) {
  const timers: Array<{ ms: number; fn: () => void; cancelled: boolean }> = []
  const writes: Array<{ path: string; text: string }> = []
  const calls: string[] = []
  const blits: string[] = []
  const spawns: Array<{ argv: string[]; env: Record<string, string> }> = []
  const io: Io = {
    root: '/plugin/root',
    settings: async () => ({ url: 'https://example.com/game', cache: 'fresh' }),
    spawn: (argv, env) => {
      spawns.push({ argv: [...argv], env })
      // A live child keeps stdout open: the stream stays pending until the test ends.
      return (async function* () {
        for (const line of lines) yield { stream: 'stdout', text: line + '\n' }
        await new Promise<void>(() => {})
      })()
    },
    write: async (path, text) => {
      writes.push({ path, text })
    },
    openPane: async () => {
      calls.push('open')
      return { isPlaced: true }
    },
    closePane: async () => {
      calls.push('close')
    },
    blit: async cells => {
      blits.push(cells)
      return {}
    },
    toast: text => calls.push(`toast:${text}`),
    now: async () => 1000,
    after: (ms, fn) => {
      const t = { ms, fn, cancelled: false }
      timers.push(t)
      return { cancel: () => (t.cancelled = true) }
    },
  }
  const fire = (ms: number) => {
    const t = timers.filter(x => x.ms === ms && !x.cancelled).at(-1)
    if (!t) throw new Error(`no live timer ${ms}`)
    t.cancelled = true
    t.fn()
  }
  return { io, timers, writes, calls, blits, spawns, fire }
}

test('bridge: a turn opens the pane, runs the child, hands back, closes and stops it', async () => {
  const hello = JSON.stringify({ type: 'hello', dir: '/tmp/waitroom-test', pid: 1 })
  const frame = JSON.stringify({ type: 'frame', cols: 80, rows: 20, cells: 'AAAA' })
  const f = fakeIo([hello, frame])

  await drive(f.io, { kind: 'turnStart' })
  expect(f.timers.some(t => t.ms === 2000)).toBe(true)

  f.fire(2000) // pending elapses: fire is synchronous; the open effect runs async
  await flush()
  await flush()
  expect(f.calls).toContain('open')
  expect(f.spawns.length).toBe(1)
  expect(f.spawns[0].argv[1]).toBe('/plugin/root/mirror/dist/index.js')
  expect(f.spawns[0].env.WAITROOM_URL).toBe('https://example.com/game')

  await flush()
  expect(f.blits).toEqual(['AAAA'])
  const hello0 = f.writes.at(-1)
  expect(hello0?.path).toBe('/tmp/waitroom-test/control.json')

  await drive(f.io, { kind: 'needsPerson' })
  await flush()
  expect(JSON.parse(f.writes.at(-1)!.text).paused).toBe(true)

  await drive(f.io, { kind: 'resumed' })
  await flush()
  expect(JSON.parse(f.writes.at(-1)!.text).paused).toBe(false)

  await drive(f.io, { kind: 'turnComplete', aborted: false, subagent: false, now: 5000 })
  expect(f.timers.some(t => t.ms === 3000 && !t.cancelled)).toBe(true)
  f.fire(3000)
  await flush()
  await flush()
  expect(f.calls).toContain('close')
  expect(JSON.parse(f.writes.at(-1)!.text).stop).toBe(true)
})

test('bridge: an abort closes at once and stops the child', async () => {
  const f = fakeIo([JSON.stringify({ type: 'hello', dir: '/tmp/waitroom-abort', pid: 2 })])
  await drive(f.io, { kind: 'turnStart' })
  f.fire(2000)
  await flush()
  await flush()
  await drive(f.io, { kind: 'turnComplete', aborted: true, subagent: false, now: 5000 })
  await flush()
  expect(f.calls).toContain('close')
  expect(JSON.parse(f.writes.at(-1)!.text).stop).toBe(true)
})

test('bridge: a subagent turn.complete leaves the pane alone', async () => {
  const f = fakeIo([JSON.stringify({ type: 'hello', dir: '/tmp/waitroom-sub', pid: 3 })])
  await drive(f.io, { kind: 'turnStart' })
  f.fire(2000)
  await flush()
  await flush()
  const before = f.calls.length
  await drive(f.io, { kind: 'turnComplete', aborted: false, subagent: true, now: 5000 })
  expect(f.calls.length).toBe(before)
  expect(f.timers.some(t => t.ms === 3000)).toBe(false)
  await drive(f.io, { kind: 'off' })
  await flush()
})
