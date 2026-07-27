import { asyncHandler, HandlerRequest, HandlerResponse, requireMethod } from "./http";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./auth";
import {
  authenticateUser,
  createUser,
  getDueReminderPosts,
  getAppState,
  getPushSubscriptions,
  getUserById,
  markReminderSent,
  patchPost,
  replacePosts,
  savePushSubscription,
  setBrandKit,
  setSheetsConfig,
  upsertPost,
} from "./db";
import { getGemini, getGeminiModel } from "./gemini";
import { BrandKit, ChatMessage, PostItem } from "./types";
import { getCsvExportUrl, mapSheetRowsToPosts, parseCSV, SHEET_TEMPLATE_HEADERS } from "./sheets";
import { getDesignDueDate } from "./defaults";
import webPush from "web-push";

function nowLabel(): string {
  return new Date().toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const healthHandler = asyncHandler(async (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

async function requireUserId(req: HandlerRequest, res: HandlerResponse): Promise<number | null> {
  const userId = readSessionToken(req);
  if (!userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return null;
  }

  const user = await getUserById(userId);
  if (!user) {
    res.status(401).json({ error: "Your session is no longer valid. Please log in again." });
    return null;
  }

  return user.id;
}

export const meHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["GET"])) return;
  const userId = readSessionToken(req);
  const user = userId ? await getUserById(userId) : null;
  res.json({ user });
});

export const registerHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const { email, password, name } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    res.status(400).json({ error: "Use an email and a password with at least 8 characters." });
    return;
  }

  try {
    const user = await createUser(email, password, name || "");
    setSessionCookie(res, user.id);
    res.json({ user });
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw error;
  }
});

export const loginHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const { email, password } = req.body || {};
  const user = email && password ? await authenticateUser(email, password) : null;
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  setSessionCookie(res, user.id);
  res.json({ user });
});

export const logoutHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  clearSessionCookie(res);
  res.json({ ok: true });
});

export const stateHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["GET"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  res.json(await getAppState(userId));
});

export const brandKitHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["PUT"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const brandKit = req.body as BrandKit;
  if (!brandKit) {
    res.status(400).json({ error: "Brand kit payload is required." });
    return;
  }
  res.json({ brandKit: await setBrandKit(userId, { ...brandKit, isConfigured: true }) });
});

export const postsHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST", "PATCH"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;

  if (req.method === "POST") {
    const post = req.body as PostItem;
    if (!post?.title) {
      res.status(400).json({ error: "Post title is required." });
      return;
    }

    const saved = await upsertPost(userId, {
      ...post,
      id: post.id || `manual-${Date.now()}`,
      designDueDate: post.designDueDate || getDesignDueDate(post.postDate),
      reminderSent: post.reminderSent ?? false,
    });
    res.json({ post: saved });
    return;
  }

  const { id, patch } = req.body || {};
  if (!id || !patch) {
    res.status(400).json({ error: "Post id and patch are required." });
    return;
  }
  res.json({ post: await patchPost(userId, id, patch) });
});

export const syncSheetsHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST", "GET"])) return;

  if (req.method === "GET") {
    res.json({
      templateHeaders: SHEET_TEMPLATE_HEADERS,
      sampleRows: [
        ["Launch announcement", "Instagram", "2026-08-01", "10:00", "Graphics", "Needs Asset", "Announce the new feature", "Not Started"],
        ["Founder lesson", "LinkedIn", "2026-08-02", "12:30", "Text", "Draft", "Share a practical lesson", "Not Required"],
      ],
    });
    return;
  }

  const userId = await requireUserId(req, res);
  if (!userId) return;

  const { sheetUrl, range } = req.body || {};
  if (!sheetUrl) {
    res.status(400).json({ error: "Paste a public Google Sheet URL before syncing." });
    return;
  }

  const exportInfo = getCsvExportUrl(sheetUrl);
  if (!exportInfo) {
    res.status(400).json({ error: "That does not look like a valid Google Sheets URL." });
    return;
  }

  const response = await fetch(exportInfo.exportUrl);
  if (!response.ok) {
    res.status(response.status).json({
      error: "Could not download the sheet. Set sharing to 'Anyone with the link can view' and try again.",
    });
    return;
  }

  const csvText = await response.text();
  const posts = mapSheetRowsToPosts(parseCSV(csvText));
  if (posts.length === 0) {
    res.status(400).json({
      error: `The sheet downloaded, but no post rows were found. Use these headers: ${SHEET_TEMPLATE_HEADERS.join(", ")}.`,
    });
    return;
  }

  const savedPosts = await replacePosts(userId, posts);
  const config = await setSheetsConfig(userId, {
    sheetUrl,
    spreadsheetId: exportInfo.spreadsheetId,
    range: range || "A1:H500",
    isSynced: true,
    lastSyncTime: nowLabel(),
  });

  res.json({
    spreadsheetId: exportInfo.spreadsheetId,
    posts: savedPosts,
    rowCount: savedPosts.length,
    sheetsConfig: config,
    lastSync: new Date().toISOString(),
  });
});

