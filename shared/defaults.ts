import { BrandKit, PostItem, SheetsConfig } from "./types";

export function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(dateA: Date, dateB: Date): number {
  const start = new Date(dateA);
  const end = new Date(dateB);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDesignDueDate(postDate: string): string {
  const date = new Date(`${postDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return postDate;
  return toDateInputValue(addDays(date, -2));
}

export const defaultBrandKit: BrandKit = {
  name: "",
  industry: "",
  toneOfVoice: "",
  brandColors: ["#2563eb", "#14b8a6", "#f59e0b", "#0f172a"],
  messagingThemes: [],
  additionalNotes: "",
  isConfigured: false,
};

export const defaultSheetsConfig: SheetsConfig = {
  sheetUrl: "",
  spreadsheetId: "",
  range: "A1:H500",
  isSynced: false,
};

export function createSamplePosts(now = new Date()): PostItem[] {
  const firstDate = toDateInputValue(addDays(now, 1));
  const secondDate = toDateInputValue(addDays(now, 2));
  const thirdDate = toDateInputValue(addDays(now, 4));

  return [
    {
      id: "sample-1",
      title: "Launch week reminder",
      platform: "Instagram",
      postDate: firstDate,
      postTime: "09:30",
      contentType: "Graphics",
      status: "Needs Asset",
      originalCopy: "Prepare the announcement graphic and short caption for the launch week reminder.",
      designAssetStatus: "Not Started",
      designDueDate: getDesignDueDate(firstDate),
      reminderSent: false,
    },
    {
      id: "sample-2",
      title: "Founder insight post",
      platform: "LinkedIn",
      postDate: secondDate,
      postTime: "12:00",
      contentType: "Text",
      status: "Draft",
      originalCopy: "Share a practical lesson learned from the product build.",
      designAssetStatus: "Not Required",
      designDueDate: getDesignDueDate(secondDate),
      reminderSent: false,
    },
    {
      id: "sample-3",
      title: "Short-form product demo",
      platform: "TikTok",
      postDate: thirdDate,
      postTime: "18:00",
      contentType: "Video",
      status: "Scheduled",
      originalCopy: "Record a simple before-and-after walkthrough showing the core workflow.",
      designAssetStatus: "Not Required",
      designDueDate: getDesignDueDate(thirdDate),
      reminderSent: false,
    },
  ];
}
