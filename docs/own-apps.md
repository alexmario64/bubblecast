# Set up your own YouTube and Kick apps

Bubblecast is free and open source, and it runs entirely on your computer. There is no Bubblecast server in the middle. To sign in to YouTube and Kick through their official APIs, each streamer registers their own free app with Google and with Kick, and then pastes its keys into Bubblecast.

YouTube has a default quota of 10,000 API units a day per Google Cloud project. If every streamer shared one project, their combined usage would consume the same allowance. With your own project, the quota is only yours.

A Google OAuth client identifies an app; the YouTube quota belongs to its Google Cloud project. A shared project would pool every streamer's usage. Each streamer should create their own project and Desktop app client, rather than reuse Bubblecast's developer credentials. This isolates quota; it does not remove the quota limit.

Kick apps are not inherently restricted to their creator: Kick's [OAuth user authorization flow](https://github.com/KickEngineering/KickDevDocs/blob/main/getting-started/generating-tokens-oauth2-flow.md) lets a user approve an application's access. Bubblecast nevertheless requires each streamer to create their own Kick app and keep its secret locally. We do not distribute the developer's secret or operate a hosted token service. This is Bubblecast's deployment choice, not a claim that Kick apps can only serve one account. Twitch's existing connection needs no app registration by the streamer.

Each setup takes about 10 minutes and only has to be done once. Twitch and TikTok need nothing here.

Your keys are saved only on your computer, in `.local/app-keys.json`. Bubblecast sends them only to Google or Kick, when you sign in. Never share your client secret or post it online.

These steps also work on macOS for development. Start the local server with `pnpm start`, or use the background helper, before connecting. Windows is the streaming/OBS target. Enter keys separately on each computer; do not copy account sessions or personal configuration between machines.

## YouTube

You need a Google account. It doesn't have to be the one that owns your YouTube channel; you sign in with the channel account later.

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and accept the terms if asked.
2. Click the project picker at the top, then **New project**. Name it something like `Bubblecast` and click **Create**.
3. Make sure the new project is selected in the project picker.

### 2. Turn on the YouTube API

1. Open **APIs & Services → Library**.
2. Search for **YouTube Data API v3**, open it and click **Enable**.

### 3. Set up the consent screen

1. Open **APIs & Services → OAuth consent screen** (on newer consoles: **Google Auth Platform → Branding**).
2. Choose **External** as the user type.
3. Fill in an app name (for example `Bubblecast for <your channel>`), your email as the support email, and your email again as the developer contact. You can leave the logo and links empty.
4. Under **Data access** or **Scopes**, add `https://www.googleapis.com/auth/youtube.force-ssl`.
5. Under **Audience** or **Test users**, add the Google account that owns your YouTube channel.
6. Click **Publish app** so the app is **In production**. If you leave it in Testing, Google signs you out every 7 days. You don't need Google's verification for your own use. When you sign in, Google shows "Google hasn't verified this app": click **Advanced**, then **Go to … (unsafe)**. It's your own app, so that's expected.

### 4. Create the client

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) (or **Google Auth Platform → Clients**) with your project selected.
2. Click **Create credentials → OAuth client ID**.
3. Choose **Desktop app** as the application type, give it a name and click **Create**.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) and the **Client secret**.

### Replacing an existing secret

If you already have a Desktop app client, you can keep its client ID. Use that client's secret-management controls to replace a compromised secret and retire the exposed one, then save the new secret in Bubblecast. Creating a new OAuth client gives you a new client ID as well. Do not create another project merely to work around an exhausted quota.

### 5. Connect in Bubblecast

1. Open Bubblecast Studio at http://127.0.0.1:3927 and go to **Connections**.
2. In the YouTube card, open **Your Google app**, paste the client ID and client secret, and click **Save Google app**.
3. Click **Connect YouTube**, sign in with your channel's Google account and allow access.

## Kick

You need a Kick account. Use the account you stream with, so Bubblecast sends chat as you.

### 1. Create the Kick app

