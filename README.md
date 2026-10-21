# Bubblecast

For another PC or continued development, start with [DEVELOPMENT.md](DEVELOPMENT.md). Account sessions and personal settings stay local and are excluded from Git.

Current version: **1.16.0**. Polls use an independent resizable split pane, available beside any chat view. Successful creation opens that pane without replacing your chat layout. The mixed poll Browser source is `/poll-overlay`; copy its URL from the poll pane or Studio. YouTube end confirmation checks the native ended state/stable disappearance and synchronizes it into the dock. Earlier version notes below describe historical behavior; DEVELOPMENT.md describes current setup and operation.

A local Twitch + YouTube + TikTok LIVE + Kick OBS overlay inspired by the supplied reference: Wii U-inspired pearl bubbles, cyan name pills, Komika Axis lettering, gentle floating, and springy side entrances and exits.

## Media playback and timing (1.6.1)

Overlay and dock updates patch existing message elements. Unchanged animated images and videos stay mounted with their original playback state; updates that change only badges, name color, or neighboring text do not recreate those media elements. Equivalent relay updates are ignored. Changed media replaces only that media element, without detaching its unchanged neighbors. Bubble expiry and initial-history filtering are preserved.

The background app keeps hidden capture renderer processes at foreground priority. The overlay entrance is 380 ms; dock messages have no entrance animation. Chat delivery does not wait for the app's configuration polling interval. `/api/status` includes `renderTiming`, measuring server arrival to the next browser animation frame, plus media load timing where available. These local measurements exclude the time the platform takes to deliver a sent message to its receiving chat page. Recent dock history and preview samples are excluded from delivery measurements.

After updating, restart the background app and refresh the OBS dock and Browser sources, or reopen OBS. The Chrome extension does not need to be reloaded for this rendering fix.

## OBS workflow (background app, recommended)

The background app captures Twitch, two separate YouTube broadcasts, and TikTok LIVE without Chrome or the extension. It runs the local server too, so no terminal needs to remain open.

1. Install the background runtime once with **Install Background App.cmd**. It downloads Electron from its official GitHub release and verifies SHA-256. The runtime is already installed on this computer.
2. In OBS **Tools → Scripts**, add **Bubblecast OBS.lua**. OBS will start the helper when the scene collection loads. This computer's existing scene collections have already been configured. Keep the Bubblecast project folder in its current location, or update the script path if you move it.
3. In OBS **Docks → Custom Browser Docks**, use name **Bubblecast Chat** and URL **http://127.0.0.1:3927/dock**. This computer's previous TikTok chat dock has been replaced with the combined dock. Other docks remain as they were.
4. Open **Connections** inside that dock. Enter **YouTube Live** and **YouTube Shorts Live** as two different video links, along with your Twitch channel and TikTok handle, then save. Either YouTube input can be used alone. Entering the same broadcast twice captures it once.

All four inputs share one chronological dock. Each row identifies its platform and whether it belongs to YouTube Live or Shorts. The dock retains up to 300 recent messages in memory after overlay bubbles disappear; reopening the dock restores those recent messages. Restarting the background app clears that memory. No chat history is injected into the stream overlay. Auto-scroll can be paused without stopping capture, and **Clear view** affects only that dock.

The helper uses its own persistent browser sessions under `.local/desktop-data`. If a platform requires sign-in, use **Connections → Show source / sign in**, complete it yourself, and close the source window to hide it again. No source window opens automatically. Public LIVE availability and platform login restrictions still apply. Chrome extensions are not loaded in this app; native artwork comes from the platform, while the built-in BetterTTV resolver loads global and configured channel/shared sets. This computer's Twitch numeric ID is configured for TrueAlexLIVE.

**Start Bubblecast Background.vbs** can start the app manually without a terminal. Its tray menu opens setup or source windows and can quit capture. The helper remains running when OBS closes; opening OBS again reuses it. When background capture is active, the server ignores the Chrome capture bridge to prevent duplicate messages. To use the legacy bridge instead, quit the background app and use the Start instructions below with bridge 1.6.0.

The runtime, browser sessions, settings, and account tokens are excluded from the ZIP. OBS configuration backups on this computer use the suffix `.bubblecast-before-1.6.0.bak`.

## Start (legacy Chrome bridge)

1. Install Node.js 22 or newer if needed: https://nodejs.org
2. Double-click **Start Bubblecast.cmd**. Keep its terminal running while streaming.
3. Open http://127.0.0.1:3927 in Chrome or Edge. The Appearance tab has a demo and style controls.
4. In Chrome, open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**, click **Load unpacked**, and choose this project's **extension** folder. This is the included local bridge you can inspect; it is not a store extension.
5. Refresh the Bubblecast setup tab after loading the extension. The Connections tab should show **Browser bridge paired**. The setup tab pairs again automatically after server restarts.
6. Enter your Twitch channel/link, YouTube **live-video URL**, and/or TikTok **@handle or LIVE link** in Connections and press **Save connections & start chat**. Bridge **1.5.0** opens inactive, muted chat tabs automatically and reuses them on later saves. Keep Chrome and Bubblecast running; Chrome can stay minimized. On YouTube choose **Live chat** if you want unfiltered chat. TikTok requires an active LIVE broadcast.
7. In OBS add a **Browser** source: URL `http://127.0.0.1:3927/overlay`, width **3840**, height **2160**. The background is transparent. Use the 4K preset for a 3840 × 2160 canvas; 1440p and 1080p presets are also available. Reset the source transform if it was previously scaled. Leave **Shutdown source when not visible** off to keep receiving chat across scenes.

