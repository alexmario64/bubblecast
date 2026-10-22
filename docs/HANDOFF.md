# Handoff: where Bubblecast is and how to keep building it

For any coding agent (Codex, Claude) or person picking up this repo. Read `AGENTS.md` (the rules) and `DEVELOPMENT.md` (the architecture) first. This file covers the current state, the next tasks, and lessons from recent work. Update it when those change.

State as of 2026-10-22: release 1.23.0 merged in #22. Open PR #24 prepares helper 1.24.0 with automatic account channels, connections-first layout and a single shared-session Kick connection flow. After its merge, return to main and pull; restart the updated helper and refresh Studio, the dock and affected OBS sources. The owner is developing on macOS; Windows deployment remains unconfirmed.

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
  - With both stream links empty, `liveBroadcasts.list` finds the channel's live streams about every 90–110 s and fills two slots (YouTube and Shorts).
  - The helper's signed-out YouTube page is kept only to add member badges, Super Sticker images and member-only emojis to API messages (`youtube-merge.mjs`). It never adds rows or polls.
  - Standard emoji characters become YouTube's Noto images. `scripts/import-youtube-emojis.mjs` imports custom emojis from a saved live_chat page.
- **Kick:** sending chat, live status and viewer count go through the official API on the streamer's own Kick app (`kick-official.mjs`, OAuth 2.1 with PKCE, redirect `http://localhost:3927/oauth/kick/callback`). Chat and events are still read from Kick's public chat socket in the helper, because the API only offers webhooks and there's no server. Kick polls still run in the signed-in Kick page, because there's no poll API.
- **TikTok:** unchanged and read-only through the helper. The owner wants it left as is.
- **Language:** English and Spanish for Studio and the dock, one shared `language` setting.
- **Setup guide for streamers:** `docs/own-apps.md`.

## Next tasks, in order

1. **Verify and deploy helper 1.24.0 from PR #24.** After merge, pull and restart the helper. Verify the shared-session Kick flow with the owner, including whether OAuth reuses the page login without a second credentials prompt. Pull/restart on Windows and refresh OBS sources when deploying there.
2. **Verify Kick against a real sign-in.** The field names in `kick-official.mjs` come from Kick's docs and haven't been confirmed live: `data[0].user_id`, `name`, `broadcaster_user_id`, `stream.is_live`, `stream.viewer_count`, and `data.is_sent` on `POST /public/v1/chat`. Ask the owner for the error text if Connect Kick, the viewer count or sending fails, and adjust the code and tests.
3. **One-click Windows installer (the owner's main goal).** A `.exe` that:
   - installs Bubblecast and the background helper,
   - starts the helper with Windows,
   - adds the dock to OBS,
   - creates a Start menu or desktop shortcut that opens Studio.

   Existing pieces: `desktop/install.mjs` (downloads and verifies Electron), `Install Background App.cmd`, `Start Bubblecast Background.vbs`, `Start Bubblecast.cmd`, `Install OBS Themes.cmd`, and `obs.mjs` `setupObs` (adds the overlay through OBS WebSocket). OBS custom browser docks live in the OBS profile's `basic.ini` / `user.ini` (DockState and ExtraBrowserDocks). Confirm the exact keys on the owner's OBS version before writing them. No servers, and no PHP.
4. **Spanish for the stream overlays:** the event lines (subs, raids, gifts) from `eventLabels` in `core.mjs` and `public/overlay.js`.
5. **Cleanups to check first:**
   - `extension/` (the older Chrome bridge) still captures YouTube and Twitch pages. The helper reuses `extension/capture.js` and `extension/tiktok.js`, so don't delete those blindly.
   - `desktop/main.cjs` still has a Twitch entry in the sign-in URL map.
   - YouTube shows at most two streams at once, because there are only two slots.

## Waiting on the owner

- Give the old Google client a new secret. The previous one is in git history (commit 18c9bc7). Then paste the client ID and new secret in Studio → Connections → Your Google app, and click Connect YouTube.
- Create the Kick app (see `docs/own-apps.md`) and click Connect Kick.

## Automatic own-channel connections (pending PR)

- Blank Twitch/Kick channel fields now use the connected account's own channel; explicit saved fields remain overrides. Kick looks up its authenticated user ID through the official channels API and remembers the returned slug locally. YouTube's existing live-stream discovery also works before any source form has been saved.
- Runtime defaults stay separate from editable/saved fields, and disconnect-all remains respected. Studio/dock help and Spanish entries describe API sign-in, optional overrides and one Connect Kick flow. Dock account links remain available when the helper is offline.
- This branch is based on main independently of open documentation PR #23. The additional setup notes in #23 still need the owner's merge. Neither PR proves live Kick compatibility; owner verification is still needed. Helper versions are now bumped together to 1.24.0 for the shared-session Kick connection flow.

- Connection layout follow-up: Studio and the dock show account sign-ins first, keep the TikTok handle in the main setup, and group Twitch/YouTube/Kick fields below in a collapsed **Optional channel overrides** section. Included in PR #24.

- Owner requested one Kick sign-in for polls too. Checked the current official GitHub API index, scope list and changelog on 2026-10-22: no documented public poll endpoint or scope. The signed-in page poll exception remains; do not substitute private endpoints or imply OAuth alone enables polls.

- Shared-session Kick follow-up: Connect Kick queues `kick-connect` only for an active helper advertising support. The helper opens Kick page login first, then official OAuth in the same `persist:bubblecast-kick` partition. Only the exact loopback callback with that attempt's state is allowed. Existing cookie sessions are reused; no cookie values are copied into API tokens or logged. The separate poll sign-in button is removed. Helper is 1.24.0; restart it before trying this flow.
- This is one guided connection entry point, not a new poll API. Fixture tests do not prove Kick's real SSO reuse or acceptance of OAuth in Electron. No live session was opened during implementation. If Kick prompts for credentials twice or rejects embedded authorization, capture the error and reassess before claiming one credential entry is achieved.

- Product copy stays focused on connecting accounts and choosing another channel. API, OAuth and session-partition details belong in developer docs rather than the dock connection sheet.

- Kick account status uses Connected as / Not connected plus poll readiness; it never falls back to Read-only chat, including before Studio finishes loading or when the API is disconnected.
