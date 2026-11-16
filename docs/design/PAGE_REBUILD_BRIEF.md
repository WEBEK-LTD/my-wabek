# Page rebuild brief (Lagoon / design C)

Shared rules for every agent rebuilding pages on the `overhaul/security-redesign` branch.

## Goal
Rebuild each page's UI in the approved **C · Lagoon** design: premium, advanced, polished — not plain or "simple-looking". The *experience* should be simpler (clear hierarchy, fewer clicks, sensible defaults, progressive disclosure), the *look* rich (depth, gradients from the logo, data viz, thoughtful empty/loading states, micro-interactions via CSS transitions).

## References (read first)
- `docs/design/C-Landing.dc.html`, `docs/design/C-Dashboard.dc.html` — approved mockups (ignore the `<x-dc>`/`<sc-for>`/DCLogic templating; inline styles are the spec).
- `docs/design/UI_KIT.md` — component library in `components/ui/` (import from `@/components/ui`). Tokens are Tailwind semantic classes backed by CSS variables (`bg-canvas`, `bg-surface`, `border-line`, `text-ink`, `text-muted`, `bg-brand-gradient`, tones…) and work in light and dark mode.
- Layouts: `components/layout/DashboardLayout.tsx`, `AdminLayout.tsx`, `components/PublicNav.tsx` (`light` | `deep`), `components/PublicFooter.tsx`. Navigation map: `components/layout/nav.ts`.
- Logo: `/brand/logo-mark.png` via `<Logo />` only. Never an external/Cloudinary logo or a drawn placeholder.

## Hard rules
1. **Keep every feature and all content.** Same API calls, request/response handling, state logic, validation, permissions/plan gating, i18n keys. Restyle and restructure the UI; do not drop functionality. If something is broken, fix it only if small and obvious; otherwise note it.
2. **Routes unchanged.** Old URLs must keep working.
3. **Language:** Arabic UI copy in Modern Standard Arabic (فصحى). Pages that use `useTranslation`/`lib/i18n.ts` keep doing so (add keys in all 4 languages: ar/en/fr/tr — English fallback acceptable for fr/tr if needed). RTL first; use logical utilities (`ms-/me-/ps-/pe-/start-/end-`). No emoji as icons — use `@heroicons/react`.
4. **No invented data.** No fake stats, customer counts, testimonials or prices. Prices come from `/api/plans`. Sections that need real figures are omitted unless the data exists.
5. **Components:** use `@/components/ui`. Do **not** modify existing files in `components/ui/` or the layouts (other agents depend on them). If you need a new shared piece, create it under `components/<your-area>/`.
6. **Accessibility:** real `<button>`/`<a>`/`<label>`; focus states; `aria-label` on icon-only buttons; 4.5:1 text contrast; tables in an `overflow-x-auto` wrapper; works at 390px width.
7. **States:** every data view has loading (Skeleton), empty (EmptyState with a clear next action) and error states.
8. **Dark mode** must work (tokens only — no hard-coded white backgrounds/colors).
9. **Don't touch** `pages/api/**`, `lib/**` (except `lib/i18n.ts` additions), migrations, or files outside your assigned list. If an API change is needed, list it in your report.
10. **Quality gate:** `node_modules/.bin/tsc --noEmit -p .` must report 0 errors. Optionally verify visually with Playwright screenshots against `next dev` on your assigned port (`PORT=<n> node_modules/.bin/next dev -p <n>`), with env `JWT_SECRET=dev-placeholder-secret-32-characters-x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co`; pages behind auth can be checked for layout only. Delete any temporary files; never commit screenshots.

## Git
`git reset --hard <base commit given in your prompt>` first; `ln -s /home/user/my-wabek/node_modules node_modules` (never commit it). Commit in logical commits; every message ends with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PYAXYa3nZbqxHHHqz2xQNk
```

Do not push, open PRs, or merge.

## Report (<400 words)
Pages done, notable UX simplifications, anything you couldn't keep or found broken (file:line), API changes needed, tsc result, final commit hash + branch.