No package installation is required. `npm start` and `npm test` are also available.

## Connect a YouTube account

Connections now includes **Connect YouTube account**, a Google OAuth flow using only `youtube.readonly`. It discovers your live and upcoming broadcasts; choose one to connect its background chat tab. Keep the bridge installed for native chat media. Account linking does not replace the browser capture bridge.

One-time Google setup:

1. In https://console.cloud.google.com select or create a project and enable **YouTube Data API v3**.
2. Configure **Google Auth Platform** with app name **Bubblecast**, the required support/developer email, and **External** audience. In Testing mode add the Google account that will connect its YouTube channel as a **test user**. Add the scope `https://www.googleapis.com/auth/youtube.readonly` under Data Access.
3. Create a client of type **Desktop app** and download its client JSON. This desktop flow uses PKCE and a loopback callback at `http://127.0.0.1:3927/oauth/youtube/callback`. Do not choose service account, Chrome extension, or Web application for this UI.
4. In Bubblecast → Connections → Google account setup, import that JSON. The app encrypts it locally; it never uploads it to a Bubblecast service.
5. Click **Connect YouTube account** and complete Google's account selection and consent yourself. Choose the Google account/channel that owns your broadcasts. You can use a different Google account to own the Cloud project; add the YouTube login as a test user.
6. After the callback returns, click **Find my broadcasts**. No active or upcoming broadcast is a normal connected state when nothing is scheduled. You can still use the manual live-video URL field.

Client details and tokens are stored under `.local/youtube.dpapi`, encrypted with Windows DPAPI for the current Windows user (on macOS development machines, with a key held in the login Keychain). The application never returns the tokens to the browser. The downloaded client JSON remains wherever you downloaded it; treat it as private. Do not include `.local/` or downloaded credentials when sharing or archiving the source. The provided ZIP excludes local credentials.

**Disconnect account** requests Google token revocation and clears the local account tokens while retaining the client setup. API access, OAuth client setup, and actual sign-in must be validated with your Google project; mock tests do not establish a live connection.

References: https://developers.google.com/identity/protocols/oauth2/native-app and https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/list

## Add to administrator-mode OBS

OBS can stay in administrator mode. The overlay itself needs only a Browser source and the local app running. WebSocket is optional and is used exclusively to automate source installation.

- **Manual:** add a Browser source named **Bubblecast**, URL `http://127.0.0.1:3927/overlay`, width **3840**, height **2160**, transparent background. Position it in your scene.
- **Automatic:** in OBS choose **Tools → WebSocket Server Settings**, enable the server and keep authentication enabled, then Apply. In Bubblecast Connections click **Add overlay to current OBS scene**. The local app reads OBS's saved connection details without displaying or sending the password elsewhere. It uses `ws://127.0.0.1` only and refuses to change the scene while OBS is streaming or recording.

Automatic setup creates a separate source named **Bubblecast · Twitch + YouTube** in the current scene. Existing sources remain in place. Repeating setup reuses the source. You can disable OBS WebSocket afterward if you prefer; the overlay keeps working. It does not control starting streams, recording, or changing scenes.

## Controls

- Left / right changes the bubble alignment, entrance, and exit direction.
- Customize name, bubble, and text colors, font size, lifetime, width, and maximum messages.
- Toggle captured viewer badges and the Twitch / YouTube / TikTok marker.
- Links default to being removed from the message. You can instead drop the whole message or show links as plain text. Common bare domains, email addresses, and common obfuscated domains are filtered too. This is a practical URL filter, not a guarantee against every possible obfuscation.
- Settings save locally in `settings.json`; channel/video connections save locally in `sources.json`. Close the demo before streaming. Demo messages never go to Twitch, YouTube, or TikTok.
- New chat is forwarded to every open overlay, including the preview. Initial chat backlog is intentionally skipped. Test messages also appear in OBS while it is connected.

## Emotes, badges, and GIFs

The bridge reads messages as your chat page renders them. It forwards native image badges, native Twitch and YouTube emote images, sticker images, and GIF / video media with an HTTPS source from the supported platform/media CDNs. Images use their original URL and videos autoplay muted and loop; they are not flattened to screenshots.

For BetterTTV the overlay also resolves global text emote codes. Enter an optional **numeric Twitch user ID** in Connections to load that channel's active and shared BTTV sets. Codes are case-sensitive. It does not load every private/inactive emote in BTTV's catalog. Installed BTTV, FFZ, or 7TV browser extensions can render their emotes in the popout for the bridge to capture, including YouTube emotes where supported by those extensions.

YouTube's official chat API supplies message text and author roles but doesn't expose all custom-emote/sticker artwork, so this app uses the rendered popout instead. This is a browser DOM integration and may need selector updates when either platform changes its chat UI. It is not an official Twitch or YouTube integration.

**Compatibility limit:** a GIF or emote must be rendered as an image/video with a usable remote HTTPS URL. Browser-only `blob:` media, canvas-based effects, iframe-only embeds, CSS-only imagery, and unsupported CDN hosts are not forwarded. Arbitrary viewer-posted GIF links stay hidden when link filtering is on. This build cannot promise every new Twitch GIF feature until tested against a real message from your channel. Native image badges are captured; SVG-only YouTube role icons are not currently converted.

