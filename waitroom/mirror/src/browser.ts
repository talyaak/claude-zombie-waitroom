// Finds a Chromium-family binary without downloading one. Override with WAITROOM_BROWSER.
import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'

const isExecutable = (path: string) => {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const onPath = (names: string[]) => {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    for (const name of names) {
      const full = join(dir, name)
      if (isExecutable(full)) return full
    }
  }
  return undefined
}

export function findBrowser(): string | undefined {
  const override = process.env.WAITROOM_BROWSER
  if (override) return isExecutable(override) ? override : undefined

  const candidates: Record<string, () => string[]> = {
    darwin: () => [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    win32: () => {
      const roots = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']]
      return roots.flatMap(root => root ? [
        join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ] : [])
    },
    linux: () => [],
  }

  const fixed = (candidates[process.platform] ?? (() => []))().find(isExecutable)
  if (fixed) return fixed
  return onPath(['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'chrome'])
}
