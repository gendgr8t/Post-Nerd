import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily to prevent crashing on boot if key is missing
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in environment variables. Gemini features will fail.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// Simple Helper to Parse CSV text safely
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  const rows = text.split(/\r?\n/);
  for (const row of rows) {
    if (!row.trim()) continue;
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cols.push(current.replace(/^"|"$/g, "").trim());
        current = "";
      } else {
        current += char;
      }
    }
    cols.push(current.replace(/^"|"$/g, "").trim());
    lines.push(cols);
  }
  return lines;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Server health check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

/**
 * Endpoint to sync a Google Sheet via its export-to-csv link
 * Overcomes CORS constraints and provides server-side normalization
 */
app.post("/api/sync-sheets", async (req, res) => {
  const { sheetUrl, range } = req.body;

  if (!sheetUrl) {
    return res.status(400).json({ error: "sheetUrl is required" });
  }

  try {
    // Extract Spreadsheet ID from Google Sheet Url
    // Matches patterns like: /spreadsheets/d/([a-zA-Z0-9-_]+)
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: "Invalid Google Sheet URL format" });
    }
    const spreadsheetId = match[1];

    // Construct CSV export endpoint
    // Optional sheet parameters or gid, default to export most relevant sheet
    let exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    
    // Check if user specified a gid or sheet id in the url
    const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
    if (gidMatch) {
      exportUrl += `&gid=${gidMatch[1]}`;
    }

    console.log(`Fetching spreadsheet data from: ${exportUrl}`);

    const response = await fetch(exportUrl);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch spreadsheet. Please verify that link sharing is enabled with "Anyone with link can view".`
      });
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return res.json({ posts: [], message: "Spreadsheet fetched successfully but is empty or lacks data" });
    }

    // Capture header row and normalize columns
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const dataRows = rows.slice(1);

    const mappedPosts = dataRows.map((row, index) => {
      // Find indexes of main columns
      const getVal = (keywords: string[], fallbackVal = "") => {
        const foundIdx = headers.findIndex(h => keywords.some(kw => h.includes(kw)));
        return (foundIdx !== -1 && row[foundIdx]) ? row[foundIdx] : fallbackVal;
      };

      const title = getVal(["title", "topic", "post title", "headline", "item"], `Post #${index + 1}`);
      const rawPlatform = getVal(["platform", "channel", "network", "media"], "Instagram");
      const postDate = getVal(["date", "day", "calendar date"], new Date().toISOString().split("T")[0]);
      const postTime = getVal(["time", "hour", "schedule time"], "12:00");
      const rawContentType = getVal(["type", "content type", "format"], "Graphics");
      const rawStatus = getVal(["status", "state"], "Scheduled");
      const originalCopy = getVal(["copy", "caption", "text", "description", "original copy"], "");

      // Normalize platforms
      let platform = "Instagram";
      const pf = rawPlatform.toLowerCase();
      if (pf.includes("linked")) platform = "LinkedIn";
      else if (pf.includes("twit") || pf.includes("x")) platform = "Twitter";
      else if (pf.includes("face")) platform = "Facebook";
      else if (pf.includes("tik")) platform = "TikTok";
      else if (pf.includes("youtube") || pf.includes("yt")) platform = "YouTube";

      // Normalize content types
      let contentType = "Graphics";
      const ct = rawContentType.toLowerCase();
      if (ct.includes("vid") || ct.includes("reel") || ct.includes("short")) contentType = "Video";
      else if (ct.includes("text") || ct.includes("tweet")) contentType = "Text";
      else if (ct.includes("thread")) contentType = "Threads";

      // Normalize statuses
      let status = "Scheduled";
      const st = rawStatus.toLowerCase();
      if (st.includes("draft")) status = "Draft";
      else if (st.includes("posted") || st.includes("done")) status = "Posted";
      else if (st.includes("need") || st.includes("asset") || ct.includes("graphic")) status = "Needs Asset";

      // Calculate design due date (2 days before)
      let designDueDate = postDate;
      try {
        const d = new Date(postDate);
        d.setDate(d.getDate() - 2);
        designDueDate = d.toISOString().split("T")[0];
      } catch (e) {
        // Fallback
      }

      return {
        id: `row-${index + 1}`,
        title,
        platform,
        postDate,
        postTime,
        contentType,
        status,
        originalCopy,
        designAssetStatus: contentType === "Graphics" ? "Not Started" : "Not Required",
        designDueDate,
        reminderSent: false
      };
    });

    res.json({
      spreadsheetId,
      posts: mappedPosts,
      rowCount: mappedPosts.length,
      lastSync: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Sheets sync error:", error);
    res.status(500).json({ error: error.message || "Failed to process spreadsheet URL" });
  }
});

