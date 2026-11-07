import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Paperclip, Send, TriangleAlert } from "lucide-react";
import { Alert } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { PageHeader, DemoBanner, ghostLink } from "../../features/workspace/components/WorkspaceBits";
import { displayVersion, flattenLessons, useCourseView, coursePath } from "../../features/workspace/courseView";
import {
  previewExchange,
  suggestedPrompts,
  tutorModes,
  tutorService,
  TutorUnavailableError,
  type TutorMessage,
  type TutorModeId,
} from "../../features/workspace/tutor/tutor";

let counter = 0;
const nextId = () => `m-${(counter += 1)}`;

export default function Tutor() {
  const [params] = useSearchParams();
  const courseId = params.get("course") ?? undefined;
  const lessonId = params.get("lesson") ?? undefined;
  const { course, isDemo } = useCourseView(courseId);
  const version = course ? displayVersion(course) : null;
  const lesson = version && lessonId ? flattenLessons(version).find((l) => l.lesson.id === lessonId) : undefined;

  const [mode, setMode] = useState<TutorModeId>("explain");
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeMode = tutorModes.find((m) => m.id === mode)!;

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setMessages((m) => [...m, { id: nextId(), role: "user", text: message }]);
    setDraft("");
    setSending(true);
    try {
      const reply = await tutorService.send({
        mode,
        message,
        context: { courseTitle: version?.title, className: lesson?.flat.klass.title, lessonTitle: lesson?.lesson.title, isDemo },
      });
      setMessages((m) => [...m, { id: nextId(), role: "tutor", text: reply.text }]);
    } catch (error) {
      const text =
        error instanceof TutorUnavailableError
          ? "The AI Tutor is not connected yet, so there is no answer to show. Your message was not sent to any AI service."
          : "The tutor could not respond. Try again.";
      setMessages((m) => [...m, { id: nextId(), role: "system", kind: "error", text }]);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <div className="space-y-6">
      {isDemo && <DemoBanner />}
      <PageHeader eyebrow="AI Tutor" title="Let's work through what you're learning." description="Choose how you want to learn, then ask." />

      <Alert variant="warning" title="The AI Tutor is not connected yet">
        You can explore the workspace and type messages, but there is no AI backend, so nothing will answer. Any example conversation is labelled as a scripted preview.
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_16rem]">
        {/* Modes */}
        <section aria-labelledby="modes-h" className="min-w-0 lg:self-start">
          <h2 id="modes-h" className="mb-2 font-mono text-xs text-ink/65">Mode</h2>
          <div role="group" aria-label="Tutor mode" className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
            {tutorModes.map((m) => {
              const Icon = m.icon;
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex min-w-40 items-start gap-3 rounded-xl border p-3 text-left transition-colors lg:min-w-0",
                    active ? "border-ink bg-ink text-paper" : "border-ink/20 hover:border-ink/50",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{m.name}</span>
                    <span className={cn("block text-xs", active ? "text-paper/80" : "text-ink/70")}>{m.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Conversation */}
        <section aria-labelledby="chat-h" className="flex min-h-[28rem] min-w-0 flex-col rounded-2xl border border-ink/15 bg-white/50">
          <h2 id="chat-h" className="sr-only">Conversation, {activeMode.name} mode</h2>
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <p className="text-lg font-medium">Let&apos;s work through what you&apos;re learning.</p>
                <p className="text-sm text-ink/70">Mode: <strong>{activeMode.name}</strong>. {activeMode.summary}</p>
                <ul className="flex flex-wrap gap-2" aria-label="Suggested prompts">
                  {suggestedPrompts.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => { setDraft(p); inputRef.current?.focus(); }}
                        className="rounded-full border border-ink/25 px-3 py-1.5 text-sm hover:bg-lime"
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setMessages(previewExchange)} className="text-sm underline">
                  Show a scripted example of Socratic mode
                </button>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("max-w-[85%] rounded-2xl p-3 text-sm", m.role === "user" ? "ml-auto bg-ink text-paper" : m.kind === "error" ? "border border-red-700/50 bg-red-50" : "bg-ink/5")}>
                  {m.kind === "preview" && <p className="mb-1 font-mono text-xs opacity-80">Scripted preview, not an AI response</p>}
                  {m.kind === "error" && <p className="mb-1 flex items-center gap-1 font-mono text-xs"><TriangleAlert className="h-3 w-3" aria-hidden /> Not sent</p>}
                  <p>{m.text}</p>
                </div>
              ))
            )}
            {sending && <p className="text-sm text-ink/65" role="status">Sending…</p>}
          </div>
          <form onSubmit={onSubmit} className="border-t border-ink/15 p-3">
            <label htmlFor="tutor-input" className="sr-only">Message to the tutor</label>
            <textarea
              id="tutor-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              maxLength={4000}
              placeholder={`Ask in ${activeMode.name} mode. Shift+Enter for a new line.`}
              className="w-full resize-y rounded-xl border border-ink/25 bg-paper px-3 py-2"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" disabled title="Attachments are not supported yet" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-ink/60 disabled:cursor-not-allowed">
                <Paperclip className="h-4 w-4" aria-hidden /> Attach (soon)
              </button>
              <Button type="submit" loading={sending} disabled={!draft.trim()}>
                <Send className="h-4 w-4" aria-hidden /> Send
              </Button>
            </div>
          </form>
        </section>

        {/* Context */}
        <aside aria-label="Tutor context" className="space-y-3 rounded-2xl border border-ink/15 bg-white/50 p-4 lg:self-start">
          <h2 className="font-semibold">Learning context</h2>
          {version ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="font-mono text-xs text-ink/65">Course</dt><dd>{version.title}{isDemo && " (demo)"}</dd></div>
              {lesson && (<>
                <div><dt className="font-mono text-xs text-ink/65">Class</dt><dd>{lesson.flat.klass.title}</dd></div>
                <div><dt className="font-mono text-xs text-ink/65">Lesson</dt><dd>{lesson.lesson.title}</dd></div>
              </>)}
              <div><dt className="font-mono text-xs text-ink/65">Data</dt><dd>{isDemo ? "Demonstration content" : "Your saved course"}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-ink/70">No course selected. Open the tutor from a lesson or course to give it context.</p>
          )}
          {course && <Link to={coursePath(course.id)} className={ghostLink}>Open course</Link>}
        </aside>
      </div>
    </div>
  );
}
