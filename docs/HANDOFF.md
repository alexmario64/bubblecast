# Handoff: where Bubblecast is and how to keep building it

For any coding agent (Codex, Claude) or person picking up this repo. Read `AGENTS.md` (the rules) and `DEVELOPMENT.md` (the architecture) first. This file covers the current state, the next tasks, and lessons from recent work. Update it when those change.

State as of 2026-10-22: release 1.23.0 merged in #22, and the streamer app setup guide merged in #23. Open PR #24 prepares helper 1.24.0 with automatic account channels, a connections-first layout and a single shared-session Kick connection flow. After its merge, return to main and pull; restart the updated helper and refresh Studio, the dock and affected OBS sources. The owner is developing on macOS; Windows deployment (1.23.0 or 1.24.0) remains unconfirmed. The owner reports pasting the Kick client ID and secret on macOS; successful authorization, viewers and sending are still unverified.

## Open PRs and checkout at handoff

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
