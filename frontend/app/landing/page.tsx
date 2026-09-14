"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  BookOpenCheck,
  FileSearch,
  GaugeCircle,
  ListChecks,
  LogIn,
  Menu,
  MessagesSquare,
  Mic,
  ShieldCheck,
  Sparkles,
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
import { CURRENT_USER, useRole } from "@/components/role-context";
import { AnimatedNumber } from "@/components/animated-number";
import { cn } from "@/lib/utils";

/* Deterministic waveform bars for the hero visual */
const WAVE = Array.from({ length: 64 }, (_, i) => {
  const t = Math.sin(i * 0.7) * Math.sin(i * 0.23 + 2) * Math.cos(i * 0.11);
  return Math.round((0.25 + Math.abs(t) * 0.75) * 1000) / 1000;
});

const TRACKS = [
  {
    icon: AudioLines,
    kicker: "Speech & sequence processing",
    title: "Turning raw audio into structured, timestamped text",
    body: "Silero VAD (voice activity detection) finds speech and drops silence, faster-whisper transcribes each speech region independently to avoid splice artifacts, and pyannote.audio's speaker-diarization model separates and times every speaker turn before a keyword-scored rule labels them agent / client.",
  },
  {
    icon: MessagesSquare,
    kicker: "Text classification",
    title: "Scoring tone, emotion, and the moment it turned",
    body: "Every client turn is scored for sentiment (CardiffNLP's Twitter-RoBERTa) and tagged with one of 27 emotions (GoEmotions), then a PELT change-point algorithm (ruptures) finds the single turn where the sentiment trajectory shifts most sharply — the call's pivot point.",
  },
  {
    icon: ShieldCheck,
    kicker: "Grounded LLM reasoning",
    title: "Structured output an open LLM can't hallucinate past",
    body: "An NVIDIA-hosted Nemotron model is forced into a strict JSON schema via tool-calling to score 8 compliance criteria and draft coaching feedback. Every quoted 'evidence' span is independently checked to be a verbatim, timestamped line from the transcript before it's ever shown — ungrounded quotes are dropped, not trusted.",
  },
];

