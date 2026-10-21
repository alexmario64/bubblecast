# Continue on another PC

## First setup (Windows)

1. Install Git and Node.js 22 or newer. Sign in to GitHub with the account that owns this private repository.
2. Clone the repository and open that folder in Codex or your editor.
3. Run `npm install --global pnpm@11.25.0`, then `pnpm install --frozen-lockfile --ignore-scripts`.
4. Run `pnpm test` to check the checkout.
5. Run `pnpm install:background` (or double-click Install Background App.cmd). This downloads the official Electron runtime and verifies its checksum.
6. Run Start Bubblecast Background.vbs. Open http://127.0.0.1:3927 and enter your stream connections. Sign in to platforms again when you need to send chat or manage polls.
7. Install Komika Axis on the new Windows account to match the existing overlay. The font is not bundled in Git.
8. Add http://127.0.0.1:3927/dock as an OBS custom browser dock. Chat overlay: /overlay. Combined poll overlay: /poll-overlay. Set OBS Browser sources to your canvas dimensions (3840 × 2160 for 4K). Each URL is served by the helper on that PC.
9. For automatic startup with OBS, add Bubblecast OBS.lua in OBS Tools → Scripts and select this checkout's Start Bubblecast Background.vbs path.

Browser accounts, machine-bound credentials, recent chat history, helper runtime, and personal settings are intentionally not synchronized through Git. Do not copy .local/ sessions between machines. Re-enter connections and sign in on each PC. The helper on this PC continues running independently.

## Daily workflow

Before working: `git pull --ff-only`. Make changes and run `pnpm test`. Commit the source changes and `git push`. On the other PC, pull before continuing. Avoid editing the same branch on both PCs at once without pushing first.

Open this repository folder in a new Codex task on the other PC. Ask it to read AGENTS.md and DEVELOPMENT.md and continue from the current commit. Git transfers the code and development notes; this conversation itself is not copied by Git.

## Architecture

- server.mjs: local HTTP/SSE server, settings, relay, authenticated helper command queue.
- desktop/main.cjs: Electron background capture with persistent per-platform sessions.
- desktop/chat-composer.mjs, native-poll.mjs, end-poll.mjs: native signed-in actions; shared-poll.mjs coordinates multi-destination launches.
- public/dock.js and poll-board.mjs: modular chat workspace and independent resizable poll pane.
- public/overlay.js: chat Browser source. public/poll-overlay.js: mixed poll Browser source with the same bubble theme.
- poll-jobs.mjs and polls.mjs: idempotent jobs and normalized poll state.
- test/: unit tests; test/browser/: DOM fixture coverage with happy-dom. `pnpm test:relay` is a separate live local integration check and may display synthetic overlay messages.

## Current behavior (1.16.0)

Polls open beside existing chat/split views; selecting Twitch, YouTube, TikTok or Kick does not filter out other platforms' polls. Wide docks place polls alongside chat; narrow docks stack the pane below chat. Resize with the divider or close it with ×. The Polls button reopens it. Successful poll creation opens the pane without replacing chat iframe sessions.

Combined totals sum known answer counts. Percentage-only sources are labeled separately rather than being presented as exact combined counts. Both YouTube streams are independent poll destinations. Final dock results remain available for five minutes; stream-overlay final results remain for 15 seconds.

YouTube ending is confirmed from an explicit native ended state or stable disappearance from the still-loaded chat, then synchronized into the local poll store. The general capture observer retains a separate disappearance grace period. Fixtures cover this timing mismatch; a live check remains valuable after platform markup changes.
