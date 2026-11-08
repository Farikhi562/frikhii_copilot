import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Card, ContentGrid, SectionHeader } from "../../components/ui/Layout";
import { Tabs } from "../../components/ui/Nav";
import { messageForApiError } from "../../features/course/api/course";
import { useCourses } from "../../features/course/hooks/useCourse";
import {
  useCorrectInsight,
  useGenerateInsights,
  useIntelligence,
  useResetIntelligence,
  useSavePreferences,
} from "../../features/intelligence/hooks";
import type { CourseIntelligence, Insight, Preferences } from "../../features/intelligence/schemas";
import { CompetencyMap, statusText } from "../../features/intelligence/components/CompetencyMap";
import { accentLink, ghostLink, PageHeader } from "../../features/workspace/components/WorkspaceBits";

const btn = "inline-flex items-center rounded-full border border-ink/25 px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-50";
const field = "w-full rounded-lg border border-ink/25 bg-white px-3 py-2";
const pct = (v: number) => `${Math.round(v * 100)}%`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const certainty = (c: number) => (c >= 0.75 ? "high" : c >= 0.45 ? "medium" : "low");

export default function Intelligence() {
  const query = useIntelligence();
  const coursesQuery = useCourses();
  const titles = useMemo(() => new Map((coursesQuery.data ?? []).map((c) => [c.id, c.title])), [coursesQuery.data]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("profile");
  const data = query.data;
  const course: CourseIntelligence | undefined = data?.courses.find((c) => c.course_id === selected) ?? data?.courses[0];
  const order = useMemo(() => {
    if (!course) return [];
    const known = new Set(course.competencies.map((c) => c.competency));
    Object.entries(course.prerequisites).forEach(([k, v]) => [k, ...v].forEach((n) => known.add(n)));
    return Array.from(known);
  }, [course]);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="My Learning Intelligence"
        title="How you are learning"
        description="Built only from your recorded attempts. Nothing here is guessed, and you can correct or delete any of it."
      />
      {query.error && <Alert variant="error" title="Could not load your learning intelligence">{messageForApiError(query.error)}</Alert>}
      {query.isLoading ? (
        <ContentGrid cols={3}>{[0, 1, 2].map((i) => <Card key={i}><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-16 w-full" /></Card>)}</ContentGrid>
      ) : (
        data && (
          <>
            {data.courses.length > 1 && (
              <label className="block max-w-sm text-sm">
                <span className="font-medium">Course</span>
                <select className={field + " mt-1"} value={course?.course_id} onChange={(e) => setSelected(e.target.value)}>
                  {data.courses.map((c) => <option key={c.course_id} value={c.course_id}>{titles.get(c.course_id) ?? "Course"}</option>)}
                </select>
              </label>
            )}
            {!course && (
              <EmptyState
                title="No learning evidence yet"
                hint="Your profile starts building after you complete exercises or assessments in a course. Until then there is nothing to analyse, and FRIKHII will not guess. You can still set your preferences below."
                action={<Link to="/app/courses" className={accentLink}>Go to My Learning</Link>}
              />
            )}
            <Tabs
              value={course || tab === "profile" ? tab : "profile"}
              onValueChange={setTab}
              tabs={[
                { value: "profile", label: "Profile", content: <ProfileTab prefs={data.preferences} /> },
                ...(course
                  ? [
                      { value: "strengths", label: "Strengths", content: <StrengthsTab course={course} /> },
                      { value: "improve", label: "Areas to improve", content: <ImproveTab course={course} /> },
                      { value: "map", label: "Competency map", content: <CompetencyMap order={order} prerequisites={course.prerequisites} records={course.competencies} /> },
                      { value: "next", label: "Recommendations", content: <NextTab course={course} title={titles.get(course.course_id)} /> },
                      { value: "evolution", label: "Evolution", content: <EvolutionTab course={course} /> },
                    ]
                  : []),
              ]}
            />
            <PrivacyCard />
          </>
        )
      )}
    </div>
  );
}

function ProfileTab({ prefs }: { prefs: Preferences }) {
  const save = useSavePreferences();
  const [form, setForm] = useState<Preferences>(prefs);
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(form); };
  return (
    <form onSubmit={submit} className="space-y-5">
      <SectionHeader title="Learning profile" description="These are your choices, not conclusions. The AI tutor uses them to shape explanations. You can change them any time." />
      <ContentGrid cols={2}>
        <Select label="Explanation style" value={form.explanation_style} onChange={(v) => set("explanation_style", v as Preferences["explanation_style"])} options={{ simple: "Simple, plain language", balanced: "Balanced", technical: "Technical and precise" }} />
        <Select label="Examples" value={form.example_style} onChange={(v) => set("example_style", v as Preferences["example_style"])} options={{ practical: "Practical", visual: "Visual", analogy: "Analogies", mixed: "A mix" }} />
        <Select label="Pace" value={form.pace} onChange={(v) => set("pace", v as Preferences["pace"])} options={{ slow: "Slow and thorough", steady: "Steady", fast: "Fast" }} />
        <Select label="Language" value={form.preferred_language} onChange={(v) => set("preferred_language", v as Preferences["preferred_language"])} options={{ "en-US": "English", "id-ID": "Bahasa Indonesia" }} />
        <label className="block text-sm"><span className="font-medium">Minutes per day (optional)</span>
          <input className={field + " mt-1"} type="number" min={5} max={720} value={form.daily_study_minutes ?? ""} onChange={(e) => set("daily_study_minutes", e.target.value === "" ? null : Number(e.target.value))} /></label>
        <span />
        <label className="block text-sm"><span className="font-medium">Short-term target</span>
          <textarea className={field + " mt-1"} rows={2} maxLength={500} value={form.short_term_target} onChange={(e) => set("short_term_target", e.target.value)} /></label>
        <label className="block text-sm"><span className="font-medium">Long-term target</span>
          <textarea className={field + " mt-1"} rows={2} maxLength={500} value={form.long_term_target} onChange={(e) => set("long_term_target", e.target.value)} /></label>
      </ContentGrid>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={accentLink} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save preferences"}</button>
        {save.isSuccess && <span role="status" className="text-sm text-ink/70">Saved.</span>}
      </div>
      {save.error && <Alert variant="error" title="Could not save">{messageForApiError(save.error)}</Alert>}
    </form>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <label className="block text-sm"><span className="font-medium">{label}</span>
      <select className={field + " mt-1"} value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
  );
}

function StrengthsTab({ course }: { course: CourseIntelligence }) {
  const strong = course.competencies.filter((c) => (c.status === "proficient" || c.status === "mastered") && !c.regression);
  const insights = course.insights.filter((i) => i.status === "active" && (i.kind === "strength" || i.kind === "strategy"));
  return (
    <div className="space-y-6">
      <SectionHeader title="My strengths" description="A strength needs several attempts, not one good answer." />
      {strong.length === 0 ? (
        <EmptyState title="No demonstrated strengths yet" hint="A competency appears here after at least three scored attempts show consistently solid results." />
      ) : (
        <ContentGrid cols={2}>
          {strong.map((c) => (
            <Card key={c.competency}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{c.competency}</h3><Badge tone={c.status === "mastered" ? "lime" : "blue"}>{statusText(c.status)}</Badge>
              </div>
              <p className="mt-2 text-sm text-ink/70">Estimated {pct(c.mastery)} from {c.attempts} attempts; {c.correct_attempts} at 70% or above. Confidence in this estimate: {certainty(c.confidence)}.</p>
              <Sparkline points={c.accuracy_history.map((p) => p.mastery)} label={`Estimated mastery of ${c.competency} over ${c.attempts} attempts`} />
            </Card>
          ))}
        </ContentGrid>
      )}
      <InsightList insights={insights} courseId={course.course_id} />
    </div>
  );
}

function ImproveTab({ course }: { course: CourseIntelligence }) {
  const open = course.knowledge_gaps.filter((g) => g.status !== "resolved");
  const mistakes = course.competencies.flatMap((c) => c.common_mistakes.filter((m) => m.count >= 2).map((m) => ({ ...m, competency: c.competency })));
  return (
    <div className="space-y-6">
      <SectionHeader title="Areas to improve" description="Each item cites the evidence behind it. A gap closes once your recent results recover." />
      {open.length === 0 ? (
        <EmptyState title="No open knowledge gaps" hint="Nothing in your recorded attempts currently points to a repeated difficulty." />
      ) : (
        <div className="space-y-3">
          {open.map((g) => (
            <Card key={g.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{g.competency}</h3>
                <Badge tone={g.status === "improving" ? "blue" : g.severity === "high" ? "danger" : "warning"}>{g.status === "improving" ? "Improving" : `${g.severity} priority`}</Badge>
                <span className="font-mono text-xs text-ink/60">opened {day(g.opened_at)} · confidence {certainty(g.confidence)}</span>
              </div>
              <p className="mt-2 text-sm">{g.evidence_summary}</p>
              {g.cause === "prerequisite" && g.prerequisites.length > 0 && <p className="mt-1 text-sm text-ink/70">Likely linked to earlier foundations: {g.prerequisites.join(", ")}.</p>}
              {g.unverified_prerequisites.length > 0 && <p className="mt-1 text-sm text-ink/70">Not yet checked: {g.unverified_prerequisites.join(", ")}.</p>}
              <p className="mt-2 text-sm font-medium">Suggested next step: <span className="font-normal">{g.recommendation}</span></p>
              <p className="mt-1 font-mono text-xs text-ink/60">Based on {g.evidence_event_ids.length} recorded attempt{g.evidence_event_ids.length === 1 ? "" : "s"}</p>
            </Card>
          ))}
        </div>
      )}
      {mistakes.length > 0 && (
        <div>
          <h3 className="font-semibold">Recurring mistakes</h3>
          <ul className="mt-2 space-y-1 text-sm">{mistakes.map((m) => <li key={m.competency + m.tag}>{m.competency}: {m.tag} <span className="text-ink/60">({m.count} times)</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

function NextTab({ course, title }: { course: CourseIntelligence; title?: string }) {
  const gen = useGenerateInsights();
  return (
    <div className="space-y-6">
      <SectionHeader title="Personalised recommendations" description={title ? `For ${title}. Every recommendation says why.` : "Every recommendation says why."} />
      {course.recommendations.length === 0 ? (
        <EmptyState title="No recommendations yet" hint="Recommendations appear once there is evidence to base them on." />
      ) : (
        <ol className="space-y-3">
          {course.recommendations.map((r, i) => (
            <li key={r.kind + r.competency + i}><Card>
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-ink/60">{i + 1}</span><h3 className="font-semibold">{r.title}</h3><Badge tone="neutral">{r.kind.replace(/_/g, " ")}</Badge></div>
              <p className="mt-1 text-sm text-ink/80">{r.reason}</p>
            </Card></li>
          ))}
        </ol>
      )}
      {course.reviews.length > 0 && (
        <div>
          <h3 className="font-semibold">Scheduled reviews</h3>
          <ul className="mt-2 space-y-1 text-sm">{course.reviews.map((r) => <li key={r.competency}>{r.competency}: due {day(r.due_at)} <span className="text-ink/60">(every {r.interval_days} days at this stage)</span></li>)}</ul>
        </div>
      )}
      <div className="rounded-2xl border border-ink/15 p-4">
        <h3 className="font-semibold">AI-written insights</h3>
        <p className="mt-1 text-sm text-ink/70">Optional. The AI reads your recorded attempts and suggests patterns. Each one must cite real attempts, and anything that does not is discarded. Check them before relying on them.</p>
        <button type="button" className={btn + " mt-3"} disabled={gen.isPending} onClick={() => gen.mutate(course.course_id)}>{gen.isPending ? "Analysing…" : "Generate AI insights"}</button>
        {gen.data && <p role="status" className="mt-2 text-sm">{gen.data.message ?? `${gen.data.stored} insight${gen.data.stored === 1 ? "" : "s"} added${gen.data.rejected ? `, ${gen.data.rejected} discarded for lacking evidence` : ""}.`}</p>}
        {gen.error && <Alert variant="warning" title="AI insights are unavailable right now">{messageForApiError(gen.error)}</Alert>}
      </div>
      <InsightList insights={course.insights.filter((i) => i.status === "active" && i.source === "ai")} courseId={course.course_id} />
    </div>
  );
}

function EvolutionTab({ course }: { course: CourseIntelligence }) {
  const resolved = course.knowledge_gaps.filter((g) => g.status === "resolved");
  const regressed = course.competencies.filter((c) => c.regression);
  return (
    <div className="space-y-6">
      <SectionHeader title="Learning evolution" description="How your results have changed over time." />
      {course.competencies.length === 0 ? (
        <EmptyState title="No history yet" hint="Your timeline begins with your first scored attempt." />
      ) : (
        <ContentGrid cols={2}>
          {course.competencies.map((c) => {
            const first = c.accuracy_history[0]?.mastery ?? 0;
            const delta = c.mastery - first;
            return (
              <Card key={c.competency}>
                <h3 className="font-semibold">{c.competency}</h3>
                <Sparkline points={c.accuracy_history.map((p) => p.mastery)} label={`Estimated mastery of ${c.competency} over time`} />
                <p className="mt-2 text-sm text-ink/70">
                  {c.attempts < 3 ? "Too few attempts to describe a trend." : delta > 0.1 ? "Improving since your first attempts." : delta < -0.1 ? "Lower than your first attempts." : "Steady."}
                  {c.peak_mastery > c.mastery + 0.1 && c.attempts >= 3 ? ` Earlier peak was ${pct(c.peak_mastery)}.` : ""}
                </p>
              </Card>
            );
          })}
        </ContentGrid>
      )}
      {regressed.length > 0 && <Alert variant="info" title="Worth refreshing">{regressed.map((c) => c.competency).join(", ")}: a recent retention check was missed after earlier solid results. Your earlier results are kept.</Alert>}
      <div>
        <h3 className="font-semibold">Recently resolved</h3>
        {resolved.length === 0 ? <p className="mt-1 text-sm text-ink/70">No resolved gaps yet.</p> : (
          <ul className="mt-2 space-y-1 text-sm">{resolved.map((g) => <li key={g.id}>{g.competency}: resolved {g.resolved_at ? day(g.resolved_at) : ""}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return <p className="mt-2 text-xs text-ink/60">One data point so far.</p>;
  const w = 160, h = 40;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w} ${h - p * h}`).join(" ");
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="mt-2 h-10 w-40 overflow-visible"><path d={d} fill="none" strokeWidth="2" className="stroke-blue" /></svg>
  );
}

function InsightList({ insights, courseId }: { insights: Insight[]; courseId: string }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-3" data-course={courseId}>
      <h3 className="font-semibold">Insights</h3>
      {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const fix = useCorrectInsight();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={insight.source === "ai" ? "blue" : "neutral"}>{insight.source === "ai" ? "AI-written" : "From your results"}</Badge>
        <span className="font-mono text-xs text-ink/60">confidence {insight.confidence} · {insight.evidence_event_ids.length} attempts cited</span>
      </div>
      <p className="mt-2 font-medium">{insight.statement}</p>
      <p className="mt-1 text-sm text-ink/70">Why: {insight.rationale}</p>
      {!open ? (
        <button type="button" className="mt-2 text-sm underline" onClick={() => setOpen(true)}>This isn't right</button>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); fix.mutate({ id: insight.id, status: "corrected", note }); }}>
          <label className="block text-sm"><span className="font-medium">What is wrong? (optional)</span><input className={field + " mt-1"} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex gap-2"><button type="submit" className={btn} disabled={fix.isPending}>Hide this insight</button><button type="button" className={btn} onClick={() => setOpen(false)}>Cancel</button></div>
          {fix.error && <Alert variant="error" title="Could not update">{messageForApiError(fix.error)}</Alert>}
        </form>
      )}
    </Card>
  );
}

function PrivacyCard() {
  const reset = useResetIntelligence();
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-labelledby="privacy-h" className="rounded-2xl border border-ink/15 p-5">
      <h2 id="privacy-h" className="text-lg font-semibold">Your data</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">Only you can see this. It is never used to personalise anyone else's learning, and it makes no judgement about you, only about what your attempts show. Deleting removes your attempts, profile, gaps, insights and preferences. Your courses stay.</p>
      {!confirming ? (
        <button type="button" className={ghostLink + " mt-3"} onClick={() => setConfirming(true)}>Reset my learning intelligence</button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm reset">
          <span className="text-sm font-medium">This cannot be undone.</span>
          <button type="button" className={btn} disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => setConfirming(false) })}>{reset.isPending ? "Deleting…" : "Yes, delete everything"}</button>
          <button type="button" className={btn} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      {reset.error && <Alert variant="error" title="Could not reset">{messageForApiError(reset.error)}</Alert>}
    </section>
  );
}
