export interface BrandKit {
  name: string;
  industry: string;
  toneOfVoice: string;
  brandColors: string[];
  messagingThemes: string[];
  additionalNotes: string;
  isConfigured: boolean;
}

export interface PostItem {
  id: string;
  title: string;
  platform: 'Instagram' | 'LinkedIn' | 'Twitter' | 'Facebook' | 'TikTok' | 'YouTube';
  postDate: string; // YYYY-MM-DD
  postTime: string; // HH:MM
  contentType: 'Graphics' | 'Video' | 'Text' | 'Threads' | 'Other';
  status: 'Scheduled' | 'Draft' | 'Posted' | 'Needs Asset';
  originalCopy?: string;
  suggestedCopy?: string;
  designAssetStatus?: 'Not Started' | 'In Progress' | 'Completed' | 'Not Required';
  designDueDate?: string; // YYYY-MM-DD (typically 2 days before)
  reminderSent?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  postId?: string; // If copy generation is tied to a specific calendar item
}

export interface SheetsConfig {
  sheetUrl: string;
  spreadsheetId: string;
  range: string;
  lastSyncTime?: string;
  isSynced: boolean;
}
