"use client";
import { Activity, Baby, Bone, Brain, Eye, Flower2, HeartPulse, Smile, Sparkles, Stethoscope } from "lucide-react";

const ICONS = { stethoscope: Stethoscope, heart: HeartPulse, sparkles: Sparkles, baby: Baby, flower: Flower2, bone: Bone, brain: Brain, activity: Activity, eye: Eye, smile: Smile };

export function SpecialtyIconClient({ name, className = "size-6" }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Stethoscope;
  return <Icon className={className} aria-hidden />;
}
