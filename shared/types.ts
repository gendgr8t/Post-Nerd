export interface BrandKit {
  name: string;
  industry: string;
  toneOfVoice: string;
  brandColors: string[];
  messagingThemes: string[];
  additionalNotes: string;
  isConfigured: boolean;
}

export type Platform = "Instagram" | "LinkedIn" | "Twitter" | "Facebook" | "TikTok" | "YouTube";
export type ContentType = "Graphics" | "Video" | "Text" | "Threads" | "Other";
export type PostStatus = "Scheduled" | "Draft" | "Posted" | "Needs Asset";
export type DesignAssetStatus = "Not Started" | "In Progress" | "Completed" | "Not Required";

export interface PostItem {
  id: string;
  title: string;
  platform: Platform;
  postDate: string;
  postTime: string;
  contentType: ContentType;
  status: PostStatus;
  originalCopy?: string;
  suggestedCopy?: string;
  designAssetStatus?: DesignAssetStatus;
  designDueDate?: string;
  reminderSent?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  postId?: string;
}

export interface SheetsConfig {
  sheetUrl: string;
  spreadsheetId: string;
  range: string;
  lastSyncTime?: string;
  isSynced: boolean;
}

export interface AppState {
  posts: PostItem[];
  brandKit: BrandKit;
  sheetsConfig: SheetsConfig;
  notificationsEnabled: boolean;
  vapidPublicKey?: string;
}

export interface ToastNotice {
  id: string;
  title: string;
  message: string;
  type: "schedule" | "design" | "success" | "general" | "error";
}
