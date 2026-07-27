import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, BrandKit, PostItem } from "../types";
import { Send, Sparkles, MessageSquare, Bot, User, BrainCircuit, Lightbulb, ImagePlay } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatAssistantProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  brandKit: BrandKit;
  selectedPost: PostItem | null;
  isGenerating: boolean;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  onSendMessage,
  brandKit,
  selectedPost,
  isGenerating
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isGenerating) return;
    onSendMessage(promptText);
  };

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Suggestions depending on if a post is active
  const suggestedPills = selectedPost
    ? [
        { label: "🎨 Design Motif Ideas", prompt: `Give me concrete design, layout, composition, and color strategy ideas for the visual graphic of this post: "${selectedPost.title}"` },
        { label: "🎯 Catchy Hook Ideas", prompt: `Give me 3 viral copywriting hook suggestions for my upcoming post: "${selectedPost.title}".` },
        { label: "🐦 Twist into Twitter post", prompt: `Rewrite our suggested copy for "${selectedPost.title}" into a highly clickable, clear 280-char Tweet.` }
      ]
    : [
        { label: "💡 5 Skincare Wellness Ideas", prompt: "Brainstorm 5 engaging post topics for our social media content. Include suggested platform and visual type." },
        { label: "📣 Promo Launch Outline", prompt: "Generate a strategic launch sequence calendar structure for promoting a premium new organic skincare lotion." },
        { label: "🍂 Define autumn theme vibes", prompt: "Help me write messaging theme variations suitable for autumn/fall wellness product aesthetics." }
      ];

  return (
    <div id="chat-assistant-container" className="flex-1 flex flex-col h-full bg-slate-950 font-sans">
      
      {/* Header Context Indicator */}
      <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 text-left shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                Bestie
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </h3>
              <p className="text-[10px] text-slate-400">Optional AI planning assistant</p>
            </div>
          </div>

          {selectedPost && (
            <div className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-950/40 text-indigo-300 border border-indigo-900 flex items-center gap-1 max-w-[180px] truncate">
              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" /> Focus: {selectedPost.title}
            </div>
          )}
        </div>
      </div>

      {/* Message Feed Canvas */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isBot = msg.role === "model";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex gap-2.5 max-w-[85%] text-left ${isBot ? "" : "ml-auto flex-row-reverse"}`}
              >
                {/* User/Bot Avatar */}
                <div className={`p-1.5 rounded-lg shrink-0 h-8 w-8 flex items-center justify-center border ${
                  isBot 
                    ? "bg-slate-900 border-slate-800 text-indigo-400" 
                    : "bg-indigo-600 border-indigo-500 text-white"
                }`}>
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className="space-y-1">
                  <div className={`p-3 rounded-2xl text-[12px] leading-relaxed select-text ${
                    isBot 
                      ? "bg-slate-900 border border-slate-800 text-slate-100" 
                      : "bg-indigo-600 text-white rounded-tr-none"
                  }`}>
                    {/* Render message with line breaks support */}
                    <div className="whitespace-pre-wrap select-text markdown-body">
                      {msg.text}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 block px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isGenerating && (
          <div className="flex items-center gap-2.5 max-w-[80%] text-left">
            <div className="p-1.5 rounded-lg shrink-0 h-8 w-8 flex items-center justify-center border bg-slate-900 border-slate-800 text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Carousel Pills */}
      <div className="px-3 py-1.5 border-t border-slate-900 bg-slate-950 flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar shrink-0 select-none">
        {suggestedPills.map((pill, idx) => (
          <button
            key={`pill-${idx}`}
            onClick={() => handleQuickPrompt(pill.prompt)}
            disabled={isGenerating}
            className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-900 hover:bg-indigo-950/40 text-slate-300 border border-slate-800 hover:border-indigo-500/40 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar wrapper */}
      <div className="p-3 bg-slate-900 border-t border-slate-850 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isGenerating}
            placeholder={
              selectedPost 
                ? `Ask me to design or write for "${selectedPost.title}"...` 
                : "Ask about brand kits, copywriting..."
            }
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-3 pr-10 py-2 text-slate-200 text-xs focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:bg-slate-800"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

    </div>
  );
};
