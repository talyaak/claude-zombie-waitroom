import { expect, test } from 'claude-code/testing'

import { type Ev, type Shown, initial, step } from '../hooks/state'

const run = (shown: Shown, ...evs: Ev[]) => evs.reduce((acc, ev) => step(acc.shown, ev), { shown, effects: [] as string[] } as ReturnType<typeof step>)
const main = (aborted = false): Ev => ({ kind: 'turnComplete', aborted, subagent: false, now: 0 })
const sub: Ev = { kind: 'turnComplete', aborted: false, subagent: true, now: 0 }

test('turn.start arms the pending timer from idle', () => {
  const r = step(initial(), { kind: 'turnStart' })
  expect(r.shown.phase).toBe('pending')
  expect(r.effects).toEqual(['armPending'])
})

test('pending elapses into playing and opens the pane', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' })
  expect(r.shown.phase).toBe('playing')
  expect(r.shown.played).toBe(true)
})

test('a permission ask or AskUserQuestion pauses playing and hands back', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, { kind: 'needsPerson' })
  expect(r.shown.phase).toBe('paused')
  expect(r.effects).toEqual(['handBack'])
})

test('a resumed decision returns paused to playing', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, { kind: 'needsPerson' }, { kind: 'resumed' })
  expect(r.shown.phase).toBe('playing')
  expect(r.effects).toEqual(['resume'])
})

test('an ask during pending cancels the timer without opening the pane', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'needsPerson' })
  expect(r.shown.phase).toBe('idle')
  expect(r.effects).toEqual(['cancelPending'])
})

test('a subagent turn.complete is ignored entirely', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, sub)
  expect(r.shown.phase).toBe('playing')
  expect(r.effects).toEqual([])
})

test('a finished main turn starts the countdown', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, main())
  expect(r.shown.phase).toBe('countdown')
  expect(r.effects).toEqual(['armCountdown'])
})

test('the countdown closes the pane', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, main(), { kind: 'countdownElapsed' })
  expect(r.shown.phase).toBe('closed')
  expect(r.effects).toEqual(['kill', 'close'])
})

test('an abort closes at once, from playing, paused or countdown', () => {
  const playing = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, main(true))
  expect(playing.shown.phase).toBe('closed')
  const paused = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, { kind: 'needsPerson' }, main(true))
  expect(paused.shown.phase).toBe('closed')
  const counting = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, main(), main(true))
  expect(counting.shown.phase).toBe('closed')
})

test('an abort during pending goes idle with nothing opened', () => {
  const r = run(initial(), { kind: 'turnStart' }, main(true))
  expect(r.shown.phase).toBe('idle')
  expect(r.shown.played).toBe(false)
})

test('a person close suppresses the pane until the next turn.start', () => {
  const closed = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, { kind: 'personClosed' })
  expect(closed.shown.phase).toBe('closed')
  expect(closed.shown.suppressed).toBe(true)
  const sameTurn = run(closed.shown, { kind: 'pendingElapsed' })
  expect(sameTurn.shown.phase).toBe('closed')
  const nextTurn = run(closed.shown, { kind: 'turnStart' }, { kind: 'pendingElapsed' })
  expect(nextTurn.shown.phase).toBe('playing')
  expect(nextTurn.shown.suppressed).toBe(false)
})

test('a new turn during countdown closes the old pane and re-arms pending', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, main(), { kind: 'turnStart' })
  expect(r.shown.phase).toBe('pending')
  expect(r.effects).toEqual(['close', 'armPending'])
})

test('off from any live phase kills everything and resets', () => {
  const r = run(initial(), { kind: 'turnStart' }, { kind: 'pendingElapsed' }, { kind: 'off' })
  expect(r.shown.phase).toBe('idle')
  expect(r.effects).toEqual(['cancelPending', 'kill', 'close'])
})