/**
 * AI API for copywriting suggestions
 */
app.post("/api/suggest-copy", async (req, res) => {
  const { post, brandKit } = req.body;

  if (!post) {
    return res.status(400).json({ error: "Post details are required" });
  }

  try {
    const ai = getGemini();
    
    const brandKitPrompt = brandKit && brandKit.isConfigured
      ? `Brand Info:
- Name: ${brandKit.name}
- Industry: ${brandKit.industry}
- Tone of Voice: ${brandKit.toneOfVoice}
- Messaging Themes: ${brandKit.messagingThemes.join(", ")}
- Custom Brand Directives: ${brandKit.additionalNotes}`
      : "No custom brand kit supplied. Use standard professional, engaging, and friendly brand copy guidelines.";

    const systemPrompt = `You are an expert social media copywriter and content strategist. 
Your goal is to write a highly engaging social media caption or copy tailored specifically for the selected platform's unique culture and technical limits:
- Twitter/X: Clear, punchy, handles threads elegantly, maximum 280 characters unless specified, uses hashtags sparsely (1-2 max).
- LinkedIn: Professional, educational, with deep insights, formatting with bullet points or space, encourages dialogue/comments.
- Instagram: Visual hooks, light-hearted or inspiring tone, friendly, spaces for hashtags at the very bottom.
- Facebook: Relatable, engaging, clear call-to-action, good for community building.
- YouTube/TikTok: Short, hook-heavy desc or outline of script content.

${brandKitPrompt}

Produce only the final optimized suggested post content. Do not include any meta-introductions or explanations like "Here is your copy". Just output the beautiful social media post itself ready to be copied.`;

    const userPrompt = `Generate a creative and optimized social media post caption for the following:
- Topic/Title: ${post.title}
- Platform: ${post.platform}
- Content Type: ${post.contentType}
- Current Draft/Idea Notes: ${post.originalCopy || "None provided"}

Write copy matching our established brand kit and tone of voice rules. Include relevant hooks, formatted sections if necessary, and exactly 2-3 customized hashtags.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.75,
      }
    });

    res.json({
      suggestedCopy: response.text || "Failed to generate suggested copy"
    });

  } catch (error: any) {
    console.error("Gemini copy suggestion error:", error);
    res.status(500).json({ error: error.message || "AI copywriter is temporarily unavailable" });
  }
});

/**
 * AI Brand assistant conversation bot chat endpoint
 */
app.post("/api/chat", async (req, res) => {
  const { messages, brandKit, currentPost } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array are required" });
  }

  try {
    const ai = getGemini();

    const brandKitPrompt = brandKit && brandKit.isConfigured
      ? `Brand Context:
- Name: ${brandKit.name}
- Industry: ${brandKit.industry}
- Tone of Voice: ${brandKit.toneOfVoice}
- Branding Themes: ${brandKit.messagingThemes.join(", ")}
- Brand Directives: ${brandKit.additionalNotes}`
      : "Standard general copywriting modes.";

    const activePostPrompt = currentPost
      ? `The user is currently tailoring copy for an upcoming post titled "${currentPost.title}" scheduled for ${currentPost.platform} (${currentPost.contentType}).`
      : "";

    const systemPrompt = `You are 'Bestie', a warm, structured, and resourceful content planning partner.
Your core expertise is:
1. Help the user configure or refine their Brand Kit, Tone of Voice, and themes.
2. Formulate high-quality social media copy matching their goals.
3. Suggest content topics, formats (e.g. Graphics, Video), and plan content schedules.
4. Give action plans or graphic design asset ideas (such as layout, stock visual concepts, caption ideas) whenever Graphics design content needs to be built.

Keep your tone professional, brief, encouraging, and supportive. Use light markdown.

${brandKitPrompt}
${activePostPrompt}`;

    // Format historical messages for Gemini SDK
    // Gemini roles: 'user', 'model'
    const formattedContents = messages.slice(-10).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({
      reply: response.text || "I was unable to construct a reply."
    });

  } catch (error: any) {
    console.error("Gemini Chat error:", error);
    res.status(500).json({ error: error.message || "Interactive partner is disconnected" });
  }
});


// ----------------------------------------------------
// VITE & STATIC FILES FOR FULL-STACK CONTEXT
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