const STEPS = [
  {
    icon: Mic,
    title: "Preprocess & VAD",
    body: "Resample to 16kHz mono, then Silero VAD finds speech regions and drops silence.",
  },
  {
    icon: AudioLines,
    title: "Transcribe (ASR)",
    body: "faster-whisper transcribes each detected speech region on its own, timestamps intact.",
  },
  {
    icon: MessagesSquare,
    title: "Diarize speakers",
    body: "pyannote.audio separates speakers by voice embedding; a phrase heuristic maps them to agent/client.",
  },
  {
    icon: FileSearch,
    title: "Analyze the text",
    body: "Sentiment (RoBERTa) + emotion (GoEmotions) per turn, then a change-point algorithm locates the pivot.",
  },
  {
    icon: ListChecks,
    title: "Score & coach (LLM)",
    body: "A forced tool-call scores compliance criteria and drafts coaching notes, evidence verified against the transcript.",
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

/* Scroll-triggered stagger — cards fade/slide in as each section enters view. */
const fadeUpContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { signIn } = useRole();
  const enter = () => {
    signIn();
    onOpenChange(false);
    router.push("/");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enter the workspace</DialogTitle>
          <DialogDescription>
            One workspace, one signed-in user — no accounts or passwords for this
            project build.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex items-center gap-4 rounded-xl border bg-card p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRoundCog className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">{CURRENT_USER.name}</p>
            <p className="text-[12.5px] leading-snug text-muted-foreground">
              {CURRENT_USER.role}. Full access — dashboard, calls, compliance,
              coaching, analytics, review, rubrics, and export.
            </p>
          </div>
        </div>
        <Button onClick={enter} className="mt-1 w-full rounded-full">
          <LogIn className="size-4" /> Enter workspace
        </Button>
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

    // Captured now rather than read in cleanup: by the time cleanup runs the ref
    // may already point elsewhere, and focus must return to the button that
    // opened this menu.
    const menuButton = menuButtonRef.current;
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
      menuButton?.focus();
    };
  }, [mobileMenuOpen]);

  const atBottom = progress > 0.98;
  const C = 2 * Math.PI * 9; // progress ring circumference

  const mobileLinks = [
    ["Techniques", "#product"],
    ["Pipeline", "#how"],
    ["Evaluation", "#trust"],
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
        <motion.div
          className="relative mx-auto max-w-4xl text-center"
          variants={fadeUpContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fadeUpItem}>
            <Badge
              variant="outline"
              className="mb-6 gap-1.5 rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-[11.5px] font-medium text-primary"
            >
              <Sparkles className="size-3" />
              Applied NLP project · speech-to-text → diarization → sentiment/emotion → LLM reasoning
            </Badge>
          </motion.div>
          <motion.h1
            variants={fadeUpItem}
            className="text-balance text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl md:text-6xl"
          >
            Every call audited.
            <br />
            Every judgment{" "}
            <em className="font-serif font-medium italic text-primary">defensible.</em>
          </motion.h1>
          <motion.p
            variants={fadeUpItem}
            className="mx-auto mt-6 max-w-2xl text-balance text-[15px] leading-relaxed text-muted-foreground md:text-[17px]"
          >
            Clearline chains six NLP/ML models into one pipeline: it transcribes a call,
            separates the speakers, scores the client&rsquo;s sentiment and emotion turn by
            turn, finds the moment the call turned, and has an LLM score compliance and
            coach the rep — with every quoted &ldquo;evidence&rdquo; span checked against
            the real transcript before it&rsquo;s trusted.
          </motion.p>
          <motion.div variants={fadeUpItem} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="rounded-full px-6" onClick={() => setLoginOpen(true)}>
              <LogIn className="size-4" /> Enter the workspace
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-dashed px-6"
              nativeButton={false}
              render={<a href="#product" />}
            >
              See the pipeline <ArrowDown className="size-4" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Hero visual — an audited moment */}
        <motion.div
          className="relative mx-auto mt-16 max-w-3xl"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
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
          <motion.div
            className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            variants={fadeUpContainer}
            initial="hidden"
            animate="show"
          >
            {[
              { value: 6, suffix: "", label: "NLP/ML models chained per call" },
              { value: 3, suffix: "", label: "pipeline stages: ASR → diarize → analyze" },
              { value: 8, suffix: "", label: "compliance criteria scored per call" },
              { value: 100, suffix: "%", label: "evidence quotes verified verbatim" },
            ].map(({ value, suffix, label: l }) => (
              <motion.div key={l} variants={fadeUpItem} className="rounded-xl border bg-card px-4 py-3 text-center">
                <p className="text-xl font-semibold tabular-nums tracking-tight">
                  <AnimatedNumber value={value} duration={1.2} format={(n) => `${Math.round(n)}${suffix}`} />
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{l}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ---------------- Product: three tracks ---------------- */}
      <section id="product" className="scroll-mt-24 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            01 · The NLP techniques
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Three NLP problems. One pipeline.
            <span className="text-muted-foreground"> Chained end to end.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            Speech processing, text classification, and grounded language generation each
            solve a different part of turning a raw recording into a defensible judgment —
            Clearline runs all three, in sequence, on every call.
          </p>
          <motion.div
            className="mt-10 grid gap-4 md:grid-cols-3"
            variants={fadeUpContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            {TRACKS.map((t) => (
              <motion.div
                key={t.kicker}
                variants={fadeUpItem}
                className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="scroll-mt-24 border-y bg-card/50 px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            02 · The pipeline
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Audio in, structured judgment out
            <span className="text-muted-foreground"> — five stages.</span>
          </h2>
          <motion.div
            className="mt-12 grid gap-8 md:grid-cols-5"
            variants={fadeUpContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            {STEPS.map((s, i) => (
              <motion.div key={s.title} variants={fadeUpItem} className="relative">
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
              </motion.div>
            ))}
          </motion.div>
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
          <motion.div
            className="mt-10 grid gap-4 sm:grid-cols-2"
            variants={fadeUpContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            {TRUST.map((t) => (
              <motion.div
                key={t.title}
                variants={fadeUpItem}
                className="rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
              >
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-4 pb-24 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-foreground px-6 py-16 text-center text-background md:py-20">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Record or upload a call and watch the pipeline run.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed opacity-70">
            One workspace, full access — record a call, watch it move through
            transcription, diarization, and analysis, then read the compliance and
            coaching report it produces.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 rounded-full bg-background px-7 text-foreground hover:bg-background/90"
            onClick={() => setLoginOpen(true)}
          >
            <LogIn className="size-4" /> Enter the workspace
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
                An applied-NLP pipeline: ASR, diarization, sentiment/emotion
                classification, and grounded LLM reasoning, chained end to end.
              </p>
            </div>
            {[
              ["Techniques", ["Speech & sequence processing", "Text classification", "Grounded LLM reasoning", "Pivot detection"]],
              ["Workspace", ["Enter workspace", "Record a call", "Review queue", "Coaching digests"]],
              ["Evaluation", ["Evaluation harness", "Calibration report", "Adversarial corpus", "Evidence grounding"]],
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
            <span>© 2026 Clearline · NLP course project — mock corpus + a real backend pipeline</span>
            <span>Every judgment evidenced, versioned, and calibrated</span>
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
