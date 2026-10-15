// Runs the built mirror against the local fixture page: frames flow, cell
// output has the right size, a key press changes the frames, and `stop` exits
// the child and removes its temp dir. Needs a browser: WAITROOM_BROWSER or a
// Chrome/Chromium on PATH. Skips when none is found.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const fixture = readFileSync(join(here, 'fixture', 'index.html'))
const COLS = 80
const ROWS = 20
const W = 640
const H = 360

// Use WAITROOM_BROWSER when set; otherwise the Playwright Chromium this container ships.
const PLAYWRIGHT_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
if (!process.env.WAITROOM_BROWSER && existsSync(PLAYWRIGHT_CHROME)) process.env.WAITROOM_BROWSER = PLAYWRIGHT_CHROME
const hasBrowser = () => Boolean(process.env.WAITROOM_BROWSER)

async function startServer() {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(fixture)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return { server, url: `http://127.0.0.1:${server.address().port}/` }
}

function launch(url) {
  const child = spawn(process.execPath, [join(root, 'dist', 'index.js')], {
    env: { ...process.env, WAITROOM_URL: url },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const frames = []
  const statuses = []
  let hello
  let buf = ''
  let stderr = ''
  child.stderr.on('data', d => (stderr += d))
  child.stdout.on('data', d => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i))
      buf = buf.slice(i + 1)
      if (msg.type === 'hello') hello = msg
      else if (msg.type === 'frame') {
        // The child deletes old frame files; read this one now.
        msg.rgba = readFileSync(msg.file)
        frames.push(msg)
      }
      else statuses.push(msg)
    }
  })
  const waitFor = async (pred, ms) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (pred()) return true
      await new Promise(r => setTimeout(r, 25))
    }
    return pred()
  }
  return { child, frames, statuses, hello: () => hello, waitFor, stderr: () => stderr }
}

const control = (dir, extra) =>
  writeFile(join(dir, 'control.json'), JSON.stringify({ paused: false, cols: COLS, rows: ROWS, stop: false, events: [], ...extra }))

test('mirror: frames flow as RGBA files, a key press changes the view, stop cleans up', { skip: !hasBrowser() && 'no browser' }, async t => {
  const { server, url } = await startServer()
  t.after(() => server.close())
  const m = launch(url)
  t.after(() => m.child.kill('SIGKILL'))

  assert.ok(await m.waitFor(() => m.hello(), 10000), 'hello line from the child')
  const dir = m.hello().dir
  assert.ok(existsSync(dir), 'child created its temp dir')
  await control(dir, {})

  assert.ok(await m.waitFor(() => m.frames.length >= 5, 20000), `frames arrive (got ${m.frames.length}); stderr: ${m.stderr()}`)
  const f0 = m.frames.at(-1)
  assert.equal(f0.width, W)
  assert.equal(f0.height, H)
  assert.equal(f0.rgba.length, W * H * 4, 'RGBA, four bytes per pixel')

  // The red square's leftmost column must move right after a D press.
  // Scan the square's middle row (the fixture draws it at y 150..210).
  const leftmostRed = f => {
    let best = Infinity
    for (let x = 0; x < W; x++) {
      const i = (180 * W + x) * 4
      if (f.rgba[i] > 180 && f.rgba[i + 1] < 90) best = Math.min(best, x)
    }
    return best
  }
  const startCol = leftmostRed(m.frames.at(-1))
  const mark = m.frames.length
  await control(dir, { events: [{ id: 1, kind: 'move', dir: 'd' }] })
  const moved = await m.waitFor(() => m.frames.slice(mark).some(f => leftmostRed(f) > startCol), 10000)
  assert.ok(moved, `key press moves the square right (start pixel column ${startCol})`)

  await control(dir, { stop: true })
  const exited = await new Promise(r => {
    const t0 = Date.now()
    m.child.on('exit', code => r({ code, ms: Date.now() - t0 }))
    setTimeout(() => r(undefined), 8000)
  })
  assert.ok(exited, 'child exits on stop')
  assert.equal(exited.code, 0)
  assert.ok(!existsSync(dir), 'temp dir removed on exit')
})

test('mirror: exits with a clear error when the URL is not https or loopback', async () => {
  const m = launch('http://example.com/')
  const exit = await new Promise(r => m.child.on('exit', code => r(code)))
  assert.equal(exit, 2)
})
