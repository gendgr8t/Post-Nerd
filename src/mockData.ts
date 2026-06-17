import { BrandKit, PostItem } from "./types";

// Dynamic Date calculation helpers to keep mock data relative to the current live date (2026-06-02)
const getRelativeDateString = (offsetDays: number): string => {
  const baseDate = new Date("2026-06-02");
  baseDate.setDate(baseDate.getDate() + offsetDays);
  return baseDate.toISOString().split("T")[0];
};

export const defaultBrandKit: BrandKit = {
  name: "GlowUp Organics",
  industry: "Clean Skincare & Wellness",
  toneOfVoice: "Warm, empathetic, expert, and encouraging",
  brandColors: ["#4F6F52", "#739072", "#ECEE81", "#3A4D39"],
  messagingThemes: [
    "Eco-friendly skincare ingredients",
    "Mindful Morning routines",
    "Self-love and body positivity",
    "De-bunking beauty industry chemical myths"
  ],
  additionalNotes: "We love sharing scientific facts in warm, friendly layman terms. Always emphasize skincare as holistic self-care rather than superficial aesthetics. Keep our messaging inclusive and gentle.",
  isConfigured: true
};

export const defaultPosts: PostItem[] = [
  {
    id: "post-1",
    title: "Eco-Friendly Morning Glow Routine",
    platform: "Instagram",
    postDate: getRelativeDateString(0), // Today (2026-06-02)
    postTime: "14:30",
    contentType: "Graphics",
    status: "Scheduled",
    originalCopy: "Share our primary 3-step morning routine using only bio-degradable products. Emphasis on sustainable packaging and starting with clean water.",
    suggestedCopy: "☀️ Wake up your skin, gently. 🌱\n\nStarting your morning shouldn't just feel good for you—it should feel gentle on our planet. Our 3-Step Morning Glow Routine centers natural, vegan hydration with zero microplastics or heavy formulas.\n\n1️⃣ Refresh with pure Rosewater hydration\n2️⃣ Plump with our Organic Hyaluronic Serum\n3️⃣ Secure moisture with the Botanical Radiance Lotion\n\nAll nestled in our fully compostable glass vessels. How are you pampering your skin today?\n\n#GlowUpWellness #CleanBeautyRoutine #SustainableLiving #MindfulMorning",
    designAssetStatus: "Completed",
    designDueDate: getRelativeDateString(-2)
  },
  {
    id: "post-2",
    title: "Debunking 3 Common Mineral Oil Myths",
    platform: "LinkedIn",
    postDate: getRelativeDateString(1), // Tomorrow
    postTime: "09:00",
    contentType: "Text",
    status: "Draft",
    originalCopy: "Write a professional insight explaining why mineral oils are clogging skin pores and how natural cold-pressed sunflower oils act as breathable alternatives. Cite clean beauty statistics.",
    designAssetStatus: "Not Required",
    designDueDate: getRelativeDateString(-1)
  },
  {
    id: "post-3",
    title: "Teaser: The New Matcha Anti-Oxidant Cream",
    platform: "Twitter",
    postDate: getRelativeDateString(2), // In 2 Days - Graphics Content! (Will prompt user to customize/design!)
    postTime: "16:00",
    contentType: "Graphics",
    status: "Needs Asset",
    originalCopy: "Teaser alert! We are launching something green, refreshing, and deeply restorative in two days. Guess the ingredient!",
    designAssetStatus: "Not Started",
    designDueDate: getRelativeDateString(0) // Design is due today! (triggers alert)
  },
  {
    id: "post-4",
    title: "Holistic Wellness Afternoon Routine",
    platform: "Facebook",
    postDate: getRelativeDateString(4), // In 4 Days
    postTime: "11:00",
    contentType: "Video",
    status: "Scheduled",
    originalCopy: "Video walking through a quick midday workplace neck stretch and facial mist rejuvenation technique. Encourage office desks breaks.",
    designAssetStatus: "Not Required",
    designDueDate: getRelativeDateString(2)
  },
  {
    id: "post-5",
    title: "10-Sec ASMR Serum Dropper Visuals",
    platform: "TikTok",
    postDate: getRelativeDateString(5), // In 5 days
    postTime: "18:30",
    contentType: "Video",
    status: "Draft",
    originalCopy: "Aesthetic slow-mo audio clip of serum dropping onto glowing skin surface. Focus on high physical clarity and soothing rain background sounds.",
    designAssetStatus: "Not Required",
    designDueDate: getRelativeDateString(3)
  }
];
