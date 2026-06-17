import { useState, useEffect } from "react";
import { MobileFrame } from "./components/MobileFrame";
import { CalendarView } from "./components/CalendarView";
import { ChatAssistant } from "./components/ChatAssistant";
import { BrandKitView } from "./components/BrandKitView";
import { defaultBrandKit, defaultPosts } from "./mockData";
import { PostItem, BrandKit, ChatMessage, SheetsConfig } from "./types";
import { 
  Calendar, MessageSquare, Sparkles, Settings, Smartphone, BellRing, 
  HelpCircle, AlertCircle, Bot, Share2, Clipboard, ShieldCheck, CheckCircle2 
} from "lucide-react";
import { motion } from "motion/react";

// Web Audio synthesizer beep for simulated push notification sound
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
    // Play an elegant rising notification pitch (D5 to A5)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); 
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); 
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    // Sound blocked by browser security policy until interaction
  }
}

export default function App() {
  // ----------------------------------------------------
  // PERSISTENCE STATE INITIALIZATION
  // ----------------------------------------------------
  
  const [posts, setPosts] = useState<PostItem[]>(() => {
    const saved = localStorage.getItem("social_posts");
    return saved ? JSON.parse(saved) : defaultPosts;
  });

  const [brandKit, setBrandKit] = useState<BrandKit>(() => {
    const saved = localStorage.getItem("brand_kit");
    return saved ? JSON.parse(saved) : defaultBrandKit;
  });

  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>(() => {
    const saved = localStorage.getItem("sheets_config");
    return saved ? JSON.parse(saved) : {
      sheetUrl: "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUYptlbs74OgvE2upms/edit",
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUYptlbs74OgvE2upms",
      range: "A1:G100",
      isSynced: true,
      lastSyncTime: "June 2, 2026, 12:00 PM"
    };
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: "alert-welcome",
        role: "model",
        text: `🤖 Hello! I am **Bestie**, your Android content copywriter & strategy companion. 
        
I've loaded a default brand identity under **Settings** (${brandKit.name}) to get us started. 

**Here is what you can do:**
1. Navigate to **Calendar** & tap on any social post inside the list to view draft copy details.
2. Tap the ✨ **AI Suggest Copy** button on a post. It fits constraints to your selected platform!
3. If a **Graphics Post is scheduled in 2 days**, our system will trigger an action reminder asking you to begin your designs! Tap the card's 🎨 **Plan Style with AI** button to get outline composition ideas here automatically!`,
        timestamp: "12:47 PM"
      }
    ];
  });

  const [activeTab, setActiveTab] = useState<"calendar" | "assistant" | "brand" | "help">("calendar");
  const [selectedPostId, setSelectedPostId] = useState<string | null>("post-3"); // Focus on graphics teaser due in 2 days by default
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    title: string;
    message: string;
    type: "schedule" | "design" | "success" | "general";
  } | null>(null);

  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);

  // Sync state to local storage on changes
  useEffect(() => {
    localStorage.setItem("social_posts", JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem("brand_kit", JSON.stringify(brandKit));
  }, [brandKit]);

  useEffect(() => {
    localStorage.setItem("sheets_config", JSON.stringify(sheetsConfig));
  }, [sheetsConfig]);

  // Initial Content-Creation Check (Trigger 2-day reminder on load)
  useEffect(() => {
    const triggerInitialAlert = () => {
      // Find post-3 (our Matcha Anti-Oxidant Cream launcher in 2 days) to demonstrate the alert
      const teaserPost = posts.find(p => p.id === "post-3");
      if (teaserPost && teaserPost.designAssetStatus !== "Completed") {
        setTimeout(() => {
          setActiveNotification({
            id: "design-alert-initial",
            title: "🎨 Start Designing Graphics Asset",
            message: `"${teaserPost.title}" goes live in 2 days! Tap or view calendar to plan layouts with Gemini.`,
            type: "design"
          });
          playNotificationBeep();
        }, 1500);
      }
    };
    triggerInitialAlert();
  }, []);

  const selectedPost = posts.find((p) => p.id === selectedPostId) || null;

  // ----------------------------------------------------
  // EVENT HANDLERS
  // ----------------------------------------------------

  // Sync with Google Sheets proxy server endpoint
  const handleSyncSheets = async (sheetUrlToSync: string) => {
    try {
      const response = await fetch("/api/sync-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: sheetUrlToSync, range: sheetsConfig.range })
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || "Sync returned invalid status");
      }

      const syncedPosts: PostItem[] = data.posts;
      setPosts(syncedPosts);
      
      setSheetsConfig({
        sheetUrl: sheetUrlToSync,
        spreadsheetId: data.spreadsheetId || "google-sheet",
        range: sheetsConfig.range,
        isSynced: true,
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ", " + new Date().toLocaleDateString()
      });

      // Push Sync Success Notification
      setActiveNotification({
        id: "sync-success",
        title: "🔄 Spreadsheet Calendar Synced",
        message: `Successfully pulled ${syncedPosts.length} post items from your Google Sheets calendar feeds.`,
        type: "success"
      });
      playNotificationBeep();

    } catch (err: any) {
      console.error(err);
      alert(`Sync Failed: ${err.message || "Make sure Spreadsheet sharing is set to 'Anyone with link can view'!"}`);
      
      // Fallback: Notify of failure
      setActiveNotification({
        id: "sync-fail",
        title: "⚠️ Sheet Sync Delayed",
        message: "Verify Link sharing and check your public Spreadsheet link format.",
        type: "general"
      });
      playNotificationBeep();
    }
  };

  // call server-side Gemini suggestion model
  const handleSuggestCopy = async (targetPost: PostItem) => {
    setIsGeneratingCopy(true);
    try {
      const response = await fetch("/api/suggest-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post: targetPost, brandKit })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Copy generation failed");
      }

      // Update post copy in state
      setPosts(prev => prev.map(p => {
        if (p.id === targetPost.id) {
          return { ...p, suggestedCopy: data.suggestedCopy };
        }
        return p;
      }));

      // Launch simulated Native Android Notification
      setActiveNotification({
        id: `copy-done-${targetPost.id}`,
        title: `✨ Social Copy Crafted`,
        message: `New tailored copy generated for "${targetPost.title}" on ${targetPost.platform}!`,
        type: "success"
      });
      playNotificationBeep();

    } catch (err: any) {
      console.error(err);
      alert(`AI Copywriting Error: ${err.message || "Endpoint error"}`);
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // Handle generic chatbot conversations with Gemini
  const handleSendMessage = async (textStr: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textStr,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setIsGeneratingChat(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          brandKit,
          currentPost: selectedPost
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Chat failed");
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "model",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "model",
          text: `⚠️ I had a temporary issue connecting to the copywriting server. Let me retry in just a second!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  // When clicking "Plan Style with AI" under 2 days graphics warning alert
  const handleGenerateDesignPrompt = (post: PostItem) => {
    setActiveTab("assistant");
    handleSendMessage(`Let's design corresponding graphic marketing asset layouts for upcoming launch post: "${post.title}". It scheduled for ${post.platform} with notes: "${post.originalCopy || ""}". Give me 3 concrete compositional, background illustration, structure, and spacing layout concept guidelines.`);
  };

  const handleUpdatePostStatus = (postId: string, newStatus: PostItem["status"]) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const designStatus = newStatus === "Draft" || newStatus === "Scheduled" ? "Completed" as const : p.designAssetStatus;
        return { ...p, status: newStatus, designAssetStatus: designStatus };
      }
      return p;
    }));

    setActiveNotification({
      id: "status-ok",
      title: "📋 Assets Draft Saved",
      message: "The graphic visual asset status was updated successfully.",
      type: "success"
    });
    playNotificationBeep();
  };

  const handleAddPost = (newPostData: Omit<PostItem, "id">) => {
    const post: PostItem = {
      ...newPostData,
      id: `manual-${Date.now()}`
    };
    setPosts(prev => [post, ...prev]);

    setActiveNotification({
      id: "post-created",
      title: "📅 New Calendar Event",
      message: `"${post.title}" scheduled for ${post.platform} successfully.`,
      type: "success"
    });
    playNotificationBeep();
  };

  // Push notification testing triggers
  const triggerManualNotificationTest = () => {
    const randomPosts = posts.filter(p => p.contentType === "Graphics");
    const p = randomPosts[Math.floor(Math.random() * randomPosts.length)] || posts[0];
    
    setActiveNotification({
      id: `test-${Date.now()}`,
      title: "🔔 Social Post Alert (Test)",
      message: `Post Reminder: "${p.title}" goes live in exactly 2 hours! Get ready to upload to ${p.platform}.`,
      type: "schedule"
    });
    playNotificationBeep();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      
      {/* LEFT: Premium Desk Presentation Control Center */}
      <div className="flex-1 max-w-xl mx-auto p-6 md:p-12 space-y-8 flex flex-col justify-center text-left">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/40 text-indigo-300 rounded-full border border-indigo-800/60 font-mono text-xs font-semibold">
            <Smartphone className="w-4 h-4 text-indigo-400" />
            <span>Responsive Android Controller</span>
          </div>

          <h1 id="app-main-header-title" className="text-3xl font-extrabold tracking-tight text-white font-sans sm:text-4xl">
            Post Nerd
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Monitor, sync, edit, and plan content with native-feeling alert systems! 
            This physical Android device preview on the right connects live to both Gemini and specified dynamic Google Sheets calendar data.
          </p>
        </div>

        {/* Post Quick Details Drawer (Desktop Hub Info) */}
        {selectedPost ? (
          <div className="p-5 bg-slate-900/90 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Focus Item</dt>
                <dd className="text-sm font-extrabold text-white">{selectedPost.title}</dd>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
                {selectedPost.platform}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Format Type</span>
                <span className="font-bold text-slate-200">{selectedPost.contentType}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Schedule Time</span>
                <span className="font-bold text-indigo-400 font-mono">{selectedPost.postDate} @ {selectedPost.postTime}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">Concept Notes</span>
              <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/50 leading-relaxed italic">
                "{selectedPost.originalCopy || "None set."}"
              </p>
            </div>

            {/* AI Call triggers with nice micro-animations */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={isGeneratingCopy}
              onClick={() => handleSuggestCopy(selectedPost)}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isGeneratingCopy ? "animate-spin" : ""}`} />
              {isGeneratingCopy ? "Generating Social Copies..." : "✨ Suggest Copy with Gemini"}
            </motion.button>
          </div>
        ) : (
          <div className="p-6 bg-slate-900/30 rounded-3xl border border-slate-800 text-center text-slate-500 text-xs italic">
            Select an event item inside the Android device calendar list on the right to focus details, request copyrights, and consult graphic motifs.
          </div>
        )}

        {/* Notification Panel Test Hub */}
        <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl flex items-center justify-between gap-4">
          <div className="text-left">
            <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">Push Dispatch Simulator</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Simulate post warnings, beeps, and schedule alerts immediately.</p>
          </div>
          <button
            onClick={triggerManualNotificationTest}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
          >
            <BellRing className="w-3.5 h-3.5" /> Test Alert
          </button>
        </div>

        {/* Simple Footnotes */}
        <div className="flex items-center gap-2 text-[11px] text-slate-600 justify-start">
          <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
          <span>Google Sheets & Gemini 3.5 fully configured. Secure server proxies enabled.</span>
        </div>
      </div>

      {/* RIGHT: Immersive Android Device Simulation */}
      <div className="flex-1 flex justify-center items-center py-4 bg-[#0a0a0b] md:border-l border-slate-900 shadow-inner">
        <MobileFrame 
          activeNotification={activeNotification}
          onDismissNotification={() => setActiveNotification(null)}
        >
          {/* Main Simulated Android OS Workspace App */}
          <div className="flex-1 flex flex-col bg-slate-950 relative min-h-0">
            
            {/* Embedded Screen App Header branding */}
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 text-left shrink-0">
              <h1 className="text-base font-extrabold text-white flex items-center gap-1.5 font-sans">
                <span className="p-1 rounded-md bg-indigo-600 text-white shrink-0"><Calendar className="w-4 h-4" /></span>
                Content Scheduler
              </h1>
              <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                {brandKit.isConfigured ? `${brandKit.name} • ${brandKit.industry}` : "Setting up Android brand kit"}
              </p>
            </div>

            {/* Sub View Screen Selector Frame */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
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

              {activeTab === "brand" && (
                <BrandKitView
                  brandKit={brandKit}
                  onSave={(updatedKit) => {
                    setBrandKit(updatedKit);
                    // Append chat message notifying copy updates
                    setChatMessages(prev => [
                      ...prev,
                      {
                        id: `system-update-${Date.now()}`,
                        role: "model",
                        text: `🔄 **Brand Kit successfully re-configured!**
* Brand Name: **${updatedKit.name}**
* Industry: **${updatedKit.industry}**
* Persona Tone: *"${updatedKit.toneOfVoice}"*

All new copyright suggestions and brainstorm sessions will automatically obey these custom constraints! Try tapping ✨ **AI Suggest Copy** or talk to me below!`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      }
                    ]);
                  }}
                />
              )}
            </div>

            {/* Immersive Phone Bottom Tab Options Menu bar */}
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
                <span>Identity</span>
              </button>
            </div>

          </div>
        </MobileFrame>
      </div>

    </div>
  );
}
