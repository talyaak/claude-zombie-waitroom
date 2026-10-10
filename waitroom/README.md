# waitroom

A Claude Code mod. While Claude works, it shows a hosted browser game in a terminal pane. You play it with the keyboard. The pane closes when Claude finishes.

## Important

- **The default game is Call of Duty: Black Ops, Zombies "Verruckt".** It is loaded from a third-party site (`https://vel.gg/bo1z/verruckt`) that this mod does not control. The game is Activision's commercial property. waitroom does not bundle, copy or redistribute any of it. Your browser downloads what the site serves, into its profile.
- Change the URL with `/waitroom url <https-url>`. The default lives in one place, `hooks/config.ts`.
- **The site is third-party and unvetted.** It sees your IP address like any visit. Its content and the files it downloads are its responsibility, not this mod's.
- The first start downloads a large file (about 309 MB at the time of writing). See `cache` below.

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
