// Pure state machine: events in, effects out. No timers, no $, no I/O.
// register.ts owns the clock and performs the effects.

export type Phase = 'idle' | 'pending' | 'playing' | 'paused' | 'countdown' | 'closed'

export type Shown = {
  phase: Phase
  // Set when the person closes the pane; cleared by the next main turn.
  suppressed: boolean
  // True once a pane opened during the current turn (decides the round line).
  played: boolean
  // When the pane opened this turn, ms since epoch.
  openedAt: number
}

export type Ev =
  | { kind: 'turnStart' }
  | { kind: 'pendingElapsed' }
  | { kind: 'needsPerson' } // permission ask or AskUserQuestion
  | { kind: 'resumed' } // a decision or tool call after the pause
  | { kind: 'turnComplete'; aborted: boolean; subagent: boolean; now: number }
  | { kind: 'countdownElapsed' }
  | { kind: 'personClosed' }
  | { kind: 'off' } // /waitroom off or session end

export type Effect =
  | 'armPending'
  | 'cancelPending'
  | 'open'
  | 'handBack'
  | 'resume'
  | 'armCountdown'
  | 'close'
  | 'kill'

export type Step = { shown: Shown; effects: Effect[]; roundPlayedMs?: number }

export const initial = (): Shown => ({ phase: 'idle', suppressed: false, played: false, openedAt: 0 })

const keep = (shown: Shown, effects: Effect[] = []): Step => ({ shown, effects })

export function step(shown: Shown, ev: Ev): Step {
  switch (ev.kind) {
    case 'turnStart': {
      if (shown.phase === 'idle' || shown.phase === 'closed') {
        return keep({ ...shown, phase: 'pending', suppressed: false, played: false }, ['armPending'])
      }
      if (shown.phase === 'countdown' || shown.phase === 'playing' || shown.phase === 'paused') {
        // A new main turn begins while the old pane still shows: close it first.
        return keep({ ...shown, phase: 'pending', suppressed: false, played: false }, ['close', 'armPending'])
      }
      return keep(shown)
    }

    case 'pendingElapsed':
      if (shown.phase !== 'pending' || shown.suppressed) return keep(shown)
      return keep({ ...shown, phase: 'playing', played: true, openedAt: 0 }, ['open'])

    case 'needsPerson':
      if (shown.phase === 'pending') return keep({ ...shown, phase: 'idle' }, ['cancelPending'])
      if (shown.phase === 'playing') return keep({ ...shown, phase: 'paused' }, ['handBack'])
      return keep(shown)

    case 'resumed':
      if (shown.phase === 'paused') return keep({ ...shown, phase: 'playing' }, ['resume'])
      return keep(shown)

    case 'turnComplete': {
      // A subagent's turn ends are not the main turn's: ignore them outright.
      if (ev.subagent) return keep(shown)
      if (shown.phase === 'pending') return keep({ ...shown, phase: 'idle' }, ['cancelPending'])
      if (shown.phase === 'playing' || shown.phase === 'paused') {
        if (ev.aborted) return keep({ ...shown, phase: 'closed' }, ['kill', 'close'])
        return keep({ ...shown, phase: 'countdown' }, ['armCountdown'])
      }
      if (shown.phase === 'countdown' && ev.aborted) return keep({ ...shown, phase: 'closed' }, ['kill', 'close'])
      return keep(shown)
    }

    case 'countdownElapsed':
      if (shown.phase !== 'countdown') return keep(shown)
      return keep({ ...shown, phase: 'closed' }, ['kill', 'close'])

    case 'personClosed':
      if (shown.phase === 'playing' || shown.phase === 'paused' || shown.phase === 'countdown') {
        return keep({ ...shown, phase: 'closed', suppressed: true }, ['kill'])
      }
      return keep(shown)

    case 'off':
      if (shown.phase === 'idle') return keep(shown)
      return keep({ ...initial() }, ['cancelPending', 'kill', 'close'])
  }
}
