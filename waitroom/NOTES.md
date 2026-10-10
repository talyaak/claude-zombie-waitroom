# waitroom: build notes

## Status

| Milestone | State |
| --- | --- |
| M1 skeleton | Done. `validate --strict` passes; `claude -p "/waitroom status"` prints `waitroom: off (...)`. |
| M2 state machine | Done. `state.ts` pure, 15 transition tests. `mod.test.ts` covers parsing. `bridge.test.ts` drives the mirror lifecycle with a fake engine. 21 tests pass. |
| M3a feasibility | Partly done. Reachability, screencast fps and the title-screen flow were measured. Pointer-look and gameplay are NOT verified; see below. |
| M3b lifecycle | Built, not verified in a real pane. Needs a Ghostty/kitty run. |
| M4 input | Built (keys via a Client module). Not verified in a real pane. |
| M5 polish | Partial. `/waitroom url`, `status`, `cache` done. `stats` is a stub. The narrow-terminal button is not built. README/install wording is written. |
| M6 pane quality | Not done. |

## Decision: the default URL (resolved)

Decided by the user: the Zombies URL is the default. Config stays in `hooks/config.ts`; the change is easy to revert. The IP and commercial-game risk is stated in the README. Earlier findings:

The default URL (`https://vel.gg/bo1z/verruckt`) loads **Call of Duty: Black Ops, Zombies "Verruckt"**, a commercial Activision game, from a third-party site. Measured in the spike:

- The title screen reads "PRESS ANY KEY TO START" and "DOWNLOAD 309.3 MB".
- Pressing a key starts a browser-side download (24%, about 30 s left in one sample). Each fresh profile repeats it.
- The spike stopped there. Gameplay, pointer look and fps during play were not measured.


## Cache setting (`/waitroom cache fresh|persist`)

- `fresh` (default): the browser profile lives in this boot's temp dir and is deleted on exit. Every start downloads the game again. This follows the spec's throwaway-profile rule.
- `persist`: one profile under `<tmp>/waitroom-profile` is reused. The game download is kept between starts. This is opt-in because it breaks the spec's "nothing outside the throwaway profile" rule. Choosing it is the user's decision.
- Verified: `fresh` leaves no dir after stop; `persist` keeps the profile.

## Measurements (headless=new, Chromium 141, 640x360, software GL, this container)

- Page load: about 1.3 s to `load`.
- Screencast on the fixture: 30 fps reported by the spike (the game page itself was animating).
- Mirror child on the fixture: frames at 15-20 fps needed in the pane. Re-measure in a real terminal.
- Claude turn latency with the mod on vs off: not measured (needs a real session).

## Spec deviations (the `.d.ts` wins)

1. `turn.complete` has no `isAborted`. The field is `reason: 'aborted'`. The code uses `reason`.
2. Mod entry is `hooks/register.tsx`, not `.ts`, because the pane uses JSX. The Client surface module is `hooks/pane-input.tsx`.
3. Control channel: no CDP port and no token. The child launches Chromium with `pipe: true`. An earlier note said puppeteer's default was already a pipe; it is not. The default is a WebSocket on a random localhost port, which we removed. The mod→child channel is a file (`control.json`) in the child's private `mkdtemp` dir, written with `$.fs.write`. The child polls it at 50 ms. Reason: `$.process.spawn` closes stdin after one string, so there is no live stdin channel.
4. Key events report presses only, not releases. Movement is a press held for 180 ms per event.
5. `tool.check` returns `ask` before the dialog opens, so the mod can pause on it. The resume signal is any later `tool.check` or `tool.call`. After an AskUserQuestion, resume waits for the next tool event or turn end.
6. The default `tsconfig` of the mirror targets NodeNext; the browser detector is `browser.ts`.
7. `--no-sandbox` is passed only when the child runs as root (containers). Desktop users keep the sandbox.
8. Screencast needs the game tab in the foreground. The child calls `bringToFront()` before starting it.
9. Orphaned Chromium (fixed). A SIGKILLed child left Chromium running: 10 processes with the WebSocket transport. The probe (`scratchpad/orphan-probe`) showed that with `pipe: true` Chrome exits when its parent dies: 0 left. The child now uses the pipe. Verified on the real child: SIGKILL leaves 0 Chromium processes.
    - A SIGKILLed child also cannot remove its temp dir. Temp dirs are named `waitroom-<pid>-*`, and each new child removes dirs whose PID is no longer running. Verified: the orphaned dir was removed on the next start.
    - Normal stop still goes through `stop` in `control.json` and `browser.close()`.
10. `$.plugin.root`, `$.fs.write` to the child's temp dir and `$.process.spawn` pass `validate --strict`.
11. The child needs `node` on PATH. Documented in the README.
12. Gating-hook warnings from `validate` (for `command.run`, `tool.check`, `tool.call`, `ui.close`) are informational. The hooks always return `next(e)`, so no `.catch` was added.

## Dependencies (exact pins, `mirror/package-lock.json`)

- puppeteer-core 25.12.0 (Apache-2.0). Published 2026-09-23, so it clears the two-week rule.
- typescript 5.9.3, @types/node 22.15.3 (build only).
- Install with `npm ci --ignore-scripts`. No browser is downloaded.

## Not verified here (needs a user run)

- Pane placement at 160 vs 100 columns.
- Keyboard focus between Claude's prompt and the Client.
- Ghostty/kitty fps, and a manual playthrough.
- Look (Q/E) on the real game: synthetic mouse moves may not reach a pointer-locked game.
- Hot reload in a real session.
