# Continue on another PC

Canonical repository: https://github.com/alexmario64/bubblecast. All ongoing development uses a Git-connected clone of this repository; exported ZIPs and older workspace copies are not development sources.

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

## Development on macOS

The Mac is a development machine; streaming and OBS stay on Windows.

1. Install Node.js 22 or newer and run `npm install --global pnpm@11.25.0`, then `pnpm install --frozen-lockfile --ignore-scripts`.
2. `pnpm test`, then `pnpm start` for the server at http://127.0.0.1:3927.
3. `pnpm install:background` downloads the macOS Electron build (checksum verified). `pnpm start:background` launches the helper; quit it from its menu bar icon.
4. Local credentials (YouTube OAuth) are encrypted with a key stored in the login Keychain instead of Windows DPAPI. Credentials saved on one OS cannot be read on the other; reconnect on each machine.
5. Komika Axis is read from `~/Library/Fonts` or `/Library/Fonts` when installed.

The `.cmd`, `.vbs` and OBS Lua launchers remain Windows-only. GitHub Actions runs `pnpm test` on Windows for every push and pull request, so check that it passes before merging.

## Visual checks

`pnpm exec playwright install chromium` once per machine, then `pnpm screenshots` captures every Studio page (both color schemes and phone width), the dock and each overlay state into `.local/screenshots/` (ignored by Git). Pass name filters to capture a subset, e.g. `pnpm screenshots polls dock`. The run fails if a page throws or a request errors. It reuses the server on port 3927 or starts one, and theme variants are applied in the page only, so no settings are written. Review screenshots after any UI change.

## Daily workflow

Before working: `git checkout main && git pull --ff-only`. Create a branch (`git checkout -b feature/<short-name>`), make changes, and run `pnpm test`. Push the branch and open a pull request into `main`; nothing is committed or pushed directly to `main`. Merge after the Windows test check passes. On the streaming PC, `git pull --ff-only` on `main`, then restart the background helper and refresh affected OBS sources.

Open this repository folder in a new Codex task on the other PC. Ask it to read AGENTS.md and DEVELOPMENT.md and continue from the current commit. Git transfers the code and development notes; this conversation itself is not copied by Git.

## Architecture

- server.mjs: local HTTP/SSE server, settings, relay, authenticated helper command queue.
- desktop/main.cjs: Electron background capture with persistent per-platform sessions.
- desktop/chat-composer.mjs, native-poll.mjs, end-poll.mjs: native signed-in actions; shared-poll.mjs coordinates multi-destination launches.
- public/dock.js and poll-board.mjs: modular chat workspace and independent resizable poll pane.
- public/overlay.js: chat Browser source. public/poll-overlay.js: mixed poll Browser source with the same bubble theme.
- poll-jobs.mjs and polls.mjs: idempotent jobs and normalized poll state.
- test/: unit tests; test/browser/: DOM fixture coverage with happy-dom. `pnpm test:relay` is a separate live local integration check and may display synthetic overlay messages.

## Current behavior (1.19.0)

Polls open beside existing chat/split views; selecting Twitch, YouTube, TikTok or Kick does not filter out other platforms' polls. Wide docks place polls alongside chat; narrow docks stack the pane below chat. Resize with the divider or close it with ×. The Polls button reopens it. Successful poll creation opens the pane without replacing chat iframe sessions.

Combined totals sum known answer counts. Percentage-only sources are labeled separately rather than being presented as exact combined counts. Both YouTube streams are independent poll destinations. Final dock results remain available for five minutes; stream-overlay final results remain for 15 seconds.

YouTube ending is confirmed from an explicit native ended state or stable disappearance from the still-loaded chat, then synchronized into the local poll store. The general capture observer retains a separate disappearance grace period. Fixtures cover this timing mismatch; a live check remains valuable after platform markup changes.

