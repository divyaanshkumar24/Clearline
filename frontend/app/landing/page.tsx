"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AudioLines,
  BarChart3,
  BookOpenCheck,
  FileDown,
  FileSearch,
  GaugeCircle,
  ListChecks,
  LogIn,
  Menu,
  MessagesSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundCog,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRole, type Role } from "@/components/role-context";
import { cn } from "@/lib/utils";

/* Deterministic waveform bars for the hero visual */
const WAVE = Array.from({ length: 64 }, (_, i) => {
  const t = Math.sin(i * 0.7) * Math.sin(i * 0.23 + 2) * Math.cos(i * 0.11);
  return Math.round((0.25 + Math.abs(t) * 0.75) * 1000) / 1000;
});

const TRACKS = [
  {
    icon: ShieldCheck,
    kicker: "Compliance track",
    title: "Did a rule get broken?",
    body: "Every call is scored against a versioned rubric — disclosures, prohibited language, suitability, conduct. Each criterion returns pass, flag, or fail with the exact transcript span, and a confidence that has been calibrated against reality.",
  },
  {
    icon: MessagesSquare,
    kicker: "Coaching track",
    title: "Why did the call go that way?",
    body: "Talk ratio, interruptions, silences, and monologues computed straight from the audio — no model involved. Technique findings are pinned to timestamps and paired with what to do instead next call.",
  },
  {
    icon: BarChart3,
    kicker: "Aggregate track",
    title: "What patterns repeat?",
    body: "Recurring violations, playbook drift by representative, coaching trends, and a live model-versus-human agreement record — auditing turns into organizational insight.",
  },
];

const STEPS = [
  {
    icon: Mic,
    title: "Ingest",
    body: "Upload a recording or transcript. Metadata is captured automatically.",
  },
  {
    icon: AudioLines,
    title: "Transcribe & diarize",
    body: "Speaker-separated, timestamped text — the raw material for every judgment.",
  },
  {
    icon: FileSearch,
    title: "Score with evidence",
    body: "Per-criterion labels with quotes, rationale, confidence, and the rubric version.",
  },
  {
    icon: ListChecks,
    title: "Human review",
    body: "The AI triages, a reviewer decides. Overrides never overwrite the model's judgment.",
  },
  {
    icon: FileDown,
    title: "Export",
    body: "A self-contained audit PDF a compliance officer can act on — and defend.",
  },
];

const TRUST = [
  {
    title: "Calibration, verified",
    body: "Confidence is only surfaced after the evaluation harness proves higher stated confidence means higher observed accuracy.",
    stat: "±4pts max bucket deviation",
  },
  {
    title: "Adversarially tested",
    body: "Transcripts are untrusted input. A seeded adversarial corpus proves in-call manipulation attempts don't change the score.",
    stat: "0 successful manipulations",
  },
  {
    title: "Rubric as versioned data",
    body: "Every judgment records the rules it was scored under. Re-audit history under new rules and get an explicit diff.",
    stat: "v2.2 → v2.4 fully traceable",
  },
  {
    title: "Immutable override log",
    body: "Human decisions are additive records with identity and timestamp — the model's original judgment is never erased.",
    stat: "97% model ↔ human agreement",
  },
];

