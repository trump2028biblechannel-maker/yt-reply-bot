# Trump2028? Bible — YouTube Comment Auto-Reply Bot

## Deploy to Render.com

### Step 1 — Push to GitHub
1. Go to github.com and create a new repository called "yt-reply-bot"
2. Upload both files (index.js and package.json) to that repo

### Step 2 — Create Render Web Service
1. Go to render.com and click "New" → "Web Service"
2. Connect your GitHub repo
3. Settings:
   - Name: yt-reply-bot
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node index.js

### Step 3 — Add Environment Variables in Render
Add these under "Environment":
- YOUTUBE_CLIENT_ID → your Google Cloud OAuth Client ID
- YOUTUBE_CLIENT_SECRET → your Google Cloud OAuth Client Secret
- ANTHROPIC_API_KEY → your Anthropic API key
- YOUTUBE_CHANNEL_ID → your YouTube channel ID (starts with UC...)
- YOUTUBE_REFRESH_TOKEN → get this in Step 4

### Step 4 — Get Your Refresh Token (one time only)
1. After deploying, visit: https://your-app-name.onrender.com/auth
2. Sign in with your Trump2028 Bible Google account
3. Allow all permissions
4. Copy the refresh token shown on screen
5. Add it as YOUTUBE_REFRESH_TOKEN in Render environment variables
6. Click "Manual Deploy" to redeploy

### Done!
The bot will now:
- Check for new unanswered comments every hour
- Generate replies using Claude in your channel voice
- Post replies automatically to YouTube
- Never expire — refresh tokens last forever