export const suggestCopyHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { post, brandKit } = req.body || {};

  if (!post) {
    res.status(400).json({ error: "Post details are required." });
    return;
  }

  const ai = getGemini();
  const brandKitPrompt = brandKit?.isConfigured
    ? `Brand Info:
- Name: ${brandKit.name}
- Industry: ${brandKit.industry}
- Tone of Voice: ${brandKit.toneOfVoice}
- Messaging Themes: ${(brandKit.messagingThemes || []).join(", ")}
- Custom Brand Directives: ${brandKit.additionalNotes}`
    : "No custom brand kit supplied. Use concise, practical, platform-aware copy.";

  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Write ready-to-post social copy for:
- Title: ${post.title}
- Platform: ${post.platform}
- Content Type: ${post.contentType}
- Notes: ${post.originalCopy || "None provided"}

${brandKitPrompt}

Return only the final copy. Keep it useful, specific, and formatted for the platform.`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.75,
    },
  });

  const saved = await patchPost(userId, post.id, { suggestedCopy: response.text || "" });
  res.json({ suggestedCopy: saved.suggestedCopy, post: saved });
});

export const chatHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { messages, brandKit, currentPost } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array is required." });
    return;
  }

  const ai = getGemini();
  const configuredKit = brandKit as BrandKit | undefined;
  const formattedContents = (messages as ChatMessage[]).slice(-10).map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.text }],
  }));

  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: formattedContents,
    config: {
      temperature: 0.7,
      systemInstruction: `You are Bestie, a concise content planning assistant.
Help with posting schedules, reminders, caption drafts, and visual preparation.
${configuredKit?.isConfigured ? `Brand: ${configuredKit.name}. Industry: ${configuredKit.industry}. Tone: ${configuredKit.toneOfVoice}.` : ""}
${currentPost ? `Current post: ${currentPost.title} for ${currentPost.platform} on ${currentPost.postDate}.` : ""}`,
    },
  });

  res.json({ reply: response.text || "I could not create a reply." });
});

export const pushSubscribeHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const subscription = req.body?.subscription || req.body;
  if (!subscription?.endpoint) {
    res.status(400).json({ error: "A browser push subscription is required." });
    return;
  }
  await savePushSubscription(userId, subscription.endpoint, subscription);
  res.json({ ok: true });
});

export const runRemindersHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["GET", "POST"])) return;

  const cronSecret = process.env.CRON_SECRET;
  const authorization = String((req as any).headers?.authorization || "");
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized reminder run." });
    return;
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    res.status(400).json({ error: "VAPID push environment variables are not configured." });
    return;
  }

  webPush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const [subscriptions, duePosts] = await Promise.all([getPushSubscriptions(), getDueReminderPosts()]);
  let sent = 0;

  for (const post of duePosts) {
    const payload = JSON.stringify({
      title: post.contentType === "Graphics" && post.designAssetStatus !== "Completed" ? "Visual asset due" : "Time to post",
      body: `${post.title} - ${post.platform} - ${post.postDate} ${post.postTime}`,
      url: process.env.APP_URL || "/",
    });

    const postUserId = (post as PostItem & { userId?: number }).userId;
    const userSubscriptions = subscriptions.filter((subscription) => !postUserId || subscription.user_id === postUserId);
    const deliveries = await Promise.allSettled(
      userSubscriptions.map((subscription) => webPush.sendNotification(subscription.subscription, payload)),
    );
    const successfulDeliveries = deliveries.filter((delivery) => delivery.status === "fulfilled").length;
    sent += successfulDeliveries;
    if (successfulDeliveries > 0) {
      await markReminderSent(post.id);
    }
  }

  res.json({ ok: true, duePosts: duePosts.length, subscriptions: subscriptions.length, sent });
});
