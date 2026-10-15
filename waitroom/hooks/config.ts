// No game URL ships with this repo. The user supplies one with
// `/waitroom url <https-url>` or the WAITROOM_URL environment variable.
export const DEFAULT_URL: string =
  (typeof process !== 'undefined' && process.env?.WAITROOM_URL) || ''
export const STORE = { enabled: 'enabled', url: 'url', cache: 'cache' } as const

// `fresh`: the browser profile lives in this boot's temp dir and is deleted on
// exit, so every waitroom start downloads the game again. `persist`: one
// profile is kept under the OS temp dir, so the game's download is reused.
export type CacheMode = 'fresh' | 'persist'
export const DEFAULT_CACHE: CacheMode = 'fresh'
export const cacheMode = (v: unknown): CacheMode => (v === 'persist' ? 'persist' : DEFAULT_CACHE)