function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { setRole } = useRole();
  const enter = (role: Role) => {
    setRole(role);
    onOpenChange(false);
    router.push("/");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Clearline</DialogTitle>
          <DialogDescription>
            Demo workspace — pick a role to continue. No password needed.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid gap-3">
          <button
            onClick={() => enter("admin")}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/50"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRoundCog className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Admin</p>
              <p className="text-[12.5px] leading-snug text-muted-foreground">
                Janet Moss · Chief Compliance Officer. Review queue, overrides,
                rubrics, analytics, exports.
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
          <button
            onClick={() => enter("rep")}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/50"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-chart-2/15 text-status-good-fg">
              <UserRound className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Employee</p>
              <p className="text-[12.5px] leading-snug text-muted-foreground">
                Daniel Reyes · Representative. Personal performance, own calls,
                and coaching feedback.
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        </div>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          Roles change what you can see and do — switch anytime from the avatar menu.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default function LandingPage() {
  const [progress, setProgress] = React.useState(0);
  const [scrolled, setScrolled] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const mobilePanelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? el.scrollTop / max : 0;
      setProgress(Math.min(1, Math.max(0, p)));
      setScrolled(el.scrollTop > 64);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = mobilePanelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [mobileMenuOpen]);

  const atBottom = progress > 0.98;
  const C = 2 * Math.PI * 9; // progress ring circumference

  const mobileLinks = [
    ["Product", "#product"],
    ["How it works", "#how"],
    ["Trust", "#trust"],
  ] as const;

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      {/* ---------------- Navbar ---------------- */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center px-4 py-4 md:px-6">
        {/* Brand — always centered. Start: "Clearline" pill. While scrolling: collapses
            into a circle whose border fills with scroll progress. At the bottom
            (100%): expands back into the original wordmark pill. */}
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
          {(() => {
            const collapsed = scrolled && !atBottom;
            const R = 23; // ring radius in a 52×52 viewBox
            const RC = 2 * Math.PI * R;
            return (
              <div className="relative">
                <div
                  className={cn(
                    "relative flex items-center justify-center overflow-hidden rounded-full border bg-card/80 shadow-xs backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    collapsed ? "h-11 w-11" : "h-11 w-72 max-md:w-52",
                  )}
                >
                  <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <AudioLines className="size-3.5" />
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-[14.5px] font-semibold tracking-tight transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                      collapsed
                        ? "ml-0 max-w-0 opacity-0"
                        : "ml-2 max-w-32 opacity-100",
                    )}
                  >
                    Clearline
                  </span>
                </div>
                {/* Scroll-progress border */}
                <svg
                  viewBox="0 0 52 52"
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-1/2 size-[52px] -translate-x-1/2 -translate-y-1/2 -rotate-90 transition-opacity duration-300",
                    collapsed ? "opacity-100" : "opacity-0",
                  )}
                >
                  <circle
                    cx="26"
                    cy="26"
                    r={R}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={RC}
                    strokeDashoffset={RC * (1 - progress)}
                    className="transition-[stroke-dashoffset] duration-150"
                  />
                </svg>
              </div>
            );
          })()}
        </div>

        {/* Section links */}
        <nav className="pointer-events-auto hidden items-center gap-1 rounded-full border bg-card/80 px-2 py-1 shadow-xs backdrop-blur-md md:flex">
          {mobileLinks.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop auth action */}
        <div className="pointer-events-auto ml-auto hidden items-center rounded-full border bg-card/80 p-1 shadow-xs backdrop-blur-md md:flex">
          <Button size="sm" className="rounded-full" onClick={() => setLoginOpen(true)}>
            <LogIn className="size-3.5" /> Sign in
          </Button>
        </div>

        {/* Mobile menu trigger */}
        <div className="pointer-events-auto ml-auto md:hidden">
          <Button
            ref={menuButtonRef}
            type="button"
            variant="outline"
            size="icon"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="size-11 rounded-full border bg-card/80 shadow-xs backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" aria-hidden={false}>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div
            id="mobile-nav-panel"
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="absolute right-4 top-20 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border bg-card p-3 shadow-xl"
          >
            <nav className="grid gap-1">
              {mobileLinks.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-3 border-t pt-3">
              <Button
                className="w-full rounded-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLoginOpen(true);
                }}
              >
                <LogIn className="size-4" /> Sign in
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-4 pb-20 pt-36 md:px-6 md:pt-44">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,--alpha(var(--color-primary)/8%),transparent_70%)]" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-[11.5px] font-medium text-primary"
          >
            <Sparkles className="size-3" />
            AI Compliance & Coaching Call Auditor
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl md:text-6xl">
            Every call audited.
            <br />
            Every judgment{" "}
            <em className="font-serif font-medium italic text-primary">defensible.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-[15px] leading-relaxed text-muted-foreground md:text-[17px]">
            Clearline listens to every advisory call, scores it against your versioned
            compliance rubric with cited evidence, and coaches your representatives —
            while a human stays in charge of every consequential decision.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="rounded-full px-6" onClick={() => setLoginOpen(true)}>
              <LogIn className="size-4" /> Login to workspace
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-dashed px-6"
              nativeButton={false}
              render={<a href="#product" />}
            >
              Explore the product <ArrowDown className="size-4" />
            </Button>
          </div>
        </div>

        {/* Hero visual — an audited moment */}
        <div className="relative mx-auto mt-16 max-w-3xl">
          <div className="rounded-2xl border bg-card p-5 shadow-lg md:p-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11.5px] font-medium text-muted-foreground">
                CALL-26700-0213
              </span>
              <Badge
                variant="outline"
                className="gap-1.5 border-status-critical/30 bg-status-critical/10 text-[10.5px] font-medium text-status-critical-fg"
              >
                <span className="size-1.5 rounded-full bg-status-critical" /> Critical
              </Badge>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                12:39 / 14:59
              </span>
            </div>
            <div className="mt-4 flex h-12 items-center gap-px">
              {WAVE.map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-full",
                    i < 54 ? "bg-primary/70" : "bg-border",
                    i >= 42 && i <= 47 && "bg-status-critical",
                  )}
                  style={{ height: `${h * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-status-critical/8 p-3.5 ring-1 ring-status-critical/25">
              <p className="text-[13.5px] italic leading-relaxed">
                &ldquo;I can guarantee you a twelve percent return on this — it&rsquo;s a
                sure thing.&rdquo;
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-status-critical-fg">
                <span className="flex items-center gap-1">
                  <GaugeCircle className="size-3" /> C-06 No guaranteed returns — fail
                </span>
                <span className="text-muted-foreground">
                  evidence @ 10:41 · confidence 94% (calibrated) · rubric v2.4
                </span>
              </p>
            </div>
          </div>
          {/* Stats strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["240", "calls audited in 45 days"],
              ["97%", "model ↔ human agreement"],
              ["8", "criteria scored per call"],
              ["100%", "judgments with cited evidence"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border bg-card px-4 py-3 text-center">
                <p className="text-xl font-semibold tabular-nums tracking-tight">{v}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Product: three tracks ---------------- */}
      <section id="product" className="scroll-mt-24 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            01 · What it does
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Three tracks. One call.
            <span className="text-muted-foreground"> Never one blended score.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            A compliance failure and a communication weakness are different problems with
            different owners. Clearline keeps them separate — so every output stays
            actionable.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TRACKS.map((t) => (
              <div
                key={t.kicker}
                className="group rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <t.icon className="size-5" />
                </div>
                <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
                  {t.kicker}
                </p>
                <h3 className="mt-1.5 text-[17px] font-semibold tracking-tight">{t.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="scroll-mt-24 border-y bg-card/50 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            02 · How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Upload to defensible audit
            <span className="text-muted-foreground"> in five steps.</span>
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative">
                {i < STEPS.length - 1 ? (
                  <span className="absolute left-5 top-12 hidden h-px w-[calc(100%-1rem)] translate-x-6 bg-border md:block" />
                ) : null}
                <div className="flex size-10 items-center justify-center rounded-full border bg-background text-primary">
                  <s.icon className="size-4.5" />
                </div>
                <p className="mt-4 font-mono text-[10.5px] text-muted-foreground">
                  0{i + 1}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl border bg-background p-5">
            <BookOpenCheck className="size-5 shrink-0 text-primary" />
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                Reviewer attention is the scarcest resource.
              </span>{" "}
              Calls are ranked by a transparent, versioned risk rule — a low-confidence
              fail on a critical criterion floats to the top, so the first ten minutes of
              your day go to the ten riskiest calls.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Trust ---------------- */}
      <section id="trust" className="scroll-mt-24 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            03 · Why it holds up
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Built to be questioned.
          </h2>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            An audit tool that can&rsquo;t defend its own judgments is a demonstration.
            Clearline measures its reliability and shows the receipts.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {TRUST.map((t) => (
              <div key={t.title} className="rounded-2xl border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[16px] font-semibold tracking-tight">{t.title}</h3>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-status-good/30 bg-status-good/10 text-[10.5px] font-medium text-status-good-fg"
                  >
                    {t.stat}
                  </Badge>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-4 pb-24 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-foreground px-6 py-16 text-center text-background md:py-20">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            See your riskiest calls first — starting tomorrow morning.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed opacity-70">
            Sign in as an admin to triage the review queue, or as an employee to see
            personal coaching. Same calls, two very different mornings.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 rounded-full bg-background px-7 text-foreground hover:bg-background/90"
            onClick={() => setLoginOpen(true)}
          >
            <LogIn className="size-4" /> Login to the demo
          </Button>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t px-4 pb-10 pt-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <AudioLines className="size-4" />
                </span>
                <span className="text-[15px] font-semibold tracking-tight">Clearline</span>
              </div>
              <p className="mt-3 max-w-[26ch] text-[12.5px] leading-relaxed text-muted-foreground">
                The evidence-grounded, calibrated, human-supervised audit system for
                regulated calls.
              </p>
            </div>
            {[
              ["Product", ["Three tracks", "Risk prioritization", "Rubric versioning", "Audit exports"]],
              ["Workspace", ["Admin sign-in", "Employee sign-in", "Review queue", "Coaching digests"]],
              ["Trust", ["Evaluation harness", "Calibration report", "Adversarial corpus", "Override log"]],
            ].map(([title, items]) => (
              <div key={title as string}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {title}
                </p>
                <ul className="mt-3 space-y-2">
                  {(items as string[]).map((i) => (
                    <li key={i}>
                      <button
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setLoginOpen(true)}
                      >
                        {i}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Giant wordmark — reappears as you reach the end */}
          <div
            className="mt-16 select-none text-center transition-all duration-700"
            style={{
              opacity: Math.min(1, Math.max(0.06, (progress - 0.82) / 0.16)),
              transform: `translateY(${Math.max(0, (1 - Math.min(1, (progress - 0.82) / 0.16)) * 24)}px)`,
            }}
          >
            <p className="bg-gradient-to-b from-foreground to-foreground/30 bg-clip-text text-[18vw] font-semibold leading-none tracking-tighter text-transparent md:text-[13rem]">
              Clearline
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-[11.5px] text-muted-foreground">
            <span>© 2026 Clearline · UI prototype, mock data only</span>
            <span>SOC 2 · GDPR ready — every judgment evidenced, versioned, calibrated</span>
          </div>
        </div>
      </footer>

      {/* ---------------- Scroll progress ring ---------------- */}
      <button
        onClick={() =>
          window.scrollTo({
            top: atBottom ? 0 : document.documentElement.scrollHeight,
            behavior: "smooth",
          })
        }
        aria-label={atBottom ? "Back to top" : "Scroll to bottom"}
        className="fixed bottom-5 right-5 z-50 flex size-11 items-center justify-center rounded-full border bg-card/90 shadow-md backdrop-blur-md transition-transform hover:scale-105"
      >
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-full -rotate-90">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-150"
          />
        </svg>
        {atBottom ? (
          <ArrowUp className="size-4 text-primary" />
        ) : (
          <ArrowDown className="size-4 text-muted-foreground" />
        )}
      </button>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
