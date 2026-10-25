# Handoff: where Bubblecast is and how to keep building it

For any coding agent (Codex, Claude) or person picking up this repo. Read `AGENTS.md` (the rules) and `DEVELOPMENT.md` (the architecture) first. This file covers the current state, the next tasks, and lessons from recent work. Update it when those change.

State as of 2026-10-25: v1.33.2 is the latest published release (Windows installer on GitHub Releases, in-app updates). On the owner's 2026-10-24 Windows stream, four bugs were still present. They are listed below with what was already tried. Fix them one branch and PR at a time, in the order given.

## Diagnostics prerequisite — helper 1.33.3 (2026-10-25)

- Merged in [PR #65](https://github.com/alexmario64/bubblecast/pull/65), branch `feature/platform-diagnostics`, updated with `main` after handoff PR #64 merged. Studio → Overview now has a Diagnostics card: capture/session state, route, received/shown counts, last message time, OBS main/Aitum detection and its path, YouTube slots, latest API/page discovery outcome and trigger, live-page connections and latest reported paint.
- The server writes `.local/diagnostics.log` under the data folder: `%APPDATA%\Bubblecast\.local\diagnostics.log` for an installed Windows app. JSON lines record changes (sampled every 5 s) and minute summaries. Rotation keeps at most 1 MiB plus one 1 MiB `.1` backup. Write failures appear in Studio and recover when storage is available.
- Log fields are explicitly allowed enums, booleans, counts, times and version numbers. No chat text, names, IDs, page URLs/titles, raw errors, credentials, cookies or stream keys. Each server start writes a fresh status entry; old log files survive restarts and updates.
- OBS WebSocket and browser reports are shown separately from missing detection. Aitum's missing/unsupported status reply is unknown, rather than idle. YouTube reports check start/end/outcome without adding requests. Capture, discovery, chat reload and quota behavior have not been changed in this prerequisite.
- **Audit for fix 1 below:** despite older wording saying “never on a timer”, `YouTubeOfficial.findLive()` still reschedules at 90–110 s while live. Replace that discovery timer with the requested bounded stream-start checks in the next PR; diagnostics does not fix it.
- All three helper version locations are **1.33.3**. Tests cover log privacy, rotation, failure recovery, detection freshness, API outcomes, Studio status and Spanish. `pnpm screenshots --offline studio-overview studio-diagnostics` uses synthetic data and serves checkout assets through Playwright routes, contacting neither the running helper nor live sites. Local full suite: **403 passed, 0 failed, 3 skipped** (the running helper owns port 3927, so the isolated server test is skipped locally; Windows CI runs it). Seven offline screenshots passed with no page errors and were visually reviewed in all four themes, at phone width and in Spanish. The initial Windows CI passed **406 tests, 0 failed, 0 skipped**, including the installed-server test; the Windows installer build also passed. Pulling in the documentation merge triggers fresh checks, so verify the latest PR head before merging.
- PR #65 is merged; Windows deployment/restart remains unconfirmed. Restart the Windows helper and refresh the Studio/OBS sources after deploying. The running macOS helper has been left running; no live platform window was inspected or automated. No Windows stream validation is claimed.
- Next: YouTube PR #66 and TikTok PR #67 are merged. Complete overlay recovery below, then stream-key matching on its own branch after the owner merge and a `main` pull with `--ff-only`. Real Windows stream validation remains pending for all four bugs.

## Open bugs (seen live on Windows, 2026-10-24, v1.33.2)

No logs from that stream were collected. Diagnostics are implemented in the prerequisite above, awaiting deployment. Use Studio and the rolling log to check each fix on Windows without live-site scripting.

### 1. YouTube automatic discovery and no-app reading — implemented for helper 1.33.4, awaiting Windows stream validation

- Merged in [PR #66](https://github.com/alexmario64/bubblecast/pull/66), branch `fix/youtube-bounded-discovery`, based on `main` after diagnostics PR #65 merged. All three helper version locations are **1.33.4**.
- Each main-output or Aitum start schedules checks at +20, +60, +120 and +240 seconds from detection. Expected slots follow the active outputs; a later Aitum start is a separate edge. Checks stop when those slots have current live/receiving results or all attempts finish. Existing ready/scheduled API placeholders and previous-stream results cannot end a fresh series early. Repeated OBS status reports and offline recording never restart discovery. `findLive()` is single-flight, discards stopped results and has no recurring discovery timer. Known chat/viewer metadata still refreshes while live, with the existing two-minute stop grace.
- The owner's clarified no-app requirement is included: without a configured Google app, the helper discovers streams from the channel and reads native page chat anonymously. Page fallback also handles exhausted quota. A configured app awaiting sign-in does not silently switch to pages. Quota exhaustion keeps known slots and URLs so existing chat windows continue into page capture. Adding Shorts preserves the main API reader.
- Channel pages are now disposable discovery probes, never chat capture windows. A Streams-tab live badge is not discarded just because `videoDetails.isLive` is absent from watch metadata; missing metadata is unknown, explicit ended metadata is false. Renderer and lockup badge variants have synthetic fixtures. Existing chats are retained until a watch probe confirms they ended. Probe deadlines, request IDs, expiry and channel matching reject late results; chat windows are never reloaded by discovery.
- Studio shows the required no-app channel field in the YouTube card, with Find live streams for an explicit single check. Both Connections and Overview show bounded-check state, attempt count, next check and missing channel/helper/sign-in conditions; OBS/Aitum detection remains visible in Diagnostics. New text has Spanish translations.
- Tests exercise the real server on an OS-assigned local port with external HTTP and sockets disabled, so they run alongside the owner's helper. Synthetic no-app discovery creates both chat URLs and relays a new native message into dock history, preserving history suppression. A mocked quota failure proves the same URLs continue into page reading without a reload/discovery command. Unit/browser fixtures also cover exact deadlines, stop/restart edges, metadata variants, stale results and retained readers. Local full suite: **427 passed, 0 failed, 2 Windows-only skips**. Ten isolated screenshots passed, covering diagnostics in all themes and no-app Connections at desktop/phone widths and in Spanish. Additional regressions cover stalled/overlapping checks, cancellation/restart, previous-stream confirmations, duplicate/malformed listings, hung probes, late results after channel/disconnect/expiry, API permission failures, and duplicate native GIF messages retaining one stable row. The duplicate-listing test caught and fixed a case where duplicate IDs consumed both discovery slots. Windows CI passed **429 tests, 0 failed, 0 skipped** and the Windows installer build passed at the merged head.
- No live platform was contacted, inspected or automated during development. The page readers remain unverified against a real current YouTube stream. After merge, deploy/restart on Windows, refresh Studio and affected OBS sources, then check diagnostics/logs on the owner's stream. Ask before any real-window inspection. If no Google app is used, save the channel and check that both discovery and incoming chat work.

### 2. TikTok hidden startup/session — implemented for helper 1.33.5, awaiting Windows stream validation

- Merged in [PR #67](https://github.com/alexmario64/bubblecast/pull/67), branch `fix/tiktok-hidden-startup`, based on `main` after YouTube PR #66 merged. All three helper version locations are **1.33.5**.
- Source windows explicitly enable `paintWhenInitiallyHidden`. After the first TikTok page load, the helper places the muted window beyond all connected displays, disables focus/taskbar presence, calls `showInactive()` once, then hides it after 300 ms and restores its original bounds. Manage cancels pending cleanup before showing the window; a late timer cannot hide a user-opened window. Repeated loads do not repeat activation. Destruction/disconnect and activation failures are handled without automatic retries or page navigation.
- A bounded, single-flight cookie metadata check runs before loading the room and independently of renderer inspections on subsequent heartbeats. Missing, empty or expired session cookies show **Sign in to TikTok** in Studio; query failures/timeouts remain unknown. A hung native-baseline or composer inspection cannot conceal a known missing session. Cookie values are never retained in source state or status/log reports. Public anonymous reading is still allowed.
- Found and removed two remaining automatic TikTok reload paths when sign-in or child sign-in windows close. The room, capture receiver and startup-history baseline stay intact; session metadata updates on the next heartbeat. Kick's existing sign-in synchronization is unchanged. Manual Troubleshooting refresh remains an explicit user action.
- Diagnostics and the rotating log include only an allowed startup enum (painting, painted, failed, user-opened or not-started), alongside session/traffic states. Startup failure appears as an error. Receiving anonymous chat remains Receiving chat with a separate sign-in prompt. English and Spanish Studio text is covered.
- Added **21 regression tests** across actual helper orchestration with inert native windows, startup/session unit tests, Studio DOM fixtures, diagnostics, and an isolated real local server with external HTTP/sockets disabled. Coverage includes off-screen placement across displays, no focus/reloads, Manage during activation, unchanged-room reuse, disconnect/destruction, activation failure, expired/empty/lookalike-domain cookies, deletion/sign-in recovery, hung cookie/renderer single-flight behavior, metadata privacy and anonymous chat reaching dock history. Existing native message-ID, GIF, baseline and dedupe regressions also pass.
- Local `pnpm test`: **448 passed, 0 failed, 2 Windows-only skips** (450 total). Five isolated Studio screenshots cover Connections at desktop/phone widths, Diagnostics, and Spanish. Screenshot review caught a partly untranslated status; its complete Spanish text now has a regression assertion. Both Windows test runs passed **450 tests, 0 failed, 0 skipped**, and the Windows installer build passed at the merged head.
- **Deployment/live validation pending:** no live platform was contacted or inspected and the running macOS helper was left untouched. Fixtures verify orchestration, not real Windows painting or current TikTok compatibility. After merge/deployment, restart the Windows helper and refresh Studio/affected OBS sources. Start the stream without Manage: Diagnostics should report Hidden window started, then increasing received/shown counts. Check missing-session prompts with the owner; ask before real-window inspection. Next: overlay heartbeat/recovery on its own branch after this PR is merged.

### 3. Overlay restart recovery — implemented for helper 1.33.6, awaiting Windows OBS validation

- Branch `fix/overlay-recovery`, based on `main` after TikTok PR #67 merged. All three helper version locations are **1.33.6**.
- The local server sends an observable heartbeat event on connect and every 15 seconds, replacing comment-only keepalives. `public/event-stream.js` supplies one shared transport for chat (including vertical/webcam), TTS and poll overlays. It recreates closed/error connections, or a connection with no heartbeat for 45 seconds, using one pending retry and 1/2/4/8/10-second backoff. A healthy 45-second connection resets the backoff. It fetches current settings on each open; late GETs and events from older connections cannot overwrite newer state.
- After five consecutive failures, a successful local settings probe permits one page reload per two minutes. An unavailable server is retried without navigating the OBS source into an offline page. If session storage cannot persist the cooldown, recovery keeps reconnecting instead of risking reload loops. Page teardown closes the stream and cancels retry/watchdog/settings work. Existing chat nodes, media, TTS playback and poll snapshots survive normal reconnection; reconnecting never replays old TTS or chat history.
- **Owner's bot/shadow-ban constraint:** recovery contacts only the existing same-origin `/api/events` and `/api/settings` endpoints on the streamer's computer. It does not queue collector commands, platform discovery or account actions, or reload any live platform window. YouTube API-first/bounded discovery and official single-action sending/poll policies are unchanged. Platform bot classification cannot be guaranteed; do not add live-platform retry/automation traffic as a recovery mechanism.
- Added **17 regression tests** (including two nested HTTP cases): deterministic transport tests for silent/closed streams, exact heartbeat deadlines, backoff, safe reload/cooldown, storage/constructor failures, stale settings, handler dedupe, aborts and teardown; real Chromium tests for all three pages against an isolated real Bubblecast server, observing periodic heartbeat, killing/restarting the server on the same random port, refreshing settings, restoring persisted polls and receiving new chat/TTS/poll updates without a page/cache refresh. HTTP 204 and 403 tests prove each page recreates a permanently closed EventSource. Browser requests and the server fixture's external network are blocked outside loopback; synthetic TTS uses inert audio, and no real account actions are run.
- Windows CI now installs Playwright Chromium so the real browser regressions run under `pnpm test` on Windows. Local full suite: **465 passed, 0 failed, 2 Windows-only skips** (467 total). Three offline screenshots cover chat and live/final poll overlays; styles and transparent backgrounds are unchanged. Windows test and installer CI results are recorded on the PR; verify its latest head before merge.
- **Deployment/OBS validation pending:** the running macOS helper and live platform windows remain untouched. After merge/deployment, restart the Windows helper/server and refresh the affected OBS browser sources once to load this recovery code. Then restart Bubblecast with the overlays open and verify new chat, TTS, polls and changed settings resume without Refresh cache. Next: Shorts/main stream-key matching, on its own branch after this PR is merged.

### 4. Shorts (vertical) live vs normal live mixed up

What exists now:
- With the API, the format is not known (`pickBroadcasts`: "Format isn't knowable from the API"). `assignSlots` puts the first live stream in the horizontal slot unless the streamer saved a choice.
- Without the API, the watch page's `adaptiveFormats` aspect ratio is used. That data may be missing on live streams.
- A single stream counts as vertical only while Aitum alone is streaming.

Fix: match stream keys.
- OBS WebSocket `GetStreamServiceSettings` gives the main output's key. The Aitum Vertical vendor request (check which requests it supports) or its config file gives the vertical key.
- With the API, `liveStreams` (part `cdn`) gives `cdn.ingestionInfo.streamName` for each `boundStreamId`. Equal to the OBS key means horizontal; equal to the Aitum key means vertical.
- Without the API, use the order in which OBS and Aitum started streaming as a tiebreak, plus the aspect ratio when it is available.
- Remember the result per stream key in `youtube-streams.json`, as manual choices are now.
- Never send stream keys anywhere or log them.

## What was done in this round (for context)

- **v1.33.0–1.33.2:**
  - TikTok pages are never reloaded.
  - YouTube moves to a new chat only when the old stream ended.
  - YouTube is checked once per stream start, API first, never on a timer, and no quota is spent just because OBS is open or recording offline.
  - The no-API fallback reads the Streams tab and fills both slots.
  - Aitum counts only while `streaming===true`.
  - Twitch token refresh is single-flight, and only a 400 or 401 response forgets the token.
  - A Lua script in the current OBS scene collection starts Bubblecast when OBS opens (`addObsLauncher` in `obs-dock.mjs`).
- **Earlier:** Windows installer and updater; text to speech with Twitch reward cooldown sync; Classic and Modern chat styles; themed dropdowns; the setup guide; the website.

The older notes below are history.

## Historical PRs and checkout at earlier handoff

- [#23 — Document streamer app setup and future Kick permissions](https://github.com/alexmario64/bubblecast/pull/23): merged. Google project quota isolation, secret replacement, the observed Kick app form, current permissions versus future features, and local credential setup.
- [#24 — Connect own channels automatically and unify Kick sign-in](https://github.com/alexmario64/bubblecast/pull/24), branch `feature/own-channel-connections`: the implementation and UI changes below, including helper **1.24.0**. Open and pushed; latest functional commit `d370efe` passed Windows CI. Latest local full suite: **337 passed, 0 failed**. Connection screenshots were reviewed using offline fixtures, including the final text/button alignment. The final documentation-only handoff commit will trigger fresh CI; check the latest PR checks before merging.
- The active checkout is `feature/own-channel-connections`. At the wrap-up audit, the working tree was clean, all local branches had upstreams, and none was ahead of its upstream. `cleanup/youtube-api-only` is behind its upstream by two commits; it has no unpushed work. Only this checkout exists as a Git worktree.
- #24 was updated with `main` after #23 merged; the handoff conflict was resolved keeping both PRs' content. The owner merges; no merge was performed here. After a merge, return to `main` and `git pull --ff-only` before beginning another branch.
- The owner requested wrap-up only, no new task. The only final change is this handoff update. Implementation is committed; real platform validation is pending, not completed by the fixtures.

## How work is done here

1. Start on `main` with a clean tree: `git checkout main && git pull --ff-only`.
2. Create one branch per change: `feature/<name>`, `fix/<name>`, `cleanup/<name>`, `docs/<name>` or `release/<version>`.
3. Make the change, then run `pnpm test`. Every behavior change needs tests. Browser fixtures go in `test/browser` (happy-dom).
4. Commit with a plain message: a short summary line, then a short body explaining why. No `Co-Authored-By` lines and no "Generated with" footers.
5. Push and open the PR with `gh pr create --base main`. The description says what changed, what was kept, what isn't verified live, and the `pnpm test` count.
6. The owner merges. Don't merge PRs yourself unless the owner says to in that conversation. After a merge, return to `main` and `git pull --ff-only` before starting the next branch.
7. The Windows CI workflow (`.github/workflows/test.yml`) must pass on every PR.

Lessons from this session:

- **Don't stack PRs on other PR branches.** #17 targeted #16's branch, merged after #16, and never reached `main`; it had to be reopened as #18. Base every PR on `main`. If a change truly depends on an open PR, branch from it but still target `main`, and say "includes #N's commit until that merges" in the description.
- **The code is dense, mostly one statement per line.** Make exact-string replacements and check that each one matched exactly once. Then run `node --check <file>` and `pnpm test`. Watch for `if/else if/else` chains: inserting a statement between them reattaches the `else` (this caused a Studio bug that the tests caught).
- **Studio tests strip `import` lines** from `public/app.js` before evaluating it (`test/browser/studio.test.mjs`). Shared page helpers are therefore classic scripts exposing a `window` global, like `public/i18n.js` → `window.bubblecastI18n`, called with `?.`.
- **New static files** must be added to the `files` map in `server.mjs`, or the server won't serve them.
- **New visible UI text needs a Spanish entry** in `public/i18n.js`. `test/browser/i18n.test.mjs` fails otherwise.
- **Never contact live platform sites from scripts**, including api.kick.com and Google APIs. Read docs from GitHub mirrors instead (Kick's docs are at github.com/KickEngineering/KickDevDocs). Live behavior is checked only by the owner, in a real signed-in session.
- **Don't retry a send, poll start or poll end automatically when its result is unknown.** Report it as `unknown`.

## What the app is now

- **Twitch:** official API (Device Code sign-in, Helix, EventSub) plus Twitch's official IRC chat. The helper never opens Twitch.
- **YouTube:** official API on the streamer's own Google app (`.local/app-keys.json`), giving each install its own 10,000-unit daily quota.
  - Chat is read from `liveChat/messages/stream`. Sending and polls also use the API.
  - With both stream links empty, `liveBroadcasts.list` finds the channel's live streams, and upcoming ones that OBS is sending to, are ready, or start within 12 hours, about every 90–110 s. They fill two slots named by stream title; a stream only goes to the vertical (Shorts) slot when the streamer marks its stream key Vertical in Studio → Connections, where streams can also be hidden.
  - The helper's signed-out YouTube page is kept only to add member badges, Super Sticker images and member-only emojis to API messages (`youtube-merge.mjs`). It never adds rows or polls.
  - Standard emoji characters become YouTube's Noto images. `scripts/import-youtube-emojis.mjs` imports custom emojis from a saved live_chat page.
- **Kick:** sending chat, live status and viewer count go through the official API on the streamer's own Kick app (`kick-official.mjs`, OAuth 2.1 with PKCE, redirect `http://localhost:3927/oauth/kick/callback`). Chat and events are still read from Kick's public chat socket in the helper, because the API only offers webhooks and there's no server. Kick polls still run in the signed-in Kick page, because there's no poll API.
- **TikTok:** unchanged and read-only through the helper. The owner wants it left as is.
- **Language:** English and Spanish for Studio and the dock, one shared `language` setting.
- **Setup guide for streamers:** `docs/own-apps.md`.

## Next tasks, in order

1. **Verify and deploy helper 1.24.0 from PR #24.** After merge, pull and restart the helper. Verify the shared-session Kick flow with the owner, including whether OAuth reuses the page login without a second credentials prompt. Pull/restart on Windows and refresh OBS sources when deploying there.
2. **Verify Kick against a real sign-in.** The field names in `kick-official.mjs` come from Kick's docs and haven't been confirmed live: `data[0].user_id`, `name`, `broadcaster_user_id`, `stream.is_live`, `stream.viewer_count`, and `data.is_sent` on `POST /public/v1/chat`. Ask the owner for the error text if Connect Kick, the viewer count or sending fails, and adjust the code and tests.
3. **Windows installer: built in PR #34 (helper 1.25.0), not yet tried on a real PC.** `pnpm dist:win` / the Windows installer workflow builds `Bubblecast-Setup-<version>.exe` (electron-builder, per-user NSIS, `build` key in package.json); `v<version>` tags attach it to a release. Installed copies keep data in `%APPDATA%\Bubblecast` via `BUBBLECAST_DATA`. First launch starts with Windows, adds the dock with `obs-dock.mjs` (ExtraBrowserDocks in `user.ini`, or `global.ini` before OBS 31, only while OBS is closed) and opens Studio. Still to confirm on the owner's Windows PC: the install, the dock appearing in OBS, start-with-Windows, and uninstall. The installer is unsigned (SmartScreen warns), and releases of a private repo are only downloadable by collaborators.
   - Releases so far: 1.25.0 installer, 1.25.1 saving fix and uninstall, 1.25.2 YouTube reads only while OBS is live (overlays and dock report `window.obsstudio` streaming state to `/api/obs/streaming`), 1.25.3 helper starts its own server when another copy closes.
   - 1.26.0: Studio's setup guide (`public/setup-guide.js`/`.css`). Chapters for Twitch, YouTube, Kick, TikTok and OBS with drawn, animated pictures of each screen; final steps press Studio's own controls. Opens on first launch when nothing is connected. Studio no longer links to GitHub. The pictures are drawings, not screenshots, because live platform sites must not be scripted; check them against the real Google Cloud and Kick screens when the owner next sets up.
   - 1.27.0: overlay chat style setting (`chatStyle`: `bubbles` or `classic`, a one-line Twitch-style chat with logo, badges, colored name and outlined text), and dock Studio links open the background app's Studio window when the dock runs inside OBS (OBS pop-up windows did not stay in sync).
   - 1.28.0: in-app updates (Studio banner and Quick actions version row; the installed app downloads the release installer, checks its SHA-256 and installs silently). The first real update through it will be 1.28.0 → the next release; check it on Windows then.
   - 1.29.0: text to speech (`tts.mjs`, Studio → Text to speech, `/tts` browser source). Roles for the command come from each platform via `viewerRoles()`; YouTube now carries owner/moderator/member roles and Twitch IRC carries badge-tag roles. A Windows-only test runs the real Windows voice in CI. Not yet heard on the owner's Windows PC.
4. **Spanish for the stream overlays:** the event lines (subs, raids, gifts) from `eventLabels` in `core.mjs` and `public/overlay.js`.
5. **Cleanups to check first:**
   - `extension/` (the older Chrome bridge) still captures YouTube and Twitch pages. The helper reuses `extension/capture.js` and `extension/tiktok.js`, so don't delete those blindly.
   - `desktop/main.cjs` still has a Twitch entry in the sign-in URL map.
   - YouTube shows at most two streams at once, because there are only two slots.

## Implemented in PR #24

- Blank Twitch/Kick channel fields use the connected account's channel. Explicit saved channel fields remain overrides. Kick discovers its slug using the authenticated user ID and remembers it locally; it does not guess from a display name. YouTube's existing two-stream discovery also works before the first source-form save.
- Runtime account defaults stay separate from editable and saved overrides. Switching accounts follows the new default. Disconnect all remains respected, and late Kick lookups cannot reactivate disabled sources.
- Studio and dock connections put account controls first. TikTok keeps its required handle field in the main setup. Twitch/YouTube/Kick manual fields are below in a collapsed **Optional channel overrides** section.
- Kick has one connection entry point in Studio and the dock. The server queues `kick-connect` only for an active helper advertising support. `desktop/kick-connect.cjs` guides Kick page login and then official OAuth in the same `persist:bubblecast-kick` session. It permits only the exact local callback with that attempt's state, cleans up on expiry/closure, and does not copy or log cookie values. The separate poll sign-in button is removed.
- Polls still use the existing signed-in Kick page and shared poll helpers. The official GitHub API index, scopes and changelog were checked on 2026-10-22; no documented public poll endpoint/scope was found. This is not a new poll API, and an API token is not a website session cookie. Sending remains on the official API. Unknown sends and poll actions are never automatically retried.
- Both package versions and all four helper version reports in `desktop/main.cjs` are **1.24.0**. `DEVELOPMENT.md` and the setup guide describe the new flow. The updated helper has not been restarted or deployed during this work.
- Product copy is short and focused on connecting accounts. The dock no longer shows the technical API/session explanation or the “Connections and poll sign-in” label. Kick never uses the misleading “Read-only chat” fallback; Studio shows connection/poll status, while the dock uses the same Connected as / Not connected status style as the other platforms.
- Dock rows have matching Connect / Manage controls, a fixed 100px action column, matching control heights, and separate platform/status columns so all text starts align. Kick Manage opens Studio; Connect starts the unified helper flow. Reload Kick chat / Reload TikTok chat are under collapsed **Troubleshooting**, only for configured sources, and run only when clicked.
- New visible copy has Spanish entries. No platform messages or polls were posted during development. No account secrets, sessions or personal configuration were committed. Ad hoc screenshot scripts and images remain ignored in `.local/`; they are not development-source copies and are not required by the app.

## Unverified and waiting on the owner

- **Kick single credential entry is not proven.** The shared-session flow has mocked sequencing, callback and cancellation tests, but no real Kick login was opened. Verify that Kick accepts OAuth in Electron and reuses the page login without a second credentials prompt. If it does not, record the error and reassess before claiming the user's one-login goal is achieved.
- **Kick API and native polls:** connected identity, automatic own-channel discovery, live/offline state, viewer counts, sending and native poll create/end remain unverified live. Field assumptions include `data[0].user_id`, `name`, `broadcaster_user_id`, `slug`, `stream.is_live`, `stream.viewer_count` and `data.is_sent`. Fixture tests do not establish live compatibility. Any send/poll check must be an action the owner actually intends; never invent test chat or polls, and never retry an unknown result.
- **Permission for live inspection is still pending.** Before further UI cleanup, the previous agent asked whether it could restart the helper and inspect the real Kick window. The owner did not approve; subsequent messages only steered UI changes. Ask before live helper inspection as AGENTS.md requires. No automated browser/script requests to live platform sites.
- **Google:** replacement of the exposed old secret (in history at `18c9bc7`) and successful YouTube authorization remain unconfirmed. Each streamer uses their own Google project/client and Kick app. Do not save actual keys in docs or Git.
- **Kick app setup:** the owner created the app and reported pasting the client ID and secret on macOS. Whether Save/Connect completed successfully has not been confirmed. Do not recreate or replace the app without evidence it is necessary.
- **Deployment:** helper 1.24.0 restart on macOS, Windows pull/restart and affected OBS source refreshes are unconfirmed. macOS is for development; Windows remains the streaming target. The Windows installer from PR #34 has not been run on Windows yet.

## What was about to happen next

The next functional step was an owner-approved real-session check of the new Kick connection flow after restarting helper 1.24.0, followed by the outstanding Kick identity/viewer/send/poll checks. That check was not started. PR review/owner merges and any documentation conflict resolution remain pending. After those, the existing prioritized backlog above still applies: Windows installer, overlay Spanish, then carefully scoped cleanups. Do not begin those as part of this wrap-up; the owner asked to hand the repo back and stop.

## Setup guide and future Kick scope

- `docs/own-apps.md` records the developer form, required description, exact callback, current scopes, local credential setup, secret replacement and connection checks. Each streamer creates their own Google project/client (quota is per project) and Kick app. Kick OAuth supports user authorization; using individual apps is our local deployment choice, not a platform restriction to the creator.
- The owner wants future Kick parity: title/channel updates, subscription/gift events, reward management and moderation. The guide separates these future permissions from the three scopes currently requested. No runtime scope changes have been made. Stream-key access is unnecessary unless OBS streaming configuration becomes a feature.
- Event delivery still needs a solution compatible with no hosted server. Native follows remain outside the current bot-based policy. Do not treat these proposed features as implemented or live-verified.
- The old Google secret replacement and Google connection remain unconfirmed. Never save actual keys, secrets or account sessions in this guide or Git.
