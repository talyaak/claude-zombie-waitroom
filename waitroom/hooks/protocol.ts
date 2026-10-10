// Mod-side mirror of mirror/src/protocol.ts. Keep the two in step.

export type Action =
  | { kind: 'move'; dir: 'w' | 'a' | 's' | 'd' }
  | { kind: 'fire' }
  | { kind: 'look'; dir: 'left' | 'right' }

export type InputEvent = Action & { id: number }

export type Control = {
  paused: boolean
  cols: number
  rows: number
  stop: boolean
  events: InputEvent[]
}

export type Outbound =
  | { type: 'hello'; dir: string; pid: number }
  | { type: 'status'; text: string }
  | { type: 'error'; message: string }
  | { type: 'frame'; width: number; height: number; file: string }

// One stdout line from the child, or undefined when it is not one of ours.
export function parseLine(line: string): Outbound | undefined {
  try {
    const msg = JSON.parse(line) as Outbound
    return msg && typeof msg.type === 'string' ? msg : undefined
  } catch {
    return undefined
  }
}

export const MAX_EVENTS = 20