1. Sign in with your streaming account, open [Settings → Developer](https://kick.com/settings/developer) and create a new app. Kick's [app setup guide](https://github.com/KickEngineering/KickDevDocs/blob/main/getting-started/kick-apps-setup.md) requires two-factor authentication to access developer tools.
2. Set **Application Name** to `Bubblecast`. The creation form asks for **App Description**; use, for example: `Local streaming companion for sending chat and displaying channel status and viewer counts.`
3. Set the **Redirect URL** to exactly:

   ```
   http://localhost:3927/oauth/kick/callback
   ```

4. Turn on these permissions (scopes):
   - **Read user information** (`user:read`)
   - **Read channel information** (`channel:read`)
   - **Write to Chat feed** (`chat:write`)

   **Read user information** may already be checked. Leave **Enable webhooks** off and leave other permissions unchecked for the current release.
5. Save the app, then copy its **Client ID** and **Client secret**.

### 2. Connect in Bubblecast

1. In Studio, go to **Connections** and open **Your Kick app** in the Kick card.
2. Paste the client ID and client secret, and click **Save Kick app**.
3. Click **Connect Kick**, sign in to Kick if asked and approve the permissions.

Once connected, Bubblecast sends your Kick messages and reads your Kick viewer count through the API. Kick chat is still read from Kick's public chat, as before.

Kick has no API for polls. To run Kick polls from Bubblecast, also click **Sign in for polls** in the Kick card and sign in to Kick in the window that opens.

### Future Kick features and permissions

The roadmap includes changing titles/channel settings, subscriptions and gifts, channel-point reward management, and moderation. These are requested future features, not capabilities enabled by saving the keys. Current Bubblecast requests only `user:read`, `channel:read` and `chat:write` during Connect Kick.

The developer form also offers these permissions for that future work:

| Future feature | Developer-form permission |
| --- | --- |
| Titles and channel settings | Update channel information |
| Official chat, follow, subscription and gift events | Subscribe to events (read chat feed, follows, subscribes, gifts) |
| Reward information | Read Channel points rewards information on a channel |
| Reward management | Read, add, edit and delete Channel points rewards on a channel |
| Moderator management | Execute moderation actions for moderators |
| Chat moderation | Execute moderation actions on chat messages |

Broader permissions were discussed while the owner prepared their app. Other streamers only need the three current permissions above. Selecting additional permissions in Kick does not make Bubblecast request or use them; future implementation will require the corresponding OAuth scopes and another authorization step.

Keep **Read stream key** unchecked: it could support a future feature that configures OBS's streaming connection, but it is unnecessary for chat, titles, viewers, events, rewards or moderation. The key grants sensitive broadcasting access. Ads and KICKs-information permissions are not needed for current setup either.

Kick's [official event delivery uses webhooks](https://github.com/KickEngineering/KickDevDocs/blob/main/events/introduction.md). The current local-only app has no public webhook receiver. Keep webhooks off; selecting event permissions does not solve delivery. Current chat/event capture stays as documented in DEVELOPMENT.md. Native follow capture would also require changing the current bot-based follow policy. Future work must preserve the no-hosted-server requirement.

## Verify the connection

After saving keys, click **Connect YouTube** or **Connect Kick** and complete authorization. Pasting keys alone is not a successful connection. Check the connected account name in Studio. For Kick, confirm the configured channel's live/offline state and, when live, its viewer count; allow about two minutes for a regular refresh. Sending should be checked once with a real message the streamer intends to post. If the result is unknown, inspect chat before any further action; never automatically retry it. Report the exact error text without secrets, tokens or callback URLs containing authorization codes.

## Troubleshooting

- **"Add your … app first"**: the keys aren't saved yet. Paste both the client ID and the client secret, then click Save.
- **YouTube: "Google hasn't verified this app"**: expected for your own app. Click **Advanced → Go to … (unsafe)**.
- **YouTube: "access_denied" or "not a test user"**: add your channel's Google account as a test user, or publish the app (step 3.6).
- **YouTube: signed out after a week**: the consent screen is still in Testing. Publish it.
- **YouTube: "quota is used up"**: your project's daily 10,000 units ran out. It resets at midnight Pacific time. Sending a chat message costs 20 units, so heavy sending uses it fastest.
- **Kick: sign-in stops at an error page about the redirect**: the redirect URL in your Kick app must match `http://localhost:3927/oauth/kick/callback` exactly, with no trailing slash.
- **Switching to a different app**: save the new keys. Bubblecast signs you out of the old app automatically, so connect again afterwards.
- **Removing access**: click **Disconnect** in Studio. You can also delete the app in Google Cloud or in Kick's developer settings.
