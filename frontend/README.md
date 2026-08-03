# Clearline — AI Compliance & Coaching Call Auditor (UI Prototype)

High-fidelity frontend prototype for the AI Call Auditor described in the project
report. **UI only** — no backend, APIs, auth, or business logic. All data is
deterministic mock data generated at build time, so the app renders identically
on every load and can be statically exported.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

## Roles (demo persona switcher)

Two personas, switchable live from the avatar menu in the topbar (persisted in
localStorage — no real auth):

- **Admin — Janet Moss (Chief Compliance Officer):** every screen and control.
- **Employee — Daniel Reyes (Representative):** a personal, coaching-first
  workspace — *My performance* (personal KPIs, 8-week trend, focus areas,
  flagged calls), *My calls* (own calls only), and *My coaching*. Call detail
  is read-only with a **Dispute** action on non-pass criteria instead of
  overrides; reviewer notes are hidden. Admin-only screens show an
  access-denied state. Role logic lives in `components/role-context.tsx` and
  `components/role-gate.tsx`.

## Screens

| Route | Screen |
|---|---|
| `/landing` | Marketing landing page — Antimetal-inspired navbar morph + circular scroll-progress ring, Login → role picker (Admin / Employee) that routes into the workspace |
| `/` | Dashboard overview — KPIs, risk trend, distribution, leaderboard, activity |
| `/calls` | Calls list — search, filters, sorting, pagination, quick-preview panel |
| `/calls/[id]` | Call detail — mock audio player, trajectory timeline, transcript with evidence spans, compliance & coaching tabs, overrides, notes |
| `/compliance` | Per-criterion compliance posture with evidence viewer & rubric version switcher |
| `/coaching` | Communication coaching — talk ratios, objective metrics, scorecards |
| `/analytics` | Aggregate analytics — violations, agreement, calibration, heatmap, monthly reports |
| `/review` | Human review workspace — queue, model-vs-human comparison, approvals, audit history |
| `/rubrics` | Rubric management — version history, rule table, diff viewer, re-audit |
| `/export` | Export preview — paper-accurate audit PDF layout |

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI)
· Recharts · Framer Motion · Lucide · next-themes (light/dark)

## Architecture notes

- `lib/mock-data.ts` — seeded deterministic generator: 240 calls, 8 reps,
  4 reviewers, 8 rubric criteria, 4 rubric versions, transcripts, overrides,
  activity feed. Risk tiers are derived by the documented rule (fail on a
  critical criterion → critical tier, etc.), mirroring the report.
- `lib/derived.ts` — all aggregations (KPIs, trends, leaderboard, heatmap,
  agreement, calibration) computed from the corpus.
- `components/charts.tsx` — Recharts wrappers themed via CSS variables
  (dataviz-validated palette; status colors reserved for pass/flag/fail).
- This shadcn install uses **Base UI** primitives: use the `render` prop
  (with `nativeButton={false}` for links), not Radix's `asChild`.
- Entrance animations are CSS-driven (`tw-animate-css`) so they complete even
  when rAF is throttled; chart animations are disabled for instant render.