Moderation deletions are removed when the popout marks the original row as deleted. Chat being scrolled out of the popout does not delete it from the overlay. Full moderation coverage (for example a timeout without a row update) needs platform event integration and is not guaranteed by this bridge.

## Local operation & troubleshooting

The server binds only to `127.0.0.1:3927`. There is no hosted account or cloud relay. The extension reads Twitch, YouTube live-chat, and TikTok LIVE pages and sends chat to this local server. The page loads Google Fonts and media directly from their CDNs; those requests require internet. The loopback pairing token resets on every server start and is stored in extension storage; refresh the setup tab to repair a connection.

- **Waiting for chat:** check the app is running, save your connections, and check that the background chat tabs loaded. Wait for a new message; existing messages are skipped. Bridge activity means the capture script sees a chat container, not proof that a message was forwarded. Connections now shows a separate count of messages actually displayed; test messages do not increase it.
- **No BTTV image:** check capitalization, supply the numeric Twitch ID for channel sets, or enable BTTV in your chat browser. Asset/API failures leave the original code as text.
- **A GIF is missing:** compare its chat DOM source with the compatibility limits above. Don't turn off link hiding just to display arbitrary viewer URLs.
- **No connection after restart:** bridge version 1.3.1 reconnects automatically to a restarted local app. Keep the chat popouts open; they retry heartbeats every ten seconds. After updating extension files, reload Bubblecast Chat Bridge in Chrome's Extensions page, then refresh the chat popouts. The capture observer now survives chat-scroller replacement by Twitch and YouTube.
- **Port already in use:** close an earlier Bubblecast terminal before starting another instance.

## Verification

`npm test` checks URL filtering, text preservation, media source safety, badge metadata, setting bounds, mocked Google OAuth and broadcast discovery, and mocked authenticated OBS source installation. Windows credential encryption was also roundtrip-tested. The UI and local event relay can be verified with the included demo. Actual Twitch / YouTube account capture needs the extension installed in your stream browser and live chat; that is separate from the local demo.

## 4K, font, badges, and motion (1.3.1)

The 4K preset uses a logical 1080p coordinate system at 2× scale. Set the OBS Browser source to **3840 × 2160** at normal scale. Text, emotes, badges, spacing, and floating movement all scale together. 1440p and 1080p presets use their matching full-canvas Browser dimensions. The setup preview shows logical-size bubbles. Refresh the OBS Browser source after updating application files.

Komika Axis is loaded from the current Windows user's installed `Microsoft/Windows/Fonts/KOMIKAX.ttf`, or the system Fonts directory. The server serves that one installed font to OBS; it does not package or redistribute it. Your supplied logo files remain in `logos/` and are displayed with transparent backgrounds, with no backing tiles.

Subscriber badges are the exact badge artwork captured from each viewer's Twitch chat message, preserving that viewer's channel badge and tenure tier. Known Twitch badge URLs request the 72-pixel `/3` artwork, with the original URL retained as a fallback. Nothing substitutes another channel's subscriber badge. A labeled fallback appears only if both image sources fail.

Floating is explicitly controlled by **Gentle floating motion** and **Float amount**. The 9-pixel default is 18 physical pixels in 4K. The bubble has fully rounded corners and no corner tip.

Bridge 1.3.1 sends new text directly from the DOM mutation observer, without a debounce timer. Later emote or badge hydration updates the same bubble without replaying the entrance. Browser-to-app delivery timing appears under Twitch in Connections. This measurement starts when the chat message appears in the browser; it does not include Twitch or YouTube delivery time before the browser displays it.

After updating: reload the extension from this project's `extension/` folder, check that its version is **1.3.1**, and refresh the chat popouts. Reloading an older downloaded copy will not activate these changes.

## Duplicate-message fix (1.3.2)

Message IDs are fixed when first captured, even when a chat enhancer attaches its own ID later. The relay only accepts artwork updates for an existing message ID; an unknown update can never become a new chat bubble. Legitimate repeated text still appears when it has a different message ID. The server-side protection also prevents duplicates from bridge 1.3.1 while you update the extension.

## Expired-message lifecycle fix (1.3.3)

The bridge links a late Twitch/chat-enhancer message ID to the original captured message and keeps that identity if the chat row is rebuilt. The overlay also remembers retired message IDs: expired, cleared, or overflowed bubbles cannot be recreated by stale messages or artwork updates. Artwork updates keep the original expiry deadline. Distinct new messages with the same text still display normally.

To activate this fix, reload bridge **1.3.3**, refresh chat popouts, and refresh the OBS Browser source. Both the capture code and the overlay page changed. Regression coverage includes the sequence where all bubbles expire, an old chat row is recreated, and a new message arrives.

## Automatic background connections (1.4.0)

Reload the bridge from this project’s `extension/` folder once after updating, then refresh the setup page in Chrome. Enter the Twitch channel or link and the YouTube live-video link, then press **Save connections & start chat**. You do not need to open chat popouts manually. The bridge creates muted, inactive Chrome tabs and keeps them from automatic discarding. Saving again reuses the same tabs; changing a link navigates its existing tab. Chrome may still throttle background pages, so live platform delivery is not guaranteed to be instantaneous.

**Disconnect background sources** closes only tabs created by Bubblecast. Other open chat tabs are ignored while managed connections are configured, preventing duplicate capture. Saved links stay available, but Chrome startup never opens chat. Press Save connections & start chat when you are ready to stream. Keep Chrome and the local Bubblecast application running. YouTube requires the current live-video URL unless you use the optional account setup; a channel link alone does not identify a broadcast.


