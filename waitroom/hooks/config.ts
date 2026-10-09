// The only place the default game URL lives. It is user-supplied config,
// not a bundled or endorsed asset; override with `/waitroom url <https-url>`.
export const DEFAULT_URL = 'https://vel.gg/bo1z/verruckt'
export const STORE = { enabled: 'enabled', url: 'url', cache: 'cache' } as const

// `fresh`: the browser profile lives in this boot's temp dir and is deleted on
// exit, so every waitroom start downloads the game again. `persist`: one
// profile is kept under the OS temp dir, so the game's download is reused.
export type CacheMode = 'fresh' | 'persist'
export const DEFAULT_CACHE: CacheMode = 'fresh'
export const cacheMode = (v: unknown): CacheMode => (v === 'persist' ? 'persist' : DEFAULT_CACHE)
