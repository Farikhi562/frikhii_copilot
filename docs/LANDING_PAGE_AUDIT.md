# Landing page audit (Phase 01.8)

Audit of `apps/web/src/pages/Landing.tsx` as found in the Phase 03 archive, and what was
changed. Findings come from reading the source; the "after" state was checked in Chromium
(see `TEST_REPORT.md` for exactly what was and was not verified).

## Before

| Area | Finding |
|---|---|
| Structure | One 110-line file. Sections: hero, trailer, visual showcase, about, "Learn with intent" step list, Course Architect, AI Tutor, product interface. No How It Works, no Why FRIKHII; the FAQ was added in a later pass. |
| Hero | Text plus a decorative bar chart. No product composition, so the right half was empty on desktop. Headline jumped from `text-5xl` to `md:text-8xl`, oversized around 768px. |
| Empty visuals | `assets.gallery` (6) and `assets.interfaces` (5) all had empty `src`, so 11 dashed "placeholder" boxes were visible on the page. |
| Trailer | Disabled play button over a blank poster when no video. Worked, but looked broken. |
| Messaging | The problem and solution were merged into one list. Disclaimers were stale: "The Course Architect is not built yet", "No AI is connected in this phase". |
| Navigation | Mobile menu was a `<details>` that stayed open after choosing a link; no FAQ link; nav labelled "About" pointed at the problem list. |
| CTA | Final CTA copy did not match the brief; no supporting line; "Get started" vs "Start Learning" inconsistent. |
| Footer | Tagline and links only. No product description, no copyright, no non-affiliation note. |
| Links | `/login`, `/register` exist. `/privacy`, `/terms`, `/contact` exist but are explicit placeholders ("will be published before public launch"). |
| SEO | Title and description only. No Open Graph or Twitter metadata, no `theme-color`. |
| Colour | Several small texts at `ink/45` to `ink/55` (below 4.5:1 on Warm Paper). |

## After

Sections, in order: Navigation, Hero (with product preview), Product trailer, Problem,
Solution, AI Course Architect, AI Personal Tutor, Product interface, How It Works, Why
FRIKHII, FAQ, Final CTA, Footer.

- **Components** live in `apps/web/src/features/landing/`; `pages/Landing.tsx` only composes them.
- **Honesty:** every block that shows sample data says so, and each capability carries a
  text label: *Built, in testing*, *Partly built* or *Planned* (`StatusChip`). Guided
  lessons, assessment, the AI tutor and analytics are labelled *Planned*. No pricing,
  statistics or integrations appear anywhere.
- **Hero:** responsive two-column composition built from design tokens (roadmap, current
  course, progress, tutor exchange), captioned "Product demonstration. Sample data".
- **Trailer:** fixed 16:9 box, poster and video sources in `lib/assets.ts`, nothing loads
  until play is pressed (`preload="none"`, no autoplay on load). Without a video it shows
  "Trailer coming soon" instead of a player.
- **Showcase:** six HTML previews (Dashboard, Course overview, Learning roadmap, Lesson
  workspace, Assessment, Progress analytics) replace the empty image slots.
- **Tutor:** six selectable learning modes (`aria-pressed`) with a scripted example,
  labelled as planned.
- **Navigation:** accessible mobile menu (`aria-expanded`, closes on link and Escape),
  anchors to every section.
- **SEO:** Open Graph and Twitter metadata, `theme-color`, one `h1`, no skipped heading
  levels, FAQPage JSON-LD. No `og:image` or `og:url` yet because no image or production
  URL exists.
- **Contrast:** measured (WCAG formula) on the token pairs used. Body and label text are
  at or above 4.5:1 (smallest: `ink/60` on Warm Paper, 4.68:1). Paper on Electric Blue is
  4.06:1, so only large or bold text is placed on blue.
- **Motion:** `MotionConfig reducedMotion="user"` plus the existing global reduced-motion CSS.

## Known gaps

- No real trailer, poster or product screenshots exist; `lib/assets.ts` is where they go.
- `/privacy`, `/terms`, `/contact` remain placeholders.
- Geist fonts are loaded by `@fontsource`; they were not available while verifying, so
  screenshots used a fallback sans-serif and metrics may differ slightly.
- Authentication code was not touched.
