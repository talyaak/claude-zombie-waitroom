# waitroom

A Claude Code mod. While Claude works, it shows a hosted browser game in a terminal pane. You play it with the keyboard. The pane closes when Claude finishes.

## Important

- **The default game is Call of Duty: Black Ops, Zombies "Verruckt".** It is loaded from a third-party site (`https://vel.gg/bo1z/verruckt`) that this mod does not control. The game is Activision's commercial property. waitroom does not bundle, copy or redistribute any of it. Your browser downloads what the site serves, into its profile.
- Change the URL with `/waitroom url <https-url>`. The default lives in one place, `hooks/config.ts`.
- **The site is third-party and unvetted.** It sees your IP address like any visit. Its content and the files it downloads are its responsibility, not this mod's.
- The first start downloads a large file (about 309 MB at the time of writing). See `cache` below.

## Disclaimer and ownership

- **I own no part of any game, site or content this project can load.** This repository contains only original code for a Claude Code mod (a state machine, a terminal pane and a browser-mirroring helper), released under the license in `waitroom/LICENSE`. It contains no game code, assets, images, audio or data.
- **Call of Duty, Black Ops, Zombies, "Verruckt" and related names and content are the property of Activision Publishing, Inc. and its licensors.** This project is not affiliated with, endorsed by, sponsored by or connected to Activision, Microsoft, Anthropic or the operators of any game site. All trademarks belong to their respective owners.
- **I do not host, copy, distribute or control any game.** The default URL is only a configuration string pointing at a third-party site. I do not operate that site and make no claim about whether it is licensed or authorized to serve the content. You can change or clear the URL at any time.
- **You are responsible for what you load.** When you run this mod, your own browser fetches content directly from the URL you configure. You are solely responsible for making sure you have the right to access and play it, and for following the terms of that site, the game's publisher and the laws where you live.
- **No warranty.** The software is provided "as is" without warranty of any kind. I am not liable for any claim, damages or other liability arising from its use, including from third-party content, downloads or sites.
- **Takedown.** If you are a rights holder and believe anything in this repository infringes your rights, open an issue or contact the repository owner and it will be reviewed and removed promptly.

## Requirements

- Claude Code 2.1.287 or newer.
- Node.js 20 or newer on `PATH` (the mirror runs as a child process).
- Chromium, Chrome or Edge installed. Set `WAITROOM_BROWSER` to a binary path if none is found automatically.
- A terminal that draws pixel panes (Ghostty or kitty) for the game view. Other surfaces show a text status only.
- macOS is the first-supported OS. Linux works in testing. Windows paths are detected but not tested.

## Install

```sh
git clone <this repo> && cd claude-zombie-waitroom
waitroom/scripts/build.sh          # npm ci --ignore-scripts && tsc, no browser download
claude plugin validate ./waitroom --strict
claude --plugin-dir ./waitroom     # or install as a plugin
```

Then in Claude Code:

```
/waitroom url https://your-game-url
/waitroom on
```

## Commands

| Command | Does |
| --- | --- |
| `/waitroom on` / `off` | Enable or disable. `off` stops all processes. |
| `/waitroom status` | Shows on/off and the URL. |
| `/waitroom url <https-url>` | Sets the game URL. |
| `/waitroom cache fresh` | Default. Each start removes the browser profile, so the game downloads again. |
| `/waitroom cache persist` | Keeps one browser profile under the OS temp dir, so downloads are reused. |
| `/waitroom stats` | Not implemented yet. |

## Controls

WASD move, space or click fire, Q/E look left and right, Esc returns focus to Claude. Tab and arrow keys are not bound.

## Run locally

Work from a checkout of this repo. Everything below runs on your machine; nothing is published.

### 1. Build the mirror

```sh
scripts/build.sh          # npm ci --ignore-scripts, then tsc into mirror/dist
```

This needs Node 20+ and npm. It downloads no browser.

### 2. Run the tests

```sh
claude plugin validate ./ --strict   # manifest, hooks and engine rules
claude plugin test ./                # 21 mod tests: state machine, commands, bridge
cd mirror && node --test test/mirror.test.mjs   # mirror tests: starts Chromium and a local fixture page
```

The mirror tests need a Chromium. They use `WAITROOM_BROWSER` if set; otherwise they skip. The fixture page is `mirror/test/fixture/index.html`.

### 3. Run the plugin in Claude Code

```sh
claude --plugin-dir ./waitroom
```

Then in the session:

```
/waitroom status            # off, with the URL
/waitroom url https://...   # optional: change the default URL
/waitroom cache persist     # optional: keep the browser profile (saves re-downloads)
/waitroom on
```

Send a prompt that takes more than about 2 seconds. The pane opens with the game. Use WASD, space and Q/E in the pane; Esc returns focus to Claude. The pane needs a terminal that draws images (Ghostty or kitty). Elsewhere you'll see a text line instead.

### 4. Run the mirror on its own (debugging)

The child can run without Claude. It prints a `hello` line, then waits for `control.json` in its own temp dir:

```sh
WAITROOM_URL=https://example.com WAITROOM_CACHE=fresh node mirror/dist/index.js
```

Read the `dir` from the first stdout line, then write:

```json
{ "paused": false, "cols": 160, "rows": 45, "stop": false, "events": [] }
```

to `<dir>/control.json`. Frames arrive as `{"type":"frame","width":640,"height":360,"file":"..."}` lines. Each file is raw RGBA and is deleted after three newer frames. To stop, write `"stop": true`, or kill the process; the child also exits when its parent does.

Useful environment variables:

| Variable | Does |
| --- | --- |
| `WAITROOM_URL` | Page to load (https, or http on 127.0.0.1 only) |
| `WAITROOM_BROWSER` | Path to Chromium, Chrome or Edge, if not found automatically |
| `WAITROOM_CACHE` | `fresh` (default) or `persist` |

### Troubleshooting

- **"no Chromium, Chrome or Edge found"**: set `WAITROOM_BROWSER`.
- **Browser exits as root**: the child adds `--no-sandbox` automatically when running as root.
- **Leftover temp dirs**: `waitroom-*` dirs under the temp dir. A new child removes ones whose owner is gone.
- **Game stuck on the title screen**: the first start downloads a large file. Wait, or use `cache persist` for later runs.

## Uninstall

```sh
claude plugin uninstall waitroom
rm -rf "${TMPDIR:-/tmp}"/waitroom-*     # temp dirs and the persist profile, if used
```

Run `/waitroom off` first. It stops the browser and the child.

## Privacy

waitroom reads only turn IDs, the agent ID, whether a turn was aborted, the tool name and a permission decision. It never reads prompts, transcripts, file paths, tool inputs or answers, and makes no network calls of its own. The only traffic is the browser loading the URL you set.
