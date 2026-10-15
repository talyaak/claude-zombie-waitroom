// Pure parsing of `/waitroom <sub> [args]`. No $, so tests can cover it.

export type Parsed =
  | { kind: 'on' | 'off' | 'status' | 'stats' | 'usage' }
  | { kind: 'url'; url: string }
  | { kind: 'badUrl' }
  | { kind: 'cache'; mode: 'fresh' | 'persist' }
  | { kind: 'badCache' }

export const isHttps = (url: string) => /^https:\/\/\S+$/.test(url)

export function parse(args: string): Parsed {
  const words = args.trim().split(/\s+/).filter(Boolean)
  const sub = words[0] ?? 'status'
  const rest = words.slice(1)
  if (sub === 'on' || sub === 'off' || sub === 'status' || sub === 'stats') return { kind: sub }
  if (sub === 'url') {
    const url = rest.join(' ')
    return isHttps(url) ? { kind: 'url', url } : { kind: 'badUrl' }
  }
  if (sub === 'cache') {
    const mode = rest[0]
    return mode === 'fresh' || mode === 'persist' ? { kind: 'cache', mode } : { kind: 'badCache' }
  }
  return { kind: 'usage' }
}

export const USAGE = 'usage: /waitroom on | off | status | url <https-url> | cache fresh|persist | stats'
