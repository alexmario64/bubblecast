# Bubblecast development

Read DEVELOPMENT.md for setup and current architecture. This folder is the repository root. Read docs/HANDOFF.md for the current state, next tasks and lessons from recent work, and keep it up to date.

## Authoritative repository

The user has directed that all work from now on happens in https://github.com/alexmario64/bubblecast and its Git-connected checkout. Use this repository as the only development source. Do not maintain a separate app copy, ZIP-based development fork, or files in a parent workspace as the source of truth. Pull with `git pull --ff-only` before starting work when the working tree is clean. Preserve any existing uncommitted changes. Never commit or push directly to `main`. Every change goes on a new branch (for example `feature/<short-name>` or `fix/<short-name>`), is pushed to that branch, and is proposed with a pull request into `main` (`gh pr create`). Open the PR once the change is verified; the user merges it. After a merge, return to `main` and `git pull --ff-only` before starting the next branch. Do not add AI or agent attribution to commits or pull requests: no `Co-Authored-By` trailers for Claude, Codex or other agents, and no "Generated with" footers. If the remote has diverged, resolve it without overwriting others' work. Tests and fixtures belong inside this repository. Account sessions and user configuration remain local and ignored.

- Never use PHP: no PHP files, servers, dependencies or embedded PHP code, because of its security track record. Build server and tooling features in Node.js/JavaScript. `test/repo-policy.test.mjs` fails if PHP appears.
- Preserve low-latency capture, native animated media, stable message IDs, and startup-history suppression.
- Account sessions and stream settings stay local. Never commit .local/, sources.json, settings.json, cookies, tokens, or captured personal chat logs.
- Never point scripts, curl, headless or automated browsers at live platform sites (Twitch, YouTube, Kick, TikTok, Google). Scripted traffic from the user's IP triggers bot protection and captchas. Study live behavior only through the helper's real signed-in windows at a normal pace, and ask first.
- Use the shared poll helpers for native actions. Never automatically retry a publish/end/send action whose result is unknown. Do not publish invented test messages or polls on real platforms.
- Run pnpm test after behavioral changes. Browser DOM fixtures live in test/browser; the fixture suite does not prove live platform compatibility.
- Bump package.json, desktop/package.json and desktop/main.cjs together when shipping a helper update. Restart the background helper and refresh affected OBS sources.
- Keep the dock's independent poll pane separate from chat filters and preserve existing iframe sessions when opening or resizing it.
- This project targets Windows for streaming (OBS runs on Windows). macOS is supported for development only: the server, UI, tests and background helper run there, but every change must keep the Windows paths working. The Windows CI workflow must pass on each PR.
- Browser sources are transparent; platform logos must remain transparent. Komika Axis is the default overlay font (users may choose any installed font); keep the established bubble style for overlays.
- No hosted server or paid infrastructure, ever. Everything runs on the streamer's computer. Anything done as the streamer's account uses official APIs only (Twitch, YouTube, and Kick for sending and viewers), each on the streamer's own app keys in `.local/app-keys.json`. The one agreed exception is Kick polls, which have no API and run in the signed-in Kick page. Platforms without an official API (TikTok, Kick chat and events) are read anonymously, read-only and at a natural pace.
- Follow alerts come from the streamer's chat bots (for example StreamElements). Don't build native follow capture.
