# Set up your own YouTube and Kick apps

Bubblecast is free and open source, and it runs entirely on your computer. There is no Bubblecast server in the middle. To sign in to YouTube and Kick through their official APIs, each streamer registers their own free app with Google and with Kick, and then pastes its keys into Bubblecast.

This is what keeps Bubblecast free for everyone. YouTube gives each Google app 10,000 API units a day. If every streamer shared one app, a handful of busy streams would use it up for everybody. With your own app, the quota is only yours.

Each setup takes about 10 minutes and only has to be done once. Twitch and TikTok need nothing here.

Your keys are saved only on your computer, in `.local/app-keys.json`. Bubblecast sends them only to Google or Kick, when you sign in. Never share your client secret or post it online.

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

1. Open **APIs & Services → Credentials** (or **Google Auth Platform → Clients**).
2. Click **Create credentials → OAuth client ID**.
3. Choose **Desktop app** as the application type, give it a name and click **Create**.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) and the **Client secret**.

### 5. Connect in Bubblecast

1. Open Bubblecast Studio at http://127.0.0.1:3927 and go to **Connections**.
2. In the YouTube card, open **Your Google app**, paste the client ID and client secret, and click **Save Google app**.
3. Click **Connect YouTube**, sign in with your channel's Google account and allow access.

## Kick

You need a Kick account. Use the account you stream with, so Bubblecast sends chat as you.

### 1. Create the Kick app

1. Sign in at [kick.com](https://kick.com), open **Settings → Developer** and create a new app.
2. Give it a name (for example `Bubblecast`). A description and icon are optional.
3. Set the **Redirect URL** to exactly:

   ```
   http://localhost:3927/oauth/kick/callback
   ```

4. Turn on these permissions (scopes):
   - **Read user information** (`user:read`)
   - **Read channel information** (`channel:read`)
   - **Write to chat** (`chat:write`)

   Leave webhooks off. Bubblecast doesn't use them.
5. Save the app, then copy its **Client ID** and **Client secret**.

### 2. Connect in Bubblecast

1. In Studio, go to **Connections** and open **Your Kick app** in the Kick card.
2. Paste the client ID and client secret, and click **Save Kick app**.
3. Click **Connect Kick**, sign in to Kick if asked and approve the permissions.

Once connected, Bubblecast sends your Kick messages and reads your Kick viewer count through the API. Kick chat is still read from Kick's public chat, as before.

Kick has no API for polls. To run Kick polls from Bubblecast, also click **Sign in for polls** in the Kick card and sign in to Kick in the window that opens.

## Troubleshooting

- **"Add your … app first"**: the keys aren't saved yet. Paste both the client ID and the client secret, then click Save.
- **YouTube: "Google hasn't verified this app"**: expected for your own app. Click **Advanced → Go to … (unsafe)**.
- **YouTube: "access_denied" or "not a test user"**: add your channel's Google account as a test user, or publish the app (step 3.6).
- **YouTube: signed out after a week**: the consent screen is still in Testing. Publish it.
- **YouTube: "quota is used up"**: your project's daily 10,000 units ran out. It resets at midnight Pacific time. Sending a chat message costs 20 units, so heavy sending uses it fastest.
- **Kick: sign-in stops at an error page about the redirect**: the redirect URL in your Kick app must match `http://localhost:3927/oauth/kick/callback` exactly, with no trailing slash.
- **Switching to a different app**: save the new keys. Bubblecast signs you out of the old app automatically, so connect again afterwards.
- **Removing access**: click **Disconnect** in Studio. You can also delete the app in Google Cloud or in Kick's developer settings.
