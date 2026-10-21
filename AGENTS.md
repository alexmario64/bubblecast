# Bubblecast development

Read DEVELOPMENT.md for setup and current architecture. This folder is the repository root.

- Preserve low-latency capture, native animated media, stable message IDs, and startup-history suppression.
- Account sessions and stream settings stay local. Never commit .local/, sources.json, settings.json, cookies, tokens, or captured personal chat logs.
- Use the shared poll helpers for native actions. Never automatically retry a publish/end/send action whose result is unknown. Do not publish invented test messages or polls on real platforms.
- Run pnpm test after behavioral changes. Browser DOM fixtures live in test/browser; the fixture suite does not prove live platform compatibility.
- Bump package.json, desktop/package.json and desktop/main.cjs together when shipping a helper update. Restart the background helper and refresh affected OBS sources.
- Keep the dock's independent poll pane separate from chat filters and preserve existing iframe sessions when opening or resizing it.
- This project targets Windows. Browser sources are transparent; platform logos must remain transparent. Keep Komika Axis and the established bubble style for overlays.
