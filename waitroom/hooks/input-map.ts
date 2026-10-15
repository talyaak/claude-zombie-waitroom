// Keys the pane's Client sees, mapped to waitroom input. Escape never arrives
// here (the surface returns focus to Claude on Escape).
import type { Action } from './protocol'


export function toAction(key: string): Action | undefined {
  const k = key.length === 1 ? key.toLowerCase() : key
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') return { kind: 'move', dir: k }
  if (k === 'q') return { kind: 'look', dir: 'left' }
  if (k === 'e') return { kind: 'look', dir: 'right' }
  if (k === ' ' || k === 'space') return { kind: 'fire' }
  return undefined
}
