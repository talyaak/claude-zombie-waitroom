import type { Elements, Register } from 'claude-code'

import { USAGE, parse } from './commands'
import { DEFAULT_URL, STORE, cacheMode } from './config'
import { type Io, INPUT, PANE, VIEW, addInput, drive, phaseOf, roundStart, setView, sourceFor } from './mirror'
import { toAction } from './input-map'
import type { Ev } from './state'

const COMMAND = 'waitroom'
const LABEL: Record<string, string | undefined> = {
  pending: 'waitroom: starting',
  playing: 'waitroom: playing',
  paused: 'waitroom: paused for you',
}

// Every mod hook builds its own `Io` from its `$`: the engine forbids passing
// `$` to a helper, so the closures are written where `$` is in scope.
let enabled = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    enabled = (await $.store.get(STORE.enabled)) === true
    await $.command.register({
      name: COMMAND,
      description: 'Mirror a game into a pane while Claude works',
      argumentHint: 'on | off | status | url <https-url> | stats',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const cmd = parse(e.args)
    const io: Io = {
      root: $.plugin.root,
      settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
      spawn: (argv, env) => $.process.spawn({ argv, env }),
      write: (path, text) => $.fs.write(path, text),
      openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
      closePane: () => $.ui.close({ id: PANE }),
      blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
      toast: text => $.ui.toast(text),
      now: () => $.clock.now(),
      after: (ms, fn) => $.clock.after(ms, fn),
    }

    if (cmd.kind === 'on' && !(((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL)) {
      return { text: 'no game url set: run /waitroom url <https-url> first' }
    }

    if (cmd.kind === 'on' || cmd.kind === 'off') {
      enabled = cmd.kind === 'on'
      await $.store.set(STORE.enabled, enabled)
      if (!enabled) await drive(io, { kind: 'off' })
      return { text: cmd.kind }
    }

    if (cmd.kind === 'status') {
      const url = ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL
      return { text: `${enabled ? 'on' : 'off'} (${url || 'no url set'})` }
    }

    if (cmd.kind === 'url') {
      await $.store.set(STORE.url, cmd.url)
      return { text: `url set to ${cmd.url}` }
    }

    if (cmd.kind === 'cache') {
      await $.store.set(STORE.cache, cmd.mode)
      return { text: `cache ${cmd.mode}: ${cmd.mode === 'persist' ? 'the game download is kept between starts' : 'the game downloads again each start'}` }
    }
    if (cmd.kind === 'badCache') return { text: 'cache must be fresh or persist' }
    if (cmd.kind === 'badUrl') return { text: 'url must be an https:// address' }
    if (cmd.kind === 'stats') return { text: 'stats: no rounds recorded yet' }
    return { text: USAGE }
  })

  on('turn.start', async ($, e, next) => {
    if (enabled) {
      await drive({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, { kind: 'turnStart' })
    }
    return next(e)
  })

  // The model's own permission asks and AskUserQuestion pause the game.
  on('tool.check', async ($, e, next) => {
    const d = await next(e)
    if (enabled) await drive({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, d.decision === 'ask' ? { kind: 'needsPerson' } : { kind: 'resumed' })
    return d
  })

  on('tool.call', async ($, e, next) => {
    if (enabled) await drive({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, e.tool === 'AskUserQuestion' ? { kind: 'needsPerson' } : { kind: 'resumed' })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!enabled && phaseOf() === 'idle') return next(e)
    const wasPlayed = phaseOf() === 'playing' || phaseOf() === 'paused' || phaseOf() === 'countdown'
    const now = await $.clock.now()
    const ev: Ev = { kind: 'turnComplete', aborted: e.reason === 'aborted', subagent: e.agentId !== undefined, now }
    await drive({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, ev)
    if (e.agentId !== undefined || !wasPlayed || roundStart() === 0) return next(e)
    const secs = Math.max(0, Math.round((now - roundStart()) / 1000))
    return { text: `waitroom: played ${secs}s` }
  })

  on('ui.message', { component: 'Pane', requestId: PANE, element: INPUT }, ($, e, next) => {
    const action = toAction(typeof e.data === 'string' ? e.data : '')
    if (action) addInput({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, action)
    return next(e)
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await drive({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, { kind: 'personClosed' })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await drive({
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      }, { kind: 'off' })
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, (_, e, next) => {
    const label = LABEL[phaseOf()]
    if (!label) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ` · ${label}` } } as typeof e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => {
    if (e.surface !== 'terminal') {
      // Pixel panes need a terminal that draws Image; other surfaces get a line.
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text dimColor>waitroom draws its game in terminal panes only (Ghostty, kitty).</Text>
        </Box>
      )
    }
    // The surface check above narrows at run time; the resolve type does not follow it.
    const els = $.ui.resolve(e) as Elements['terminal']
    // 16:9 picture. A cell is about twice as tall as wide, so rows are cols * 9/16 / 2.
    const cols = Math.min(160, Math.max(20, (e.viewport?.columns ?? 80) - 4))
    const rows = Math.min(Math.round((cols * 9) / 32), Math.max(6, (e.viewport?.rows ?? 24) - 8))
    void setView(
      {
        root: $.plugin.root,
        settings: async () => ({
          url: ((await $.store.get(STORE.url)) as string | undefined) ?? DEFAULT_URL,
          cache: cacheMode(await $.store.get(STORE.cache)),
        }),
        spawn: (argv, env) => $.process.spawn({ argv, env }),
        write: (path, text) => $.fs.write(path, text),
        openPane: () => $.ui.open({ id: PANE, title: 'waitroom', focus: true }),
        closePane: () => $.ui.close({ id: PANE }),
        blit: frame => $.ui.blit({ requestId: PANE, key: VIEW, source: { file: frame.file, format: 'rgba', width: frame.width, height: frame.height } }),
        toast: text => $.ui.toast(text),
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
      },
      cols,
      rows,
    )
    return (
      <els.Box flexDirection="column">
        <els.Image key={VIEW} columns={cols} rows={rows} alt="waitroom game view" source={sourceFor()} />
        <els.Client key={INPUT} module="./pane-input.tsx" props={{ hint: 'WASD move · space fire · Q/E look · Esc back to Claude' }} />
      </els.Box>
    )
  })
}