## Separate OBS layouts

All layouts receive the same live Twitch and YouTube messages and share appearance, badge, filtering, floating, and expiry settings. No extra chat bridge is needed. Add each as a separate OBS Browser source:

| Layout | URL | Browser source size |
| --- | --- | --- |
| Standard 4K | http://127.0.0.1:3927/overlay | 3840 × 2160 |
| Shorts / vertical | http://127.0.0.1:3927/overlay?layout=vertical | 1080 × 1920 |
| Below webcam | http://127.0.0.1:3927/overlay?layout=webcam | 800 × 480 |

The vertical preset keeps up to four bubbles in the bottom portion of the portrait canvas. Use 2160 × 3840 for a 4K portrait canvas; the preset scales automatically with its width. The webcam preset keeps up to three compact bubbles, automatically removing older ones when the available height fills. Position that transparent source below your webcam using OBS’s transform controls. All presets preserve full names, native badges, animated media, and slide direction. The standard layout keeps its existing resolution setting.

The setup page includes separate copy buttons and isolated sample previews. Sample previews use an extra showcase parameter; copy buttons always copy the live URL without sample messages. Refresh existing OBS Browser sources after this update.

## Manual chat start (1.4.1)

Starting Chrome, reloading the extension, opening the setup page, and pairing with a restarted app do not open chat tabs. Press **Save connections & start chat** to start your saved sources. Automatic pairing still keeps already-open sources connected. Chrome’s own “Continue where you left off” setting can restore tabs you left open; close those tabs or disconnect sources before exiting Chrome if you do not want Chrome to restore them.

## Single-emote bubbles

Messages containing exactly one native or BetterTTV emote display it larger and centered. Whitespace is ignored. Messages containing text or multiple emotes keep the normal inline size. Animated emotes retain their original media URL and animation. This applies to standard, vertical, and webcam layouts. Refresh each OBS Browser source to load this change.


## Rebuilt chat rows and BTTV artwork (1.4.2)

The capture observer now watches native/enhancer message-ID attributes, records late IDs even after the original row is detached, and transfers message identity through an equivalent replacement at the same DOM position. Distinct native message IDs still allow genuinely repeated text. Emote hydration remains an update to the original bubble and never restarts its lifetime. Resolved artwork is retained if an equivalent refreshed row temporarily contains the raw emote code. The relay also remembers captured BTTV/7TV/FFZ artwork for subsequent matching text codes during that server session. Reload bridge **1.4.2**, refresh the managed chat tab, and refresh OBS Browser sources after updating.

## Bot messages

Known bot sender names are hidden across all layouts: StreamElements, Nightbot, Streamlabs, Moobot, Fossabot, WizeBot, Botrix, Sery_Bot, SoundAlerts, PretzelRocks, Botisimo, MixItUpBot, Firebot, and TrueBot64. Sender matching ignores capitalization and an optional leading @. Messages from real viewers mentioning these bots still display; similar names are not blocked.


## Pairing after extension reload (1.4.3)

Old setup tabs now stop their pairing timer, close their event connection, and remove their connection handlers when Chrome invalidates the extension context. Synchronous send errors and errors inside asynchronous replies are both handled. The setup page asks to be refreshed after a bridge reload. Temporary server outages still retry normally, and opening Chrome or pairing alone still does not start chat. Reload the bridge to **1.4.3**, refresh the Bubblecast setup tab, and press **Save connections & start chat**.

## Add more ignored bots

In **Appearance → Ignored bots**, add usernames under **Additional ignored bots**, one per line or separated with commas. Press **Save appearance**. Names are matched exactly, ignoring capitalization and an optional leading @. The custom list is saved in settings.json and applies to Twitch, YouTube, TikTok, and every overlay layout. Common bots remain hidden automatically. Removing a custom name allows its future messages again.

## Live-only startup (1.4.4)

Connecting a source establishes a baseline of existing rows instead of displaying chat history. Twitch capture waits for its welcome marker and excludes restored rows before that marker, including history inserted later by chat enhancers. YouTube receives a brief startup baseline while its initial message batches render; normal messages after startup still forward immediately. Ignored message identities remain ignored when artwork or rows are refreshed. Connections shows **Loading · skipping history** until capture is listening. Reload bridge **1.4.4**, refresh setup, then press **Save connections & start chat** to refresh managed source tabs.

## TikTok LIVE (1.5.0)

Connections now accepts a TikTok @handle, profile link, or full HTTPS LIVE link. Save connections opens or reuses a muted background TikTok tab. The creator must be live, and TikTok may require you to sign in using Chrome. The bridge reads rendered comments, full nicknames, native image emotes, and image badges with their displayed level/rank labels. Gift, like, join, and system notices are excluded. The live welcome boundary excludes restored history, and virtual-list positions keep rebuilt rows from becoming duplicate bubbles.

TikTok is included in all existing OBS URLs; no separate source is needed. Its logo is a transparent SVG. Ignore lists, link hiding, single-emote sizing, expiry, and floating still apply. CSS-only badge artwork and GIF/media that TikTok does not render as a usable image/video URL cannot be forwarded. Reload the bridge to **1.5.0** and refresh setup once. The new TikTok page permission may require Chrome approval. A public LIVE page was inspected to establish the parser selectors; your own channel connection still needs to be tested while live.

