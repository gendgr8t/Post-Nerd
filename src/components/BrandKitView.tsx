import React, { useState } from "react";
import { BrandKit } from "../types";
import { Sparkles, Save, Landmark, MessageSquare, ListTodo, AlignLeft } from "lucide-react";
import { motion } from "motion/react";

interface BrandKitViewProps {
  brandKit: BrandKit;
  onSave: (kit: BrandKit) => void;
}

export const BrandKitView: React.FC<BrandKitViewProps> = ({ brandKit, onSave }) => {
  const [name, setName] = useState(brandKit.name);
  const [industry, setIndustry] = useState(brandKit.industry);
  const [tone, setTone] = useState(brandKit.toneOfVoice);
  const [themes, setThemes] = useState(brandKit.messagingThemes.join(", "));
  const [notes, setNotes] = useState(brandKit.additionalNotes);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedKit: BrandKit = {
      name,
      industry,
      toneOfVoice: tone,
      brandColors: brandKit.brandColors, // Retain colors
      messagingThemes: themes.split(",").map(t => t.trim()).filter(Boolean),
      additionalNotes: notes,
      isConfigured: true
    };
    onSave(updatedKit);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div id="brand-kit-panel" className="px-5 py-4 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-100 font-sans tracking-tight">Android Brand Kit Setup</h2>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Set up your content identity variables here. These guidelines will act as the master prompt constraints for Gemini when generating social copies.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Brand Name */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5 text-indigo-400" /> Brand / Account Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Rise Fitness Studio"
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none transition-colors"
            required
          />
        </div>

        {/* Niche/Industry */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <ListTodo className="w-3.5 h-3.5 text-indigo-400" /> Industry/Niche Focus
          </label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g., Fitness & Holistic Health Coaching"
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none transition-colors"
            required
          />
        </div>

        {/* Tone of Voice */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Copywriting Tone of Voice
          </label>
          <textarea
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g., Motivating, authoritative, authentic, and empathetic. Avoid dry jargon."
            rows={2}
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none transition-colors resize-none leading-relaxed"
            required
          />
        </div>

        {/* Core Themes */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <ListTodo className="w-3.5 h-3.5 text-indigo-400" /> Messaging Themes (Comma Separated)
          </label>
          <input
            type="text"
            value={themes}
            onChange={(e) => setThemes(e.target.value)}
            placeholder="e.g., Quick morning exercises, Mindset tips"
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none transition-colors"
            required
          />
        </div>

        {/* Custom Directives */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <AlignLeft className="w-3.5 h-3.5 text-indigo-400" /> Additional Style Constraints
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Always end with exactly 3 handpicked hashtags. Never use emojis."
            rows={3}
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none transition-colors resize-none leading-relaxed"
          />
        </div>

        {/* Save button with motion dynamic response */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={isSaved}
          className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer ${
            isSaved 
              ? "bg-emerald-600 text-white" 
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {isSaved ? (
            <>Saving Complete!</>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Identity Settings
            </>
          )}
        </motion.button>
      </form>

      {/* Brand Identity Card representation */}
      <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-950 text-left">
        <h4 className="text-xs font-semibold text-indigo-400 mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Brand Vector Preset
        </h4>
        <p className="text-[11px] text-slate-300 leading-relaxed italic">
          "Gemini copy suggestion models are locked into the active guidelines profile: {name || "None"} in the {industry || "None"} sector. Core messaging revolves around theme keywords: {themes || "None"}"
        </p>
      </div>
    </div>
  );
};
