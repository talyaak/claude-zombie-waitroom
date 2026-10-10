// Wire format between the mod and this child. Frames go out as JSON lines on
// stdout; input and lifecycle come back through control.json in the child's
// private temp dir (the mod writes it with $.fs.write; the child polls it).

export type InputEvent =
  | { id: number; kind: 'move'; dir: 'w' | 'a' | 's' | 'd' }
  | { id: number; kind: 'fire' }
  | { id: number; kind: 'look'; dir: 'left' | 'right' }

export type Control = {
  paused: boolean
  cols: number // pane size in cells; 0 means no frames wanted
  rows: number
  stop: boolean
  events: InputEvent[] // the most recent events; the child applies ids it has not seen
}

export type Outbound =
  | { type: 'hello'; dir: string; pid: number }
  | { type: 'status'; text: string }
  | { type: 'error'; message: string }
  | { type: 'frame'; width: number; height: number; file: string } // RGBA, width*height*4 bytes

export const emit = (msg: Outbound) => {
  process.stdout.write(JSON.stringify(msg) + '\n')
}
