import React, { useState, useEffect } from "react";
import { Wifi, Signal, Battery, Bell, CheckCircle2, ChevronRight, Sparkles, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MobileFrameProps {
  children: React.ReactNode;
  activeNotification: {
    id: string;
    title: string;
    message: string;
    type: "schedule" | "design" | "success" | "general";
  } | null;
  onDismissNotification: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  activeNotification,
  onDismissNotification,
}) => {
  const [time, setTime] = useState("12:47");

  useEffect(() => {
    // Keep time matching the simulation metadata or real time
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, "0");
      setTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center items-center py-6 px-4 bg-slate-900/40 min-h-screen">
      {/* Outer Phone Shell Case */}
      <div 
        id="phone-shell-container"
        className="relative w-full max-w-[420px] h-[860px] bg-[#0c0d0e] rounded-[52px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] p-[12px] border-4 border-slate-800/80 ring-12 ring-slate-950 flex flex-col overflow-hidden"
      >
        {/* Sleek Speaker Ear Piece & Camera Punch Hole */}
        <div className="absolute top-[20px] left-1/2 -translate-x-1/2 w-[140px] h-[30px] bg-[#000000] rounded-b-2xl z-50 flex items-center justify-center">
          {/* Subtle Speaker Line */}
          <div className="w-[45px] h-[4px] bg-slate-800 rounded-full mb-[8px]" />
          {/* Camera Lens */}
          <div className="absolute right-[25px] bottom-[10px] w-[8px] h-[8px] bg-slate-900 ring-2 ring-slate-800 rounded-full" />
        </div>

        {/* Inner Phone Screen Panel */}
        <div className="relative flex-1 bg-slate-950 rounded-[42px] overflow-hidden flex flex-col border border-slate-900">
          
          {/* Android Status Bar */}
          <div className="h-[44px] bg-slate-900 flex items-center justify-between px-7 pt-4 text-xs text-slate-100/90 font-medium select-none z-40">
            <span>{time}</span>
            <div className="flex items-center gap-2">
              <Signal className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <div className="flex items-center gap-1">
                <Battery className="w-4 h-4 text-emerald-400 fill-emerald-500/20" />
                <span className="text-[10px]">98%</span>
              </div>
            </div>
          </div>

          {/* Floating Android Notification Push Center */}
          <div className="absolute top-[52px] left-4 right-4 z-[999]">
            <AnimatePresence>
              {activeNotification && (
                <motion.div
                  initial={{ opacity: 0, y: -40, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.95 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex items-start gap-3 relative cursor-pointer active:scale-98 text-left"
                  onClick={onDismissNotification}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    activeNotification.type === "design" 
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                      : activeNotification.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  }`}>
                    {activeNotification.type === "design" ? (
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    ) : activeNotification.type === "success" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Bell className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                        {activeNotification.type === "design" ? "📋 Creation Alert" : "📱 Social Post Alert"}
                      </span>
                      <span className="text-[10px] text-slate-400">now</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 truncate">
                      {activeNotification.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                      {activeNotification.message}
                    </p>
                    {activeNotification.type === "design" && (
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] border border-amber-500/20 font-medium">
                        <Sparkles className="w-3 h-3" /> Opens creative prompt
                      </div>
                    )}
                  </div>

                  {/* Dismiss Dot Indicator */}
                  <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actual Active Application Window */}
          <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar relative">
            {children}
          </div>

          {/* Android Screen Bottom Navigation Assist */}
          <div className="h-[32px] bg-slate-950 flex items-center justify-center gap-[60px] pb-3 select-none z-30">
            {/* Back Button */}
            <div className="w-[14px] h-[14px] border-2 border-slate-600 rounded-sm rotate-45 cursor-pointer active:border-indigo-400 transition-colors" />
            {/* Home Pill */}
            <div className="w-[45px] h-[8px] bg-slate-600 rounded-full cursor-pointer active:bg-indigo-400 transition-colors" />
            {/* Multitasking Square */}
            <div className="w-[12px] h-[12px] border-2 border-slate-600 rounded-sm cursor-pointer active:border-indigo-400 transition-colors" />
          </div>

        </div>
      </div>
    </div>
  );
};
