# Developing Bubblecast

Canonical repository: https://github.com/alexmario64/bubblecast. All development uses a Git-connected clone of it; exported ZIPs and older workspace copies are not development sources. Read AGENTS.md for the project rules.

## Setup

### Windows (streaming PC)

1. Install Git and Node.js 22 or newer. Sign in to GitHub with the account that owns this private repository.
2. Clone the repository, then run `npm install --global pnpm@11.25.0` and `pnpm install --frozen-lockfile --ignore-scripts`.
3. Run `pnpm test` to check the checkout.
4. Run `pnpm install:background` (or double-click Install Background App.cmd). It downloads the official Electron runtime and verifies its checksum.
5. Run Start Bubblecast Background.vbs, open http://127.0.0.1:3927 and enter your channels. Sign in to platforms when you need to send chat or run polls.
6. Install Komika Axis for this Windows account if you use it as the overlay font (it is not bundled).
7. In OBS, add http://127.0.0.1:3927/dock as a Custom Browser Dock, and /overlay and /poll-overlay as Browser sources at your canvas size (3840 × 2160 for 4K). Studio → OBS setup lists every URL.
8. For automatic startup with OBS, add Bubblecast OBS.lua in OBS Tools → Scripts and point it at this checkout's Start Bubblecast Background.vbs.

Browser sign-ins, recent chat, the helper runtime and personal settings live in `.local/`, `settings.json` and `sources.json`. They are never synchronized through Git and must not be copied between machines.

### macOS (development only)

Streaming and OBS stay on Windows. On a Mac: install Node.js 22+ and pnpm as above, then `pnpm test`, `pnpm start` (server) and optionally `pnpm install:background` + `pnpm start:background` (helper; quit it from the menu bar icon). Komika Axis is found in `~/Library/Fonts` or `/Library/Fonts`. The `.cmd`, `.vbs` and OBS Lua launchers are Windows-only.

## Workflow

1. `git checkout main && git pull --ff-only`, then create a branch (`feature/…` or `fix/…`).
2. Make changes, run `pnpm test`, and for UI changes `pnpm screenshots` (below).
3. Push the branch and open a pull request into `main`. Nothing is committed or pushed directly to `main`, and commits and PRs carry no AI attribution.
4. Merge after the Windows test check (GitHub Actions) passes.
5. On the streaming PC: `git pull --ff-only`, restart the background helper if `desktop/` changed, and refresh affected OBS sources.

### Visual checks

Run `pnpm exec playwright install chromium` once per machine. `pnpm screenshots` then captures every Studio page in all four themes and at phone width, the dock states and every overlay state into `.local/screenshots/` (ignored by Git). Pass name filters to capture a subset (`pnpm screenshots polls dock`). The run fails if a page throws or a request errors. It reuses the server on port 3927 or starts one, and themes are applied in the page only, so no settings are written.

Never point automated browsers or scripts at live platform sites (Twitch, YouTube, Kick, TikTok, Google). Repeated scripted traffic from one IP triggers their bot protection. Research live behavior through the helper's real windows at a normal pace.

## Architecture

- `server.mjs`: local HTTP/SSE server on 127.0.0.1:3927: settings, sources, relay, poll jobs and the authenticated helper command queue. Static files are served from an explicit allowlist.
- `core.mjs`: settings validation and defaults, message normalization, bots, stream event model, viewer colors and theme helpers. Shared by the server and the pages.
- `relay.mjs`, `dock-history.mjs`, `outbox.mjs`: message relay and dedupe, recent dock history, outgoing chat jobs.
- `polls.mjs`, `poll-jobs.mjs`: normalized poll state and idempotent poll create/end jobs.
- `twitch-live.mjs`: anonymous Twitch IRC reader (chat, subs, raids, redemptions). `network-chat.mjs`: YouTube and TikTok network parsing.
- `desktop/`: the Electron helper. `main.cjs` keeps a persistent signed-in window per platform; `network-capture.mjs` reads each page's traffic; `chat-composer.mjs`, `native-poll.mjs`, `end-poll.mjs` and `shared-poll.mjs` perform signed-in actions; `viewer-probe.mjs` reads live viewer counts; `stream-events.mjs` parses event-socket frames.
- `public/`: Studio (`index.html`, `app.js`, `style.css`), the dock (`dock.*`, `dock-layout.mjs`, `poll-board.mjs`, `poll-compose.mjs`), overlays (`overlay.*`, `poll-overlay*`), and `theme.css` with the shared theme tokens.
- `extension/`: the older Chrome-extension capture bridge, kept as an alternative to the helper.
- `test/`: unit tests; `test/browser/`: DOM fixtures with happy-dom. Fixtures do not prove live platform compatibility. `pnpm test:relay` is a live local integration check that may display synthetic overlay messages.

## Behavior reference

**Studio** (`/`): sidebar pages addressed by hash (`/#polls`): Overview (setup checklist, live viewers, channels, quick actions), Connections, Appearance, Chat overlay, Poll overlay, Chat dock and OBS setup. Appearance and overlay changes preview instantly and save automatically; connections save explicitly because saving reloads sources. Confirmations are brief toasts; failures stay until dismissed, and a banner appears only while the background app is offline.

**Themes and brand**: interface themes are rose, red, midnight and white. All colors, including status colors, come from `public/theme.css`, shared by Studio and the dock. `uiTheme` is the app theme; `dockTheme` is `app` (match) or its own theme. The logo is the bubble trio (`public/logo-glyph.svg`) on a theme tile (`--logo-tile`); `public/favicon.svg` and `logos/tray*.png`, `logos/icon-256.png` are the full icon for tabs and the helper.

**Overlay font**: `fontFamily` accepts any installed font (Komika Axis by default) and is validated so it cannot inject CSS.

**Bots**: built-in bots (`knownBots`) plus the user's own (`ignoredBots`). Stream overlays hide bots unless listed in `overlayShownBots` (`filterBots` off shows all). The dock shows bots unless listed in `dockHiddenBots`. The relay always keeps bot messages. Follow alerts come from the streamer's own bots, not native capture.

**Stream events**: chat messages with an `event` field (`eventKinds`). Overlays show the kinds in `eventsShown` (all but follows by default); the relay and dock keep every event. Sources (verified against real traffic): Twitch IRC `USERNOTICE` for subs, resubs, gifted subs, gift bombs (individual gifts collapsed), raids and watch streaks; Twitch redemptions with text via IRC `custom-reward-id` (titles from the public reward list) and without text via `reward-redeemed` on the signed-in popout's event socket; Kick `KicksGifted`; YouTube Super Chats, stickers, memberships and gift memberships. Kick subs and redemptions and TikTok events are not captured yet.

**Live viewers**: the helper runs `viewer-probe.mjs` inside each open platform page and reports `{live, viewers}`. Twitch GraphQL `viewersCount`, YouTube `updated_metadata` view-count entity ("watching now" means live, lifetime views mean ended), Kick `livestream.viewer_count`, TikTok `liveRoomStats.userCount` (live counts unverified). These are undocumented read-only endpoints and can change.

**Polls**: the poll pane opens beside any chat view (stacked on narrow docks) without replacing chat iframe sessions. Combined totals sum known answer counts; percentage-only sources are labeled separately. YouTube Live and Shorts are separate destinations. Final results stay in the dock for five minutes and on the stream overlay for `pollResultSeconds` (15 s by default). YouTube ending is confirmed from an explicit ended state or stable disappearance from the loaded chat. Poll overlay styling uses the `poll*` settings in `core.mjs`.
