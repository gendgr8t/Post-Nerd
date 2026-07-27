import { FormEvent, useEffect, useMemo, useState } from "react";
import { MobileFrame } from "./components/MobileFrame";
import { CalendarView } from "./components/CalendarView";
import { ChatAssistant } from "./components/ChatAssistant";
import { BrandKitView } from "./components/BrandKitView";
import { defaultBrandKit, defaultSheetsConfig } from "./mockData";
import { AppState, BrandKit, ChatMessage, PostItem, SheetsConfig, ToastNotice } from "./types";
import { Calendar, MessageSquare, Sparkles, Settings, BellRing, ShieldCheck, Database, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

function playNotificationBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Browser sound stays muted until the user has interacted with the page.
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as any).error) {
    const error = new Error((data as any).error || "Request failed.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

interface User {
  id: number;
  email: string;
  name: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit>(defaultBrandKit);
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(defaultSheetsConfig);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | undefined>();
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [activeTab, setActiveTab] = useState<"calendar" | "assistant" | "brand">("calendar");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeNotification, setActiveNotification] = useState<ToastNotice | null>(null);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: "Hi, I am Bestie. I can help plan posting schedules, prepare captions, and turn upcoming graphics posts into concrete asset briefs.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || posts[0] || null,
    [posts, selectedPostId],
  );

  const notify = (notice: Omit<ToastNotice, "id">) => {
    setActiveNotification({ ...notice, id: `${notice.type}-${Date.now()}` });
    playNotificationBeep();
  };

  const loadState = async () => {
    setIsLoadingState(true);
    try {
      const me = await readJson<{ user: User | null }>(await fetch("/api/auth/me"));
      if (!me.user) {
        setUser(null);
        setPosts([]);
        return;
      }
      setUser(me.user);
      const state = await readJson<AppState>(await fetch("/api/state"));
      setPosts(state.posts);
      setBrandKit(state.brandKit);
      setSheetsConfig(state.sheetsConfig);
      setNotificationsEnabled(state.notificationsEnabled);
      setVapidPublicKey(state.vapidPublicKey);
      setSelectedPostId((current) => current || state.posts[0]?.id || null);
    } catch (error: any) {
      if (error.status === 401) {
        setUser(null);
        return;
      }
      notify({
        title: "Could not load workspace",
        message: error.message || "Check the database connection and refresh.",
        type: "error",
      });
    } finally {
      setIsLoadingState(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmittingAuth(true);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await readJson<{ user: User }>(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
        }),
      );
      setUser(data.user);
      notify({
        title: authMode === "login" ? "Welcome back" : "Account created",
        message: `Signed in as ${data.user.name}.`,
        type: "success",
      });
      await loadState();
    } catch (error: any) {
      notify({
        title: authMode === "login" ? "Login failed" : "Registration failed",
        message: error.message || "Please check your details and try again.",
        type: "error",
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
    setPosts([]);
    setSelectedPostId(null);
    notify({ title: "Signed out", message: "Your planner is protected again.", type: "success" });
  };

  useEffect(() => {
    if (isLoadingState || posts.length === 0) return;
    const today = new Date();
    const duePost = posts.find((post) => {
      if (post.contentType !== "Graphics" || post.designAssetStatus === "Completed") return false;
      const postDate = new Date(`${post.postDate}T00:00:00`);
      const diffDays = Math.ceil((postDate.getTime() - today.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 2;
    });

    if (duePost) {
      const timer = window.setTimeout(() => {
        notify({
          title: "Visual asset due soon",
          message: `"${duePost.title}" is close to publishing. Prepare the graphic before posting time.`,
          type: "design",
        });
      }, 800);
      return () => window.clearTimeout(timer);
    }
  }, [isLoadingState, posts]);

  const handleSyncSheets = async (sheetUrlToSync: string) => {
    try {
      const data = await readJson<{
        posts: PostItem[];
        sheetsConfig: SheetsConfig;
        rowCount: number;
      }>(
        await fetch("/api/sync-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetUrl: sheetUrlToSync, range: sheetsConfig.range }),
        }),
      );

      setPosts(data.posts);
      setSheetsConfig(data.sheetsConfig);
      setSelectedPostId(data.posts[0]?.id || null);
      notify({
        title: "Sheet synced",
        message: `Imported ${data.rowCount} calendar item${data.rowCount === 1 ? "" : "s"} from Google Sheets.`,
        type: "success",
      });
    } catch (error: any) {
      notify({
        title: "Sheet sync failed",
        message: error.message || "Check sharing permissions and column names.",
        type: "error",
      });
      throw error;
    }
  };

  const handleSuggestCopy = async (targetPost: PostItem) => {
    setIsGeneratingCopy(true);
    try {
      const data = await readJson<{ suggestedCopy: string; post: PostItem }>(
        await fetch("/api/suggest-copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post: targetPost, brandKit }),
        }),
      );

      setPosts((current) => current.map((post) => (post.id === targetPost.id ? data.post : post)));
      notify({
        title: "Copy drafted",
        message: `A caption draft was saved for "${targetPost.title}".`,
        type: "success",
      });
    } catch (error: any) {
      notify({
        title: "Copy assistant unavailable",
        message: error.message || "Gemini is optional for reminders, so the calendar still works.",
        type: "error",
      });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleSendMessage = async (textStr: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textStr,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setIsGeneratingChat(true);

    try {
      const data = await readJson<{ reply: string }>(
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updatedMessages, brandKit, currentPost: selectedPost }),
        }),
      );

      setChatMessages((current) => [
        ...current,
        {
          id: `bot-${Date.now()}`,
          role: "model",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (error: any) {
      setChatMessages((current) => [
        ...current,
        {
          id: `bot-err-${Date.now()}`,
          role: "model",
          text: error.message || "The assistant is offline, but your calendar reminders still work.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  const handleGenerateDesignPrompt = (post: PostItem) => {
    setActiveTab("assistant");
    handleSendMessage(
      `Create a practical visual asset brief for "${post.title}" on ${post.platform}. Notes: "${post.originalCopy || ""}". Include layout, image direction, copy placement, and production checklist.`,
    );
  };

  const handleUpdatePostStatus = async (postId: string, newStatus: PostItem["status"]) => {
    const currentPost = posts.find((post) => post.id === postId);
    const designAssetStatus =
      currentPost?.contentType === "Graphics" && (newStatus === "Draft" || newStatus === "Scheduled")
        ? "Completed"
        : currentPost?.designAssetStatus;

    try {
      const data = await readJson<{ post: PostItem }>(
        await fetch("/api/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: postId, patch: { status: newStatus, designAssetStatus } }),
        }),
      );
      setPosts((current) => current.map((post) => (post.id === postId ? data.post : post)));
      notify({
        title: "Post updated",
        message: `"${data.post.title}" is now marked ${data.post.status}.`,
        type: "success",
      });
    } catch (error: any) {
      notify({ title: "Could not update post", message: error.message || "Try again.", type: "error" });
    }
  };

  const handleAddPost = async (newPostData: Omit<PostItem, "id">) => {
    try {
      const data = await readJson<{ post: PostItem }>(
        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPostData),
        }),
      );
      setPosts((current) => [data.post, ...current]);
      setSelectedPostId(data.post.id);
      notify({
        title: "Post created",
        message: `"${data.post.title}" was added to the calendar.`,
        type: "success",
      });
    } catch (error: any) {
      notify({ title: "Could not create post", message: error.message || "Try again.", type: "error" });
    }
  };

  const handleSaveBrandKit = async (updatedKit: BrandKit) => {
    try {
      const data = await readJson<{ brandKit: BrandKit }>(
        await fetch("/api/brand-kit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedKit),
        }),
      );
      setBrandKit(data.brandKit);
      notify({ title: "Brand kit saved", message: "Future copy and briefs will use this profile.", type: "success" });
    } catch (error: any) {
      notify({ title: "Could not save brand kit", message: error.message || "Try again.", type: "error" });
    }
  };

  const triggerManualNotificationTest = () => {
    const p = selectedPost || posts[0];
    if (!p) {
      notify({ title: "No posts yet", message: "Add or sync a post before testing reminders.", type: "general" });
      return;
    }

    notify({
      title: "Posting reminder",
      message: `"${p.title}" is scheduled for ${p.platform} on ${p.postDate} at ${p.postTime}.`,
      type: "schedule",
    });
  };

  const subscribeToPushNotifications = async () => {
    try {
      if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Browser push is not available in this environment.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      await readJson<{ ok: boolean }>(
        await fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription }),
        }),
      );

      notify({
        title: "Browser reminders enabled",
        message: "This browser can now receive scheduled posting notifications.",
        type: "success",
      });
    } catch (error: any) {
      notify({
        title: "Could not enable reminders",
        message: error.message || "Check browser notification permissions.",
        type: "error",
      });
    }
  };

  if (!user && !isLoadingState) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <MobileFrame activeNotification={activeNotification} onDismissNotification={() => setActiveNotification(null)}>
          <div className="flex-1 flex flex-col bg-slate-950 px-6 py-8">
            <div className="space-y-2 mb-8 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/40 text-indigo-300 rounded-full border border-indigo-800/60 font-mono text-xs font-semibold">
                <Database className="w-4 h-4" />
                Multi-user planner
              </div>
              <h1 className="text-2xl font-extrabold text-white">Post Nerd</h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in to sync your own calendar, track your schedule, and receive posting reminders.
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 mb-5">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === "login" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold ${authMode === "register" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-left">
              {authMode === "register" && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Name</label>
                  <input
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    placeholder="Your name"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {isSubmittingAuth ? "Please wait..." : authMode === "login" ? "Login" : "Create Account"}
              </button>
            </form>
          </div>
        </MobileFrame>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <div className="flex-1 max-w-xl mx-auto p-6 md:p-12 space-y-8 flex flex-col justify-center text-left">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/40 text-indigo-300 rounded-full border border-indigo-800/60 font-mono text-xs font-semibold">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Database-backed planner</span>
          </div>

          <h1 id="app-main-header-title" className="text-3xl font-extrabold tracking-tight text-white font-sans sm:text-4xl">
            Post Nerd
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Sync a Google Sheets content calendar, track what is ready, and get reminded before each post needs to go live.
          </p>
          {user && (
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4">
              Signed in as {user.name}. Log out
            </button>
          )}
        </div>

        {selectedPost ? (
          <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Focused Post</dt>
                <dd className="text-sm font-extrabold text-white">{selectedPost.title}</dd>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
                {selectedPost.platform}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Format</span>
                <span className="font-bold text-slate-200">{selectedPost.contentType}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Posting Time</span>
                <span className="font-bold text-indigo-400 font-mono">
                  {selectedPost.postDate} @ {selectedPost.postTime}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">Notes</span>
              <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/50 leading-relaxed italic">
                "{selectedPost.originalCopy || "No notes yet."}"
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={isGeneratingCopy}
              onClick={() => handleSuggestCopy(selectedPost)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isGeneratingCopy ? "animate-spin" : ""}`} />
              {isGeneratingCopy ? "Drafting..." : "Draft Caption"}
            </motion.button>
          </div>
        ) : (
          <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-800 text-center text-slate-500 text-xs italic">
            {isLoadingState ? "Loading your planner..." : "Sync a sheet or add your first post to begin."}
          </div>
        )}

        <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl flex items-center justify-between gap-4">
          <div className="text-left">
            <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">Reminder Test</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Send a local banner to preview how posting reminders appear.</p>
          </div>
          <button
            onClick={triggerManualNotificationTest}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
          >
            <BellRing className="w-3.5 h-3.5" /> Test
          </button>
        </div>

        {notificationsEnabled && (
          <button
            onClick={subscribeToPushNotifications}
            className="w-full py-2.5 rounded-xl bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-xs font-bold transition-colors"
          >
            Enable Browser Reminders
          </button>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-600 justify-start">
          <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
          <span>
            {notificationsEnabled ? "Push keys detected. Browser subscription is ready to wire." : "Calendar, database, and sheet sync are active."}
          </span>
        </div>
      </div>

      <div className="flex-1 flex justify-center items-center py-4 bg-[#0a0a0b] md:border-l border-slate-900 shadow-inner">
        <MobileFrame activeNotification={activeNotification} onDismissNotification={() => setActiveNotification(null)}>
          <div className="flex-1 flex flex-col bg-slate-950 relative min-h-0">
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 text-left shrink-0">
              <h1 className="text-base font-extrabold text-white flex items-center gap-1.5 font-sans">
                <span className="p-1 rounded-md bg-indigo-600 text-white shrink-0">
                  <Calendar className="w-4 h-4" />
                </span>
                Content Calendar
              </h1>
              <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                {brandKit.isConfigured ? `${brandKit.name} • ${brandKit.industry}` : "Set up your brand kit when ready"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
              {isLoadingState ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  Loading planner
                </div>
              ) : (
                <>
                  {activeTab === "calendar" && (
                    <CalendarView
                      posts={posts}
                      sheetsConfig={sheetsConfig}
                      onSyncSheets={handleSyncSheets}
                      onSelectPost={(post) => setSelectedPostId(post.id)}
                      onAddPost={handleAddPost}
                      onUpdatePostStatus={handleUpdatePostStatus}
                      selectedPost={selectedPost}
                      onGenerateDesignPrompt={handleGenerateDesignPrompt}
                    />
                  )}

                  {activeTab === "assistant" && (
                    <ChatAssistant
                      messages={chatMessages}
                      onSendMessage={handleSendMessage}
                      brandKit={brandKit}
                      selectedPost={selectedPost}
                      isGenerating={isGeneratingChat}
                    />
                  )}

                  {activeTab === "brand" && <BrandKitView brandKit={brandKit} onSave={handleSaveBrandKit} />}
                </>
              )}
            </div>

            <div className="h-[58px] bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 select-none z-20">
              <button
                onClick={() => setActiveTab("calendar")}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                  activeTab === "calendar" ? "text-indigo-400" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span>Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab("assistant")}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                  activeTab === "assistant" ? "text-indigo-400" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Assistant</span>
              </button>

              <button
                onClick={() => setActiveTab("brand")}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                  activeTab === "brand" ? "text-indigo-400" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>Brand</span>
              </button>
            </div>
          </div>
        </MobileFrame>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
