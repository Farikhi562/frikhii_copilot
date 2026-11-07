import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { ghostLink, PageHeader } from "../../features/workspace/components/WorkspaceBits";

type Guide = { id: string; title: string; soon?: boolean; body: string[]; action?: { to: string; label: string } };

const guides: Guide[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: [
      "Overview shows your current course, a suggested next class and quick actions.",
      "My Learning lists every course and draft you have. Course Architect is where you create a new one.",
      "Want to look around first? Open the demo course. It is clearly labelled sample content and is never saved to your account.",
    ],
    action: { to: "/app/courses/demo", label: "Explore the demo course" },
  },
  {
    id: "create-course",
    title: "How to create a course",
    body: [
      "Open Course Architect and describe what you want to learn, what you want to be able to do, your current level and your study time.",
      "Answer a short diagnostic so the plan fits what you already know. Your self-reported level is only a starting estimate.",
      "Review the generated draft, edit titles and descriptions, regenerate with extra instructions if needed, then approve it to enroll.",
      "AI output can contain mistakes. Check important facts against reliable sources.",
    ],
    action: { to: "/app/courses/new", label: "Open Course Architect" },
  },
  {
    id: "roadmaps",
    title: "How learning roadmaps work",
    body: [
      "A roadmap lists modules and the classes inside them in order, with the competencies each module develops.",
      "Class status shows course order only: the first class is Available and the rest are Upcoming. It does not lock anything, and completion is not tracked yet.",
      "Lessons currently show a structured blueprint (an outline), not a fully authored lesson.",
    ],
  },
  {
    id: "tutor",
    title: "How to use the AI Tutor",
    soon: true,
    body: [
      "The tutor workspace, its six modes and the context panel are in place.",
      "The AI backend is not connected yet, so the tutor cannot answer. This guide will be completed when it is available.",
    ],
    action: { to: "/app/tutor", label: "Open tutor workspace" },
  },
  {
    id: "account",
    title: "Account and settings",
    body: [
      "Settings holds your name, learning language, theme and account actions such as password reset and sign out.",
      "Profile and learning preferences are saved to your account. The sidebar preference is saved on this device only.",
    ],
    action: { to: "/app/settings", label: "Open settings" },
  },
  {
    id: "progress",
    title: "Tracking your progress",
    soon: true,
    body: [
      "Learning Progress currently shows your plan and setup history. Study time, lessons completed and competency mastery will appear once progress tracking is built.",
    ],
    action: { to: "/app/progress", label: "Open learning progress" },
  },
];

export default function Help() {
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader eyebrow="Help & Support" title="Help & Support" description="Short guides to the workspace. Guides for features that are not available yet are marked coming soon." />
      <div className="space-y-3">
        {guides.map((g) => (
          <details key={g.id} className="group rounded-2xl border border-ink/15 bg-white/50 p-5">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 font-medium">
              <span className="text-lg">{g.title}</span>
              {g.soon && <Badge tone="neutral">Coming soon</Badge>}
            </summary>
            <div className="mt-3 space-y-3 text-ink/80">
              {g.body.map((p) => <p key={p}>{p}</p>)}
              {g.action && <Link to={g.action.to} className={ghostLink}>{g.action.label}</Link>}
            </div>
          </details>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold">Need something else?</h2>
        <p className="mt-1 text-sm text-ink/70">There is no support inbox or chat yet. Contact details will be added before public launch.</p>
      </Card>
    </div>
  );
}