## Username colors (1.5.1)

Twitch names use the actual color rendered by Twitch chat, including later color updates. Reload bridge **1.5.1**, refresh setup, and press **Save connections & start chat** to update managed chat tabs. Messages captured by an older bridge without a color remain white. YouTube and TikTok names receive a varied color consistently assigned to that viewer across messages and OBS layouts. The name-pill accent remains your Appearance color. Refresh each OBS Browser source after updating.

GIF first-frame display: overlay and dock reserve a fixed media area while a GIF downloads, and show it once its first frame is decoded. Late badge/name changes preserve the mounted animation and its readiness state. Reload OBS views to pick up this renderer-only change; no helper restart is required.


Twitch Giphy hydration: a traced live GIF changed from giphy.gif to giphy.webp about 460 ms after arrival. The renderer now retains the mounted image and its original URL for that same Giphy ID/rendition, including tracking/CDN changes. Relay updates also retain the first source, while different GIF IDs and static previews remain distinct. Reload the OBS dock and Browser sources after applying this fix.


GIF-only arrival: the whole overlay bubble or dock row stays out of layout until its media is decoded, then appears together. Overlay duration starts at that moment. Text with a GIF remains immediate, load failures reveal fallback text, and moderation cancels pending arrivals.


Emote-only arrival uses the same complete-message reveal as GIFs, including static/animated Twitch and BTTV images, single enlarged emotes, and multiple emotes. All images finish decoding before the bubble or dock row appears. Whitespace does not bypass this gate.


## Direct Twitch delivery (1.6.2)

The background helper now reads new Twitch messages directly over its secure read-only IRC WebSocket connection. A live comparison found the rendered chat page arriving about 4.1 seconds later. The page remains hidden for actual badge/artwork enrichment and as a fallback when the direct connection is unavailable. Native names, colors, emotes, GIFs, moderation, link filters, and bot ignores still apply. No Twitch OAuth setup or chat posting is involved.

Delayed page rows match direct messages in FIFO order, preserving intentional repeated messages and avoiding replay when old bubbles expire. Native badge artwork is cached per viewer; the first message from a viewer without cached artwork can receive its badges later when the page renders it. The cache is private in `.local/twitch-badges.json` and is excluded from the ZIP. `collector.twitchTransport` reports `direct` or `page`; `collector.twitchPageDelayMs` reports measured page lag after matching a row. YouTube and TikTok continue using background capture.

## Earlier YouTube and TikTok capture (1.6.3)

Both YouTube inputs now read live-chat JSON responses inside their own background source windows before page rendering. They retain independent IDs and moderation. TikTok reads the existing source window's incoming webcast WebSocket frames (including gzip protobuf) and fetch responses, forwarding new comments and standalone native emotes before its display queue. This does not add a public debugger port, install a service, read credentials, or require Google Cloud setup. It does not increase the platforms' polling rates.

The first YouTube response and initial TikTok fetch are baselined instead of shown. Historical TikTok envelopes and comments predating connection are excluded. Page reloads establish a fresh history baseline. Delayed DOM rows enrich the original message, including exact artwork, without replaying expired bubbles; intentional repeat messages remain separate. Both receivers fall back to existing page capture for unsupported formats. TikTok inline emotes whose offsets cannot be interpreted safely continue through page capture.

Status under `collector.feeds` reports each input's `network` or `page` transport, parsed batches, and measured page delay. These improvements remove page-rendering queues; upstream YouTube batching/poll delivery and first-time image loading can still add latency. TikTok live timing requires testing while its creator is live.

