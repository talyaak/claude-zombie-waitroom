import { expect, test } from 'claude-code/testing'

import { parse } from '../hooks/commands'

test('parse: on, off, status, stats', () => {
  expect(parse('on')).toEqual({ kind: 'on' })
  expect(parse('off')).toEqual({ kind: 'off' })
  expect(parse('status')).toEqual({ kind: 'status' })
  expect(parse('stats')).toEqual({ kind: 'stats' })
})

test('parse: empty args reads as status', () => {
  expect(parse('')).toEqual({ kind: 'status' })
})

test('parse: url accepts https and rejects everything else', () => {
  expect(parse('url https://example.com/game')).toEqual({ kind: 'url', url: 'https://example.com/game' })
  expect(parse('url http://example.com')).toEqual({ kind: 'badUrl' })
  expect(parse('url')).toEqual({ kind: 'badUrl' })
  expect(parse('url https://')).toEqual({ kind: 'badUrl' })
})

test('parse: cache takes fresh or persist', () => {
  expect(parse('cache persist')).toEqual({ kind: 'cache', mode: 'persist' })
  expect(parse('cache fresh')).toEqual({ kind: 'cache', mode: 'fresh' })
  expect(parse('cache')).toEqual({ kind: 'badCache' })
  expect(parse('cache sometimes')).toEqual({ kind: 'badCache' })
})

test('parse: unknown subcommand is usage', () => {
  expect(parse('nope')).toEqual({ kind: 'usage' })
})
