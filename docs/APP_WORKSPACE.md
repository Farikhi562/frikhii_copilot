# Authenticated Learning Workspace

The post-login app at `/app`. The public landing page is unchanged.

## Principles

1. **Real data first.** Everything shown comes from the Core API (`courses`, `learning-goals`, course detail) or the profile.
2. **Demo data is separate and labelled.** The only demo content is the built-in sample course (`id = "demo"`, `features/workspace/demo/`). Every demo page carries a banner. Nothing demo is saved.
3. **No fabricated progress.** There is no lesson-completion tracking yet, so no percentages, streaks, study-time charts or "completed" states are shown. Class status is derived from course order only (first class "Available", rest "Upcoming").
4. **No fabricated AI.** There is no tutor backend. `tutorService.send` rejects with `TutorUnavailableError`; the UI shows "Not sent" and explains. A scripted example exists only behind an explicit button and is labelled "Scripted preview, not an AI response".

## Routes

| Route | Page |
|---|---|
| `/app` | Overview: greeting, Continue Learning, Today's focus, quick actions, My Learning, insights, goals in progress |
| `/app/courses` | My Learning: search, filters (All / Enrolled / Draft review), loading, error, empty, no-result states |
| `/app/courses/new` | Course Architect intake ("What do you want to master?") |
| `/app/courses/:id` | Course overview (tabs Overview / Curriculum / Final project / Notes) |
| `/app/courses/:id/roadmap` | Roadmap |
| `/app/courses/:id/classes/:classId` | Class page |
| `/app/courses/:id/lessons/:lessonId` | Lesson workspace |
| `/app/tutor` | AI Tutor (6 modes; context via `?course=&lesson=`) |
| `/app/progress` | Learning progress (plan figures, targeted competencies, history from real records) |
| `/app/settings` | Profile, preferences, workspace (sidebar preference), account |
| `/app/help` | Help & Support |
| `/app/courses/demo[/...]` | Demo course; lesson `demo-m2-c1-l2` has full sample content |

Existing Phase 03 routes (review, diagnostic, result, generating) are untouched.

## Shell

`pages/app/AppLayout.tsx`: skip link, collapsible sidebar (tooltips when collapsed; preference in `localStorage` key `frikhii.sidebar.collapsed`, device-local), mobile drawer (Radix Dialog), topbar with breadcrumb, search (Ctrl/Cmd+K: pages and own courses) and account menu. Nav config: `features/workspace/shell/nav.ts`.

## Code map (`apps/web/src/features/workspace/`)

- `courseView.ts`: `useCourseView` (demo vs real), flatten helpers, paths, status.
- `lessonBlocks.ts`, `components/LessonBlocks.tsx`: content block model and renderer (intro, objectives, explanation, key concept, analogy, example, table, code, math, image with alt text, outline, practice).
- `components/WorkspaceBits.tsx`: PageHeader, DemoBanner, ModuleAccordion, status pills.
- `progress/derive.ts`: derives history and targeted competencies from real records.
- `tutor/tutor.ts`: modes, prompts, unavailable service.
- `demo/`: labelled sample course and lesson.

## Backend integration status

| Feature | Status |
|---|---|
| Courses, goals, course detail, profile | Real (existing API) |
| Lessons | Blueprint from the course, not authored lesson text |
| Lesson completion / progress tracking | Not built |
| AI Tutor | Not built (UI only, honest error) |
| Notes, file attach in tutor | Not built (attach button disabled) |

## Limitations

- Lessons for real courses show the blueprint with a warning, not generated content.
- Sidebar preference is not synced across devices.
- Search covers pages and courses only, not lesson text.
