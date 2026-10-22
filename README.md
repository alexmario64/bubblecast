# Bubblecast

A local streaming workspace for Twitch, YouTube (including a second Shorts stream), TikTok LIVE and Kick. It combines every chat into one OBS dock, puts chat, polls and stream events on transparent OBS overlays in a comic bubble style, and runs native polls across platforms. Everything runs on your own computer; there is no Bubblecast cloud service.

## What it does

- **Chat dock** (`/dock`): one feed for every platform, or side-by-side panes. Send to any connected chat, run and end polls on several platforms at once, and see live viewer counts. Bots show in the dock unless you hide them from its Bots menu.
- **Chat overlay** (`/overlay`): chat bubbles with native emotes, animated GIFs, badges and platform logos. Stream events (subs, gifted subs, raids, channel-point redemptions, Kicks gifts, Super Chats, memberships) appear as highlighted bubbles. Vertical (`?layout=vertical`) and below-webcam (`?layout=webcam`) layouts are available.
- **Poll overlay** (`/poll-overlay`): one card that combines a poll running on several platforms, with its own position, colors, labels and timing.
- **Studio** (`/`): setup and customization. Overview with live viewers and channel status, Connections, Appearance (app and dock themes), Chat overlay, Poll overlay, Chat dock and OBS setup. Changes preview live and save automatically.

Optional OBS interface themes that match Bubblecast are in `obs-themes/` (install with Install OBS Themes.cmd).

## Getting started

Bubblecast targets Windows for streaming. See [DEVELOPMENT.md](DEVELOPMENT.md) for full setup, including macOS for development. In short:

1. Install Node.js 22+ and pnpm, then run `pnpm install --frozen-lockfile --ignore-scripts` and `pnpm install:background`.
2. Start Bubblecast Background.vbs (or add Bubblecast OBS.lua in OBS Tools → Scripts so it starts with OBS).
3. Open http://127.0.0.1:3927, add your channels under Connections, and sign in to a platform only if you want to send chat or run polls there.
4. In Studio → OBS setup, copy the overlay and dock URLs into OBS. Pick the canvas resolution that matches OBS (4K, 1440p or 1080p).

## How it connects

**Twitch** connects through Twitch's official API: click Connect Twitch in Studio and approve Bubblecast with a short code at twitch.tv/activate (in any normal browser or on your phone). Chat, subs, gifts, raids, redemptions, polls and viewer counts then come from Twitch directly, and messages and polls are sent through it. Without connecting, Twitch chat is still read anonymously over Twitch's official chat connection.

**YouTube** connects through the official YouTube Data API: click Connect YouTube in Studio or the dock, sign in with Google in your browser and allow access. One connection covers YouTube Live and Shorts. Chat then arrives instantly from YouTube's official live chat stream; Bubblecast also reads the chat page signed out in the background to add custom emoji images and badges, and remembers both so repeat emojis and chatters show them at once. Messages, polls and viewer counts go through the API. Without connecting, YouTube chat is read signed out at YouTube's normal pace (about every 10 seconds).

Kick and TikTok are read by a background helper (Electron) that keeps one window per platform; Kick is moving to its official API. Nothing is posted unless you send a message or start a poll yourself, and an action whose result is unclear is never retried automatically. There is no Bubblecast server: everything runs on your computer.

## Privacy

The server listens only on 127.0.0.1:3927. Sign-in sessions, settings and recent chat stay in this folder's `.local/`, `settings.json` and `sources.json`, which are never committed to Git or shared.

## Development

`pnpm test` runs the unit and DOM fixture tests; `pnpm screenshots` captures every page for visual review. Changes go through pull requests. See [DEVELOPMENT.md](DEVELOPMENT.md) and [AGENTS.md](AGENTS.md).