Studio (`/`) is organized as sidebar pages: Overview (setup checklist, channel status, quick actions), Connections, Chat overlay, Poll overlay, Chat dock and OBS setup, addressed by URL hash (`/#polls`). Appearance changes preview instantly in the embedded overlay and save automatically after a short pause; connections still save explicitly because they reload sources. Confirmations appear as brief toasts; failures stay on screen until dismissed, and a banner appears only while the background app is offline.

The poll overlay has its own settings (`poll*` keys in `core.mjs`): position (corners or center), entrance animation, width, text size, bar thickness, final-results duration, colors that follow the chat overlay or are custom, which details are shown, leader highlight, floating motion and the live/final labels.

Bots: common bots are built in (`knownBots` in `core.mjs`), and each user adds their own (`ignoredBots`). Stream overlays hide every bot unless it is listed in `overlayShownBots` (the `filterBots` switch turns this off entirely). The dock shows every bot unless it is listed in `dockHiddenBots`. Studio's Chat overlay → Bots table edits both columns, and the dock's Bots menu edits the dock column. The relay always keeps bot messages, so changes apply immediately without losing chat.

Theme colors live in `public/theme.css` and are shared by Studio and the dock, so each color scheme looks the same in both. Component styles (`style.css`, `dock.css`) use only those tokens. The dock reports problems and keeps them visible (capture errors, unconfirmed sends), while successful sends confirm briefly and clear.

Live viewers (1.17.0): every 30 seconds the helper runs `desktop/viewer-probe.mjs` inside each platform page it already has open, one page at a time with a 10-second limit, and reports `{live, viewers}` in its collector status. Twitch uses its web GraphQL `viewersCount`, YouTube the player's `updated_metadata` view-count entity (live streams send "N watching now"; ended videos send lifetime views, treated as offline), Kick its channel API `livestream.viewer_count`, and TikTok its room API `liveRoomStats.userCount`. These are read-only, undocumented web endpoints and can change: Twitch, YouTube and Kick were verified against real live streams on 2026-10-21; TikTok was verified only for offline rooms. Studio's Overview shows the total, a per-platform split and a trend since the page opened; the dock shows the total and a count on each platform chip.

Brand and themes (1.18.0): the logo is the bubble trio in `public/logo-glyph.svg`, drawn on a theme tile (`--logo-tile`: the accent gradient on rose and red, midnight on Midnight and White). `public/favicon.svg` is the full icon on the midnight tile; `logos/tray.png`, `logos/tray@2x.png` and `logos/icon-256.png` are rendered from it for the helper's tray and windows. Interface themes are rose, red, midnight (dark) and white; all colors, including status colors (`--good`, `--warn`, `--bad`, `--live`), come from `public/theme.css`.

Studio → Appearance holds the app theme (`uiTheme`) and the chat dock theme (`dockTheme`: `app` to match, or its own theme). The dock's Connections sheet edits `dockTheme`.

Stream events (1.19.0): events travel as chat messages with an `event` field (`eventKinds` in `core.mjs`). Overlays show the kinds listed in `eventsShown` (all except follows by default, toggled in Studio → Chat overlay → Stream events); the relay and dock keep every event. Sources, verified against real traffic on 2026-10-21:
- Twitch subs, resubs, gifted subs, gift bombs (individual gifts inside a bomb are collapsed), raids and watch streaks: IRC `USERNOTICE`, using Twitch's `system-msg` text.
- Twitch channel-point redemptions: text redemptions arrive as IRC `PRIVMSG` with `custom-reward-id` (titles from the channel's public reward list); text-free redemptions arrive as `reward-redeemed` on the signed-in popout's hermes socket (`desktop/stream-events.mjs`).
- Kick: `KicksGifted` on the page's realtime socket. Kick subs and reward redemptions are not captured yet.
- YouTube: Super Chats, Super Stickers, memberships and gift-membership announcements are tagged in `network-chat.mjs`.
Twitch follows and TikTok events are not captured yet.

