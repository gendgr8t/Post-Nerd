import { ContentType, DesignAssetStatus, Platform, PostItem, PostStatus } from "./types.ts";
import { getDesignDueDate, toDateInputValue } from "./defaults.ts";

export const SHEET_TEMPLATE_HEADERS = [
  "Title",
  "Platform",
  "Post Date",
  "Post Time",
  "Content Type",
  "Status",
  "Original Copy",
  "Design Asset Status",
];

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current.trim());
      current = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function extractSpreadsheetId(sheetUrl: string): string | null {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function getCsvExportUrl(sheetUrl: string): { spreadsheetId: string; exportUrl: string } | null {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return null;

  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
  url.searchParams.set("format", "csv");

  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  if (gidMatch) url.searchParams.set("gid", gidMatch[1]);

  return { spreadsheetId, exportUrl: url.toString() };
}

function firstMatchingValue(headers: string[], row: string[], keywords: string[], fallback = ""): string {
  const index = headers.findIndex((header) => keywords.some((keyword) => header.includes(keyword)));
  return index >= 0 && row[index] ? row[index].trim() : fallback;
}

function normalizePlatform(value: string): Platform {
  const platform = value.toLowerCase();
  if (platform.includes("linked")) return "LinkedIn";
  if (platform.includes("twit") || platform === "x") return "Twitter";
  if (platform.includes("face")) return "Facebook";
  if (platform.includes("tik")) return "TikTok";
  if (platform.includes("youtube") || platform.includes("yt")) return "YouTube";
  return "Instagram";
}

function normalizeContentType(value: string): ContentType {
  const type = value.toLowerCase();
  if (type.includes("video") || type.includes("reel") || type.includes("short")) return "Video";
  if (type.includes("thread")) return "Threads";
  if (type.includes("text") || type.includes("tweet")) return "Text";
  if (type.includes("graphic") || type.includes("image") || type.includes("carousel")) return "Graphics";
  return "Other";
}

function normalizeStatus(value: string, contentType: ContentType): PostStatus {
  const status = value.toLowerCase();
  if (status.includes("posted") || status.includes("done") || status.includes("published")) return "Posted";
  if (status.includes("draft")) return "Draft";
  if (status.includes("asset") || status.includes("design") || status.includes("need")) return "Needs Asset";
  if (contentType === "Graphics") return "Needs Asset";
  return "Scheduled";
}

function normalizeDesignStatus(value: string, contentType: ContentType, status: PostStatus): DesignAssetStatus {
  if (contentType !== "Graphics") return "Not Required";
  const designStatus = value.toLowerCase();
  if (designStatus.includes("complete") || designStatus.includes("ready") || status === "Posted") return "Completed";
  if (designStatus.includes("progress") || designStatus.includes("draft")) return "In Progress";
  return "Not Started";
}

export function mapSheetRowsToPosts(rows: string[][]): PostItem[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.toLowerCase().trim());
  const today = toDateInputValue(new Date());

  return rows.slice(1).map((row, index) => {
    const title = firstMatchingValue(headers, row, ["title", "topic", "headline", "item"], `Post ${index + 1}`);
    const platform = normalizePlatform(firstMatchingValue(headers, row, ["platform", "channel", "network"], "Instagram"));
    const postDate = firstMatchingValue(headers, row, ["post date", "date", "day"], today);
    const postTime = firstMatchingValue(headers, row, ["post time", "time", "hour"], "12:00");
    const contentType = normalizeContentType(firstMatchingValue(headers, row, ["content type", "type", "format"], "Graphics"));
    const status = normalizeStatus(firstMatchingValue(headers, row, ["status", "state"], ""), contentType);
    const originalCopy = firstMatchingValue(headers, row, ["original copy", "copy", "caption", "text", "notes", "description"], "");
    const designAssetStatus = normalizeDesignStatus(
      firstMatchingValue(headers, row, ["design asset status", "asset status", "design status"], ""),
      contentType,
      status,
    );

    return {
      id: `sheet-row-${index + 1}`,
      title,
      platform,
      postDate,
      postTime,
      contentType,
      status,
      originalCopy,
      designAssetStatus,
      designDueDate: getDesignDueDate(postDate),
      reminderSent: false,
    };
  });
}
