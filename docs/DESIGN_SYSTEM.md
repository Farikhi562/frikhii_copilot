# Design System
Documents only what exists in code (`apps/web/src/styles/index.css`, `components/ui/`, `pages/Landing.tsx`).

## Brand
FRIKHII: premium editorial technology, minimal, precise. Tagline: Learn with intent. Become capable.
Logo: `Mark` in `pages/Landing.tsx`: a stepped F built from rectangles (ink stem and top bar, blue and lime steps) plus the letter-spaced FRIKHII wordmark. Clear space and minimum size are not formally defined yet.

## Color tokens (Tailwind `@theme`)
| Token | Hex | Use |
|---|---|---|
| ink | #111318 | text, dark sections, primary button |
| paper | #F5F3ED | page background |
| lime | #D5F26A | accent, badges, highlights |
| blue | #5268F5 | focus ring, progress, active states |
No semantic tokens (success/warning/error) exist. `Alert` and `Field` currently use Tailwind palette colors (`red-700`, `amber-600`) for error and warning; this is a known inconsistency.

## Typography
Geist Sans (`--font-sans`) and Geist Mono (`--font-mono`) via `@fontsource-variable`. No custom type scale: Tailwind sizes are used directly (hero `text-5xl` to `md:text-8xl`, section titles `text-3xl` to `text-6xl`, body default). Weights used: 400, 500 (`font-medium`), 600 (`font-semibold`). Mono is used for small labels. Line heights: `leading-[1.02]` on the hero, Tailwind defaults elsewhere.

## Spacing, radius, shadow, borders
Spacing: Tailwind default 4px scale; no custom tokens. Page container: `max-w-6xl`, `px-6` (`PageContainer` uses `py-10`). Radius used: `rounded-xl` (inputs, menu items), `rounded-2xl` (cards, placeholders), `rounded-3xl` (trailer, dialog), `rounded-full` (buttons, badges). Shadow: `shadow-lg` only on popovers, dropdowns and the mobile menu. Borders: 1px at `ink/10` to `ink/25`; dashed for placeholders.

## Breakpoints
Tailwind defaults. Used in code: `sm` 640px, `md` 768px, `lg` 1024px. Mobile menu and Sidebar switch at `md`.

## Components (`components/ui/`)
Button (primary, accent, ghost; loading, disabled), Field, Textarea, Select, Checkbox, Radio, Switch, Avatar, Badge, Spinner, Skeleton, ProgressBar, ProgressRing, Alert, EmptyState, ErrorState, Dialog and ConfirmDialog (Radix Dialog), DropdownMenu, Popover, Tooltip, Tabs (Radix), Sidebar, Topbar, Breadcrumb, NavItem, Card, StatCard, PageContainer, SectionHeader, ContentGrid, Toast (Zustand). Checkbox, Radio, Select and Switch are native or ARIA-based, not Radix. Gallery: `/dev/components`, mounted only when `import.meta.env.DEV`.

## Icons, motion, focus, accessibility
Icons: Lucide, `h-4 w-4` inline, `h-5 w-5` standalone. Motion: one hero fade-in (0.7s) via Motion, CSS transitions on controls; all animation and smooth scrolling disabled under `prefers-reduced-motion`. Focus: global `:focus-visible` 2px blue outline, 3px offset. Contrast has not been measured. Form fields use labels, `aria-invalid` and `aria-describedby`.

## Theme
Light only. Dark theme is not implemented; the intended strategy is to remap the four tokens, and is not yet designed.
