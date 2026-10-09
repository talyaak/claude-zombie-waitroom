# waitroom

A Claude Code mod. While Claude works, it shows a hosted browser game in a terminal pane. You play it with the keyboard. The pane closes when Claude finishes.

## Important

- **The game URL is yours.** waitroom ships no game and no default URL you should trust. Set it with `/waitroom url <https-url>`.
- **The site is third-party and unvetted.** Your browser loads it like any visit, so the site sees your IP address. The site and anything it loads are its responsibility, not this mod's.
- Some sites download large files into the browser profile on first play. See `cache` below.

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

## Uninstall

```sh
claude plugin uninstall waitroom
rm -rf "${TMPDIR:-/tmp}"/waitroom-*     # temp dirs and the persist profile, if used
```

Run `/waitroom off` first. It stops the browser and the child.

## Privacy

waitroom reads only turn IDs, the agent ID, whether a turn was aborted, the tool name and a permission decision. It never reads prompts, transcripts, file paths, tool inputs or answers, and makes no network calls of its own. The only traffic is the browser loading the URL you set.
