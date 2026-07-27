import React, { useState } from "react";
import { PostItem, SheetsConfig } from "../types";
import { 
  Calendar, RefreshCw, Layers, Copy, Check, FileText, AlertTriangle, 
  Sparkles, CheckCircle2, Pin, CalendarDays, ExternalLink, HelpCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getDesignDueDate, toDateInputValue } from "../mockData";
import { SHEET_TEMPLATE_HEADERS } from "../../api/_shared/sheets";

interface CalendarViewProps {
  posts: PostItem[];
  sheetsConfig: SheetsConfig;
  onSyncSheets: (fileUrl: string) => Promise<void>;
  onSelectPost: (post: PostItem) => void;
  onAddPost: (post: Omit<PostItem, "id">) => void;
  onUpdatePostStatus: (postId: string, status: PostItem["status"]) => void;
  selectedPost: PostItem | null;
  onGenerateDesignPrompt: (post: PostItem) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  posts,
  sheetsConfig,
  onSyncSheets,
  onSelectPost,
  onAddPost,
  onUpdatePostStatus,
  selectedPost,
  onGenerateDesignPrompt
}) => {
  const [sheetUrl, setSheetUrl] = useState(sheetsConfig.sheetUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form values for a quick manual calendar addition
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState<PostItem["platform"]>("Instagram");
  const [newDate, setNewDate] = useState(toDateInputValue(new Date()));
  const [newTime, setNewTime] = useState("12:00");
  const [newContentType, setNewContentType] = useState<PostItem["contentType"]>("Graphics");
  const [newCopy, setNewCopy] = useState("");

  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      await onSyncSheets(sheetUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    onAddPost({
      title: newTitle,
      platform: newPlatform,
      postDate: newDate,
      postTime: newTime,
      contentType: newContentType,
      status: "Scheduled",
      originalCopy: newCopy,
      designAssetStatus: newContentType === "Graphics" ? "Not Started" : "Not Required",
      designDueDate: getDesignDueDate(newDate)
    });

    // Reset Form
    setNewTitle("");
    setNewCopy("");
    setShowAddForm(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const graphicsCreationReminders = posts.filter(post => {
    if (post.contentType !== "Graphics") return false;
    
    try {
      const postDate = new Date(`${post.postDate}T00:00:00`);
      const diffTime = postDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays <= 2 && diffDays >= 0 && post.designAssetStatus !== "Completed";
    } catch {
      return false;
    }
  });

  return (
    <div id="calendar-panel" className="px-4 py-3 space-y-5">
      
      {/* Dynamic Action Alerts (2 Days Graphics Design Trigger) */}
      <AnimatePresence>
        {graphicsCreationReminders.length > 0 && (
          <div className="space-y-2">
            {graphicsCreationReminders.map(post => {
              const daysLeft = Math.max(0, Math.ceil((new Date(`${post.postDate}T00:00:00`).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
              return (
                <motion.div
                  key={`alert-${post.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-amber-300">
                        Content Creation Deadline Alert!
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        <strong>"{post.title}"</strong> is scheduled to go live {daysLeft === 0 ? "today" : daysLeft === 1 ? "in 1 day" : "in 2 days"} ({post.postDate}). Since it is a <strong>Graphics Post</strong>, prepare the visual asset before posting time.
                      </p>
                      
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => onGenerateDesignPrompt(post)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" /> Plan Asset
                        </button>
                        <button
                          onClick={() => onUpdatePostStatus(post.id, "Draft")}
                          className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          Mark visual as ready
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Sheets Settings Panel */}
      <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-left">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Content Sheet Sync
          </h3>
          <span className="text-[10px] text-indigo-400 font-medium">Link Sharing Req.</span>
        </div>

        <form onSubmit={handleSyncSubmit} className="space-y-2">
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Paste public Google Sheet URL..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none transition-colors"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-slate-500 italic">
              {sheetsConfig.isSynced ? "Synced " + sheetsConfig.lastSyncTime : "Use a sheet with the template headers below"}
            </span>
            <button
              type="submit"
              disabled={isSyncing}
              className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Live"}
            </button>
          </div>
        </form>

        <div className="mt-3 flex items-start gap-1 p-2 rounded bg-indigo-950/20 border border-indigo-900/40 text-[10px] text-indigo-300 leading-normal">
          <HelpCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="flex-1">
            Share the sheet as <strong>"Anyone with the link can view"</strong>. Expected headers: {SHEET_TEMPLATE_HEADERS.join(", ")}.
          </span>
          <a
            href="/sample-calendar.csv"
            className="text-indigo-200 hover:text-white underline underline-offset-2 shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            CSV
          </a>
        </div>
      </div>

      {/* Calendar List Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5 text-indigo-400" /> Calendar Events
        </h3>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 cursor-pointer"
        >
          {showAddForm ? "View Calendar" : "+ Add Post"}
        </button>
      </div>

      {showAddForm ? (
        /* Manual Post Form */
        <form onSubmit={handleCreatePost} className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3.5 text-left">
          <h4 className="text-xs font-bold text-slate-200">New Calendar Event</h4>
          
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Post Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Skin Hydration Product Spotlight"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Platform</label>
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value as PostItem["platform"])}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-1.5 text-slate-200 text-xs focus:outline-none"
              >
                <option value="Instagram">Instagram</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Twitter">Twitter/X</option>
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Format</label>
              <select
                value={newContentType}
                onChange={(e) => setNewContentType(e.target.value as PostItem["contentType"])}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-1.5 text-slate-200 text-xs focus:outline-none"
              >
                <option value="Graphics">Graphics Image</option>
                <option value="Video">Video/Reel</option>
                <option value="Text">Pure Text/Tweet</option>
                <option value="Threads">Thread</option>
                <option value="Other">Other Media</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Post Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-1.5 text-slate-200 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Post Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-1.5 text-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Caption Outline/Note</label>
            <textarea
              value={newCopy}
              onChange={(e) => setNewCopy(e.target.value)}
              placeholder="e.g. Focus on benefits of natural hyaluronic minerals..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-slate-200 text-xs resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Create Event
          </button>
        </form>
      ) : (
        /* Calendar Schedule list output */
        <div className="space-y-2.5">
          {posts.map((post) => {
            const isSelected = selectedPost?.id === post.id;
            const isGraphicDue = post.contentType === "Graphics" && !post.reminderSent;

            return (
              <div
                key={post.id}
                className={`group p-4 bg-slate-900 hover:bg-slate-900/90 rounded-2xl border transition-all text-left relative cursor-pointer ${
                  isSelected 
                    ? "border-indigo-500 ring-1 ring-indigo-500/50 shadow-indigo-950/20 shadow-md" 
                    : "border-slate-800/80 hover:border-slate-700"
                }`}
                onClick={() => onSelectPost(post)}
              >
                {/* Platform Badge Pin */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest ${
                      post.platform === "Instagram" ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" :
                      post.platform === "LinkedIn" ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" :
                      post.platform === "Twitter" ? "bg-slate-800 text-slate-200 border border-slate-700" :
                      "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    }`}>
                      {post.platform}
                    </span>

                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      • {post.contentType}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-indigo-400">
                    {post.postDate} at {post.postTime}
                  </span>
                </div>

                {/* Post Title */}
                <h4 className="text-xs font-bold text-slate-100 group-hover:text-white transition-colors">
                  {post.title}
                </h4>

                {/* Subtitle / Asset alerts */}
                <div className="mt-2.5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 line-clamp-1 flex-1 pr-4">
                    {post.originalCopy || "Tap to set original notes/ideas"}
                  </span>
                  
                  {post.contentType === "Graphics" && (
                    <span className={`px-1.5 py-0.5 rounded shrink-0 font-medium ${
                      post.designAssetStatus === "Completed" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                    }`}>
                      🎨 Design: {post.designAssetStatus}
                    </span>
                  )}
                </div>

                {/* Copy suggested block shortcut display */}
                {isSelected && post.suggestedCopy && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3.5 pt-3.5 border-t border-slate-800 space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Active Suggested Copy</span>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(post.suggestedCopy!, post.id);
                        }}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer bg-indigo-500/10 rounded px-1.5 py-0.5 border border-indigo-500/20"
                      >
                        {copiedId === post.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Text
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-200 leading-relaxed font-sans bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 max-h-[140px] overflow-y-auto whitespace-pre-wrap select-all">
                      {post.suggestedCopy}
                    </p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
