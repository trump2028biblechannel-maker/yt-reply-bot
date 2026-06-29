const { google } = require("googleapis");
const Anthropic = require("@anthropic-ai/sdk");
const express = require("express");

const app = express();
app.use(express.json());

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://yt-reply-bot-wqnz.onrender.com/oauth2callback");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const youtube = google.youtube({ version: "v3", auth: oauth2Client });

const PERSONA = `You are writing YouTube comment replies on behalf of the "Trump2028? Bible" channel (@Trump2028Bible). The channel is a BIBLICAL FACT-CHECKER that challenges and debunks prophecy claims, numerology, and lazy biblical interpretation using the full counsel of scripture. You have deep knowledge of the entire Bible and draw from any relevant passage to address the comment — not just one verse. Examples of relevant scripture by topic: For date-setting and signs: Matthew 24:36, Acts 1:7, Mark 13:32. For numerology and divination: Deuteronomy 18:10-12, Isaiah 8:19. For false prophets: Deuteronomy 18:20-22, Matthew 7:15-16, Jeremiah 23:16. For trusting your own interpretation: Proverbs 3:5-6, 2 Peter 1:20-21. For end times speculation: 2 Thessalonians 2:1-3, Revelation 22:18-19. Always pick the scripture that best fits the specific comment. Tone: Samantha Bee meets deadpan news anchor — sharp, witty, dry sarcasm with warmth. CRITICAL RULES: Never validate prophecy claims, number patterns, or signs. Always push back using the most relevant scripture for that specific comment. Keep replies 1-3 sentences max. Sound human and intellectually sharp. Use dry humor to deflate inflated claims. End with a pointed question that makes the commenter think. Never use emojis unless the original comment had them. Never start with Great comment or hollow affirmations.`;

const repliedComments = new Set();

async function getAllVideoIds() {
  const videoIds = [];
  let pageToken = null;

  do {
    const params = {
      part: "id",
      channelId: CHANNEL_ID,
      maxResults: 50,
      type: "video",
    };
    if (pageToken) params.pageToken = pageToken;

    const res = await youtube.search.list(params);
    const ids = (res.data.items || []).map((v) => v.id.videoId).filter(Boolean);
    videoIds.push(...ids);
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  console.log(`Found ${videoIds.length} total videos on channel`);
  return videoIds;
}

async function getRecentComments() {
  try {
    const videoIds = await getAllVideoIds();
    if (!videoIds.length) return [];

    const allComments = [];
    for (const videoId of videoIds) {
      try {
        const commentsRes = await youtube.commentThreads.list({
          part: "snippet",
          videoId,
          maxResults: 50,
          order: "time",
        });
        const items = commentsRes.data.items || [];
        const unanswered = items.filter((item) => {
          const authorChannelId = item.snippet.topLevelComment.snippet.authorChannelId?.value;
          const isOwnComment = authorChannelId === CHANNEL_ID;
          const hasReplies = item.snippet.totalReplyCount > 0;
          const alreadyReplied = repliedComments.has(item.id);
          return !isOwnComment && !hasReplies && !alreadyReplied;
        });
        allComments.push(...unanswered);
      } catch (e) {
        console.log(`Skipping video ${videoId}:`, e.message);
      }
    }
    return allComments;
  } catch (e) {
    console.error("Error fetching comments:", e.message);
    return [];
  }
}

async function generateReply(commentText, authorName) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: PERSONA,
    messages: [
      {
        role: "user",
        content: `Commenter: ${authorName}\nComment: "${commentText}"\n\nWrite one reply. Just the reply text, nothing else.`,
      },
    ],
  });
  return msg.content[0].text;
}

async function postReply(parentId, text) {
  await youtube.comments.insert({
    part: "snippet",
    requestBody: {
      snippet: {
        parentId,
        textOriginal: text,
      },
    },
  });
}

async function runBot() {
  console.log(`[${new Date().toISOString()}] Checking for new comments across all videos...`);
  const comments = await getRecentComments();
  console.log(`Found ${comments.length} unanswered comments from real viewers`);

  for (const thread of comments) {
    const snippet = thread.snippet.topLevelComment.snippet;
    const commentId = thread.snippet.topLevelComment.id;
    const author = snippet.authorDisplayName;
    const text = snippet.textDisplay;

    try {
      console.log(`Replying to ${author}: "${text.substring(0, 50)}..."`);
      const reply = await generateReply(text, author);
      await postReply(commentId, reply);
      repliedComments.add(thread.id);
      console.log(`✓ Posted: "${reply.substring(0, 50)}..."`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.error(`Failed to reply to ${author}:`, e.message);
    }
  }
}

app.get("/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.force-ssl"],
    prompt: "consent",
  });
  res.redirect(url);
});

app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  res.send(`
    <h2>✓ Authorization successful!</h2>
    <p>Your refresh token is:</p>
    <pre style="background:#f0f0f0;padding:20px;word-break:break-all">${tokens.refresh_token}</pre>
    <p>Copy this and add it as the <strong>YOUTUBE_REFRESH_TOKEN</strong> environment variable in Render.com</p>
  `);
});

app.get("/", (req, res) => {
  res.send("Trump2028? Bible Comment Bot is running.");
});

app.get("/run", async (req, res) => {
  await runBot();
  res.send("Bot run complete — check logs for details.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  runBot();
  setInterval(runBot, CHECK_INTERVAL_MS);
});
