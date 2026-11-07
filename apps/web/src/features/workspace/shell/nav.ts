import { BarChart3, BookOpen, Home, LifeBuoy, MessageSquare, Settings, Sparkles, type LucideIcon } from "lucide-react";

export type AppNavItem = { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

export const mainNav: AppNavItem[] = [
  { to: "/app", label: "Overview", icon: Home, match: (p) => p === "/app" || p === "/app/" },
  {
    to: "/app/courses",
    label: "My Learning",
    icon: BookOpen,
    match: (p) => p.startsWith("/app/courses") && !p.startsWith("/app/courses/new"),
  },
  {
    to: "/app/courses/new",
    label: "Course Architect",
    icon: Sparkles,
    match: (p) => p.startsWith("/app/courses/new") || p.startsWith("/app/goals"),
  },
  { to: "/app/tutor", label: "AI Tutor", icon: MessageSquare, match: (p) => p.startsWith("/app/tutor") },
  { to: "/app/progress", label: "Learning Progress", icon: BarChart3, match: (p) => p.startsWith("/app/progress") },
];

export const secondaryNav: AppNavItem[] = [
  { to: "/app/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/app/settings") },
  { to: "/app/help", label: "Help & Support", icon: LifeBuoy, match: (p) => p.startsWith("/app/help") },
];
