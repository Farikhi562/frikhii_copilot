# Phase 01.5 Audit
**Existing (Phase 01):** landing page (11 sections), route shell with placeholders, central media config, Vercel rewrite, minimal docs.
**Missing at audit time:** UI kit, dev gallery, legal pages, mobile nav, most docs, lockfile, lint.
**Risks:** dependency versions never verified against the registry (Vite 8, React 19, Radix, Motion); no lockfile; nothing has ever been built.
**Unused deps:** react-hook-form, zod (no forms yet). Radix is used only by Dialog.
**UI issues found:** footer links to /privacy, /terms, /contact hit 404; nav had no mobile menu; raw hex colors appear in the wordmark SVG.
**Priority:** 1 verify build locally; 2 UI kit; 3 legal pages and mobile nav; 4 docs; 5 lint.