Protocol references: Electron Debugger API (https://www.electronjs.org/docs/latest/api/debugger), yt-dlp's YouTube live-chat response handling (https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/downloader/youtube_live_chat.py), and the TikTok-Webcast-Protobuf v3 schema (https://github.com/isaackogan/TikTok-Webcast-Protobuf).

## Independent YouTube fetching (1.6.4)

Live testing found only 6 ms between YouTube response arrival and DOM rendering; its page request cadence was the remaining delay. Each YouTube source now starts a separate read-only continuation reader from the existing chat request context. It checks about once per second after each response, without waiting for the page's display/poll timer. HTTP errors, 429/Retry-After, invalid continuations and disconnects back off or abort cleanly. Only the same YouTube live-chat endpoint is used. Authorization/Cookie headers are not copied; the existing Electron session handles its own cookies. Source removal/navigation stops its reader.

Both network and page results still pass through the same native-ID/FIFO merge, filters, and history baseline. Status includes `collector.feeds.youtube.polling` and `youtubeShorts.polling`, plus `sourceDelayMs` (platform timestamp to receipt, subject to local clock offset). TikTok continues receiving existing webcast frames immediately, with DOM fallback for unsupported payloads. Its decoder is tested against schema-based fixtures; live latency remains unverified until the channel is live.

YouTube request decoding also handles gzip request contexts from Electron upload bytes and CDP byte entries; the independent reader was confirmed live with 83 ms response time. All 156 automated checks pass. Upstream message delivery time and media-download time are separate from request duration.


## Faster YouTube live mode (1.6.5)

The background YouTube windows select unfiltered Live chat through their standard menu, rather than defaulting to Top chat. Switching establishes a new history baseline before restarting the continuation receiver. Successful reads now wait 500 ms between responses; error and Retry-After backoff remains. A live connection confirmed Live chat mode and a 64 ms request response. Source-age telemetry records only first arrival, so duplicated server batches cannot inflate that measurement. All 160 checks pass.


### 1.6.6 responsiveness
YouTube now targets a sequential 200 ms request cadence, counting request time toward the interval, with a minimum 50 ms pause and existing error/Retry-After backoff. This is polling, not push; actual latency depends on YouTube and the network. Both YouTube inputs use independent readers. Shared event delivery serializes each event once for all views. Bubble entrance takes 240 ms. Twitch and TikTok retain immediate network delivery; TikTok still requires a live test.

### 1.7.0 dock polls
Read-only collapsible poll cards above combined chat for Twitch, YouTube Live and YouTube Shorts. Capture uses incoming poll responses and rendered poll cards in the existing background source windows; no API key, poll creation or voting. Vote totals/percentages are shown only when exposed by the platform. Missing results remain unknown. Polls stay out of stream overlays and restore on dock reconnect. Source changes clear cached polls. Native poll formats and DOM fallback have fixture coverage. Live Twitch and YouTube poll titles/options were verified together in the dock; nonzero vote updates and end transitions still await live verification. Hidden/collapsed or signed-out source sessions may not expose full results; use Show source to inspect the platform poll if needed.

### 1.7.1 poll closure
Poll cards are cached locally for up to 24 hours only for the same source URLs, and survive helper restarts. Disappearing source panels become Closed with last available results, not final counts. Confirmed native completed/terminated polls retain final states. A read-only Twitch poll lookup follows known poll IDs and stops on completion, throttling backs off, and unauthenticated results stop retries; the current signed-out helper cannot recover archived final vote counts. Both previous test polls were observed closed; their final nonzero vote counts could not be verified.

### 1.8.0 sign-in and dock composer
Connections includes a platform sign-in window sharing each local persistent capture session. Close that window or Refresh after sign-in; YouTube normal and Shorts share one session. Passwords are entered only on platform pages; sessions stay in .local and are excluded from the ZIP. Google may refuse embedded sign-in and require supported browser OAuth with product-owned registration; there is no bypass or imported browser cookies.
The dock composer supports All connected chats, Twitch, YouTube Live, YouTube Shorts or TikTok. Each configured destination is attempted independently through its own signed-in native chat composer. Submitted means the native editor cleared after Send, not independently verified delivery. Failed/unknown destinations are shown separately. No automatic send retry, command forwarding or startup replay. Existing platform drafts are protected; changing source URLs cancels that destination. Messages expire after 30 seconds. Jobs are memory-only and bounded to 100; text is not included in public status responses or saved to disk. Background commands use authenticated long polling for prompt dispatch. Only known native Twitch authorization headers are reused in memory for same-endpoint read-only poll lookup; cookies/passwords/tokens are never logged or written to app configuration. Live sign-in and sending still require user verification.

### 1.8.1 silent windows and sign-in navigation
Every app webContents is muted when created, including sign-in windows, child popups, setup and hidden capture. Silence is reapplied during navigation and playback. Sign-in opens dedicated login/account pages instead of recommendation feeds. Normal ERR_ABORTED redirect replacements are not logged as authentication failures; real load failures log only the platform and error code, without navigation URLs. Closing sign-in during shutdown no longer attempts a session refresh. The reported YouTube sign-in error still needs its exact text to diagnose; Google account restrictions are not bypassed.

### 1.9.0 studio and dock redesign
Apple-inspired system typography, a sidebar studio, compact settings, a dark OBS dock, connection sheet, subtle motion and reduced-motion support. Chat view filters are independent of composer destinations. Optional account controls replace the legacy visible Google Cloud/extension setup. Login state is determined separately from chat availability, so signed-in accounts remain identified while offline; cookie values are not returned or logged. Twitch and YouTube existing helper sessions were observed signed in after the fix. OBS has a separate OAuth connection; its saved access tokens were expired at inspection and are not copied or used by Bubblecast.
Closed polls disappear after eight seconds, can be dismissed sooner, do not restore from disk, and retired IDs cannot revive via late updates. The editor’s local welcome preview remains visible; actual live messages keep their original expiry. All app windows remain muted.

### 1.9.1 YouTube sending

Recognizes YouTube's native editor with an empty contenteditable attribute, as well as true and plaintext-only. Existing draft protection and single-click sending remain in place. Native markup regression checks cover the Send button becoming available after typing.


### 1.9.2 Overlay-only bot filtering

The reading dock always includes common and custom bot messages, including restored recent history. Appearance → Message filters → Filter bots on overlay controls bot visibility on all overlay layouts. Disabling it keeps your custom list saved and shows future bot messages on stream. Filtering defaults to enabled for existing settings.


The dock's To menu always lists YouTube Live and YouTube Shorts Live separately. Unconfigured destinations say add stream and cannot be selected. Saving the optional Shorts live link enables that destination immediately; sending to Shorts alone does not send to the regular YouTube live chat.


### Console-inspired dock appearance

The dock uses a warm rose and peach glass frame, a pearl chat surface, circular platform controls, turquoise selection rings, and matching Connections and poll panels. Compact layouts are tuned for 320-pixel OBS docks, with reduced-motion support. Refresh the dock to load the appearance update. Capture, stream overlay styling, saved connections, and independent send destinations are unchanged.


The Studio Appearance and Connections menus now share the dock's console-inspired rose and peach glass surfaces, circular navigation icons, turquoise selection outlines, and matching controls. The layout adapts to smaller screens without horizontal scrolling. Refresh Studio to load the appearance update.


### 1.9.3 Interface themes and unread indicators

Green platform dots indicate unread chat rather than connection activity. Opening a source at the latest messages clears its dot; All chats and Jump to latest clear the currently visible messages. Restored history and metadata updates do not create unread dots. Scrolling back pauses auto-scroll.

Color scheme 1 is the original Rose & peach. Color scheme 2 is Red & white. Choose a scheme in Studio Appearance and save changes, or use the Color scheme selector in the dock's Connections panel. The saved scheme applies to both interfaces and does not change stream bubble colors.


## Matching OBS native styles

Two optional extra styles are included in obs-themes: Bubblecast 1 - Rose & Peach and Bubblecast 2 - Red & White. Run Install OBS Themes.cmd to install them in the user theme folder. Restart OBS, then choose Settings → Appearance → Theme: Yami and the matching Bubblecast Style. The installer keeps your active style and OBS configuration. See obs-themes/README.md for scope and validation details.


The revised native OBS styles use clearer white card surfaces, darker text, larger native controls, selected-row outlines, matching sliders, and a theme-specific minimum size/spacing floor. Both schemes were rendered with real offscreen Qt widgets; preview images are test renders, not captures of the running OBS session. Restart OBS to reload the installed revision.


### OBS Console Glass style

Bubblecast 3 - Console Glass is an additional OBS style inspired more closely by the console reference: a rich plum-to-peach background, translucent native surfaces, white text and selected-item rings, round controls, and colored toolbar actions. It preserves styles 1 and 2. Restart OBS, then select Settings → Appearance → Theme: Yami → Style: Bubblecast 3 - Console Glass. Native Qt alpha blending is used; this does not implement browser backdrop blur or turn the native scene list into a tile interface.


Console Glass now has the stronger console reference treatment: a red menu strip, cool blue/mint translucent panels, turquoise selection rings, white circular utility buttons with colored vector icons, and coral primary actions. The icon folder is installed with the theme. Restart OBS to load the revised Bubblecast 3 - Console Glass style; styles 1 and 2 are preserved.


### 1.12.0 Kick poll cards

Live verification confirmed the initial poll, a subsequent poll with one vote at 100%, its results state, and automatic cleanup. Kick polls appear beside Twitch and YouTube polls in the dock, with the native question, options, vote counts, percentages, a Kick mark, and green result bars. Cards respect each view's platform filters, remain collapsible, and can be dismissed locally. The capture observes Kick's native poll card without voting or requiring sign-in. Collapsed native options retain the last known counts. Ended polls retain results briefly, then disappear; removed cards close after a short grace period. Polls never become overlay message bubbles. Identical later polls receive a fresh identity, while reconnects preserve the existing active poll.

### 1.11.1 Kick guest status and current transport

Kick guest cookies no longer count as account sign-in; an explicit native login prompt overrides stale cookie metadata. Chat capture accepts the current Kick realtime host in addition to legacy Pusher, and native DOM fallback receives new virtual rows after freezing the initial history baseline. Kick source windows use a desktop-sized viewport so its responsive layout mounts the chat panel even while hidden. Incoming text and an emote reached the dock and overlay in a live check with the configured channel while signed out. Rebuilt rows and late emotes update the same message. Click the selected All chats/Custom button to toggle its filter menu. Clicking it from another platform first restores that view; right-click and keyboard access remain available.

### 1.11.0 Kick and checkbox filters

Add a Kick channel name or HTTPS kick.com channel link in Connections. The background helper opens its muted source page and reads native live chat socket messages; reading does not require API keys. Sign in through Connections only when sending is needed. Incoming messages support full viewer names, native emote URLs, and image badges enriched from the page. Native inline SVG role badges are not currently copied. Emotes retain the platform's animated media when supplied. Each native message ID is deduplicated, and historical DOM rows can only enrich existing messages, never create new bubbles. Platform restrictions and unavailable sessions remain visible as send failures; there is no automatic resend.

Kick appears in the dock, overlay, source panes, platform logos, and send destinations. Incoming Kick delivery has been checked with the configured channel; sending still requires your own signed-in session.

The top platform shortcuts and combined chat filter stay synchronized. Click All chats again when selected, right-click it, or press Arrow Down while focused to open the checkbox menu. Editing selections changes its name to Custom; its normal click restores the saved custom selection after viewing an individual platform. Selecting All platforms resets it to All chats. Kick remains visible before setup. The default Chats in this view send target follows the visible filter.

Each pane's source dropdown is replaced by a checkbox filter menu. Select any combination of Twitch, YouTube Live, YouTube Shorts, TikTok, and Kick. YouTube's parent checkbox selects both streams. Header logos reflect the chosen platforms. Pane filters persist with the workspace and default sending to only those selected sources. Changing a pane's sources reloads that pane, as before.

### 1.10.0 Modular chat dock

Use the View menu to choose Combined, Side by side, Stacked, or Grid. Add up to four panes, choose each pane's sources, and drag dividers (or focus them and use arrow keys) to resize side-by-side or stacked panes. Drag a pane by its six-dot grip to reorder it, or focus the grip and press arrow keys. Grid layouts offer one to four columns. Layout, ordering, proportions, and pane choices are saved locally. Switching layouts preserves existing panes and drafts. Removing a pane or changing its source closes that pane's current view.

YouTube groups incoming Live and Shorts messages, with stream labels retained. Panel headers show their platform logos, with all represented platforms shown for combined feeds. Every message shows its platform logo; Live and Shorts use the same YouTube logo. Choose YouTube Live only or YouTube Shorts to separate them. The send menu offers both streams or either stream independently. Each pane defaults to sending only to its displayed sources; All connected chats explicitly broadcasts everywhere. Twitch + YouTube excludes TikTok, including its history and polls.

For separate native OBS custom docks, use `/dock?source=twitch`, `/dock?source=youtube` (both streams), `/dock?source=youtubeLive`, `/dock?source=youtubeShorts`, or `/dock?source=tiktok`. Split layouts remain inside one OBS dock.

### 1.9.5 TikTok background Send control

TikTok can leave its native Send button visually hidden while enabling it after text entry in the background helper. The sender now recognizes that exact enabled control, waits briefly for native readiness, and still refuses disabled controls, hidden containers, or mismatched text. It clicks once and retains the existing delivery confirmation check.

### 1.9.4 TikTok capture and sending

Recognizes TikTok LIVE's room-chat-input-field plaintext-only editor and room-chat-send-btn control, including hidden/disabled Send states. The background TikTok viewer may play silently to initialize its room connection; Electron audio muting remains enforced. A native baseline signal starts the page reader when a welcome banner is absent, preserving startup history suppression. Repeated script injection cannot install duplicate readers, and native TikTok message IDs stay intact across page/network enrichment and row recreation. Account inspection has a bounded timeout with one in-flight request per source so a stalled page cannot hold the helper heartbeat and accidentally enable the Chrome fallback. Live TikTok send/receive behavior still needs validation on a currently live stream.


## Shared poll composer (1.13.1)

The OBS dock's **New poll** button accepts one question and two answers for Twitch, Kick, YouTube Live and YouTube Shorts independently. Twitch and Kick share 2-, 3- or 5-minute durations. YouTube polls stay open until ended through the dock or YouTube. Creator/moderator permission is required; offline status alone does not block creation.

All selected native creator forms are prepared before any Create button is clicked. If preparation fails, no selected platform is published; Bubblecast rolls back its own unchanged drafts. Native drafts edited by the user are preserved. Publication attempts run together, but platform networks cannot guarantee simultaneous arrival. Each destination reports a confirmed active poll, a failure, or an unconfirmed result. There are no automatic retries or automatic rollbacks after a partial launch. Check unconfirmed platforms before trying again. Existing native drafts are never overwritten.

Kick login refreshes its shared background session automatically while the sign-in window remains open, without repeatedly reloading for guest or analytics cookies.

Native Kick/Twitch creator structures have been inspected. YouTube creator fields use accessible labels and fail closed if the native form cannot be identified. End-to-end creation across all platforms still requires a user-submitted live check; fixture tests do not prove current platform compatibility.

Version 1.13.1 waits for asynchronously mounted poll forms, recognizes YouTube menu items, avoids toggling the engagement menu repeatedly, and uses Kick’s editor Enter command handler for /poll. Failed preparations roll back only drafts owned by the request. Twitch continues using its /poll command.

Version 1.13.2 uses native browser Enter input for Kick’s /poll opener through the existing capture session. YouTube now targets the observed yt-live-chat-poll-editor-panel-renderer and its custom answer inputs, including delayed background layout and untouched Yes/No defaults. The native YouTube menu and form were inspected directly; successful shared publication is still awaiting user verification.

Version 1.13.3 fixes Kick /poll preparation by using native character key events instead of bulk text insertion, so the command updates its Lexical editor state. Focus and pointer activation are confined to the helper page and focus emulation is restored afterward. Twitch’s /poll opener is unchanged. Preparation now checks that the native Start/Create button is enabled before any selected platform can publish. Per-platform attempt results are available in local helper diagnostics. The real signed-in Twitch and Kick forms passed a prepare-and-clear readiness check without publishing a poll. Final cross-platform publication still needs user verification.

Version 1.13.4 enforces Kick’s minimum two characters per answer in the composer, queue validation, and native adapter. Invalid shared requests are rejected before any platform is queued. Native Kick validation errors are read after one Create click and reported as failures rather than unconfirmed submissions. Partial success summaries acknowledge platforms that actually started. Twitch publication was confirmed by the user; Kick rejected one-character answers in its native form; subsequent valid-answer Kick publication was confirmed by the user.


Version 1.15.0 adds a shared poll board. End all ends the active polls visible through the current chat filter in one parallel helper job. Each native action runs once, with independent confirmed/failed/unconfirmed feedback; failed destinations can be retried explicitly. Twitch uses /endpoll, Kick uses its scoped poll-delete-button, and YouTube uses the poll’s finalize control or menu (including Spanish labels).

Combined groups matching questions and answers; By platform shows independent results and end controls, including Live and Shorts separately. The view preference is saved. Totals sum known per-answer counts rather than averaging percentages. Sources that expose only percentages are labeled separately and are excluded from the combined counted-vote denominator. Ended results remain visible for five minutes in the current dock session and can be dismissed. Successful creation closes and clears the composer, returns split layouts to the main combined chat view, and reveals the new poll. Failures and uncertain launches keep their detailed results open. Keyboard focus, expanded state, and progress elements are preserved during ordinary vote updates; reduced-motion preferences are honored.
