"use client";

import * as React from "react";
import {
  AudioLines,
  FileDown,
  Printer,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared";
import { Reveal } from "@/components/motion";
import {
  CALLS,
  ORGANIZATION,
  getCriterion,
  getRep,
  getReviewer,
} from "@/lib/mock-data";
import { effectiveLabel } from "@/lib/derived";
import { fmtDateTime, fmtDuration, fmtPct, fmtTimestamp } from "@/lib/format";
import type { ScoreLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AccessDenied, RoleGate } from "@/components/role-gate";

const LABEL_PRINT: Record<ScoreLabel, string> = {
  pass: "PASS",
  flag: "FLAG",
  fail: "FAIL",
};

function AdminExport() {
  const candidates = CALLS.filter((c) => c.riskTier !== "low").slice(0, 8);
  const [callId, setCallId] = React.useState(candidates[0].id);
  const [sections, setSections] = React.useState({
    coaching: true,
    overrides: true,
    transcriptRefs: true,
  });
  const call = CALLS.find((c) => c.id === callId)!;
  const rep = getRep(call.repId);
  const reviewer = getReviewer(call.reviewerId);
  const fails = call.scores.filter((s) => effectiveLabel(s) === "fail");
  const flags = call.scores.filter((s) => effectiveLabel(s) === "flag");
  const overridden = call.scores.filter((s) => s.override);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Export preview"
        description="Compliance functions live in documents. The per-call audit PDF is self-contained — metadata, per-criterion results with evidence citations, coaching findings, and every reviewer override."
      >
        <Button variant="outline" size="sm" onClick={() => toast("Sent to printer queue")}>
          <Printer className="size-4" /> Print
        </Button>
        <Button
          size="sm"
          onClick={() =>
            toast.success("Audit PDF generated", {
              description: `${call.reference}-audit-v2.4.pdf (2 pages, 184 KB) ready to download.`,
            })
          }
        >
          <FileDown className="size-4" /> Download PDF
        </Button>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Options */}
        <Reveal>
          <Card className="gap-0 py-0 lg:sticky lg:top-20">
            <CardContent className="space-y-4 p-4">
              <div>
                <Label className="text-[12px] text-muted-foreground">Call</Label>
                <Select
                  items={Object.fromEntries(candidates.map((c) => [c.id, c.reference]))}
                  value={callId}
                  onValueChange={(v) => setCallId(v as string)}
                >
                  <SelectTrigger size="sm" className="mt-1.5 w-full font-mono text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="font-mono text-[12px]">
                        {c.reference}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2.5">
                <p className="text-[12px] font-medium text-muted-foreground">Include sections</p>
                {(
                  [
                    ["coaching", "Communication coaching"],
                    ["overrides", "Reviewer overrides"],
                    ["transcriptRefs", "Evidence citations"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5 text-[13px]">
                    <Checkbox
                      checked={sections[key]}
                      onCheckedChange={(v) =>
                        setSections((s) => ({ ...s, [key]: v === true }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <Separator />
              <div className="space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                <p>Generated server-side as a self-contained PDF. Fonts and evidence embedded; no external references.</p>
                <p>Distribution is logged in the audit trail.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  toast.success("Shared with legal", {
                    description: "Watermarked copy sent to counsel@meridianwealth.com",
                  })
                }
              >
                <Send className="size-3.5" /> Share securely
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        {/* Paper preview */}
        <Reveal delay={0.08}>
          <div className="space-y-6">
            {/* Page 1 */}
            <div className="mx-auto w-full max-w-[720px] rounded-sm border bg-white p-10 text-neutral-900 shadow-lg ring-1 ring-black/5 dark:shadow-black/40">
              {/* Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded bg-neutral-900 text-white">
                      <AudioLines className="size-4" />
                    </div>
                    <p className="text-[15px] font-bold tracking-tight">Clearline</p>
                  </div>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                    Call Compliance Audit Report
                  </p>
                </div>
                <div className="text-right text-[10.5px] leading-relaxed text-neutral-500">
                  <p className="font-semibold text-neutral-800">{ORGANIZATION.name}</p>
                  <p>Report {call.reference}-A</p>
                  <p>Generated Jul 15, 2026 · Rubric v2.4</p>
                  <p className="font-medium text-neutral-700">CONFIDENTIAL — COMPLIANCE USE ONLY</p>
                </div>
              </div>

              {/* Metadata */}
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] sm:grid-cols-4">
                {[
                  ["Call reference", call.reference],
                  ["Date & time", fmtDateTime(call.date)],
                  ["Duration", fmtDuration(call.durationSec)],
                  ["Source", call.source === "audio" ? "Audio upload" : "Transcript upload"],
                  ["Representative", rep.name],
                  ["Team", rep.team],
                  ["Client", call.clientAlias],
                  ["Product discussed", call.product],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[9.5px] uppercase tracking-wider text-neutral-400">{k}</p>
                    <p className="mt-0.5 font-medium">{v}</p>
                  </div>
                ))}
              </div>

              {/* Result summary */}
              <div className="mt-6 rounded border border-neutral-300 bg-neutral-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Audit result
                  </p>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      call.riskTier === "critical" || call.riskTier === "high"
                        ? "bg-[#d03b3b] text-white"
                        : call.riskTier === "medium"
                          ? "bg-[#fab219] text-neutral-900"
                          : "bg-[#0ca30c] text-white",
                    )}
                  >
                    {call.riskTier} risk
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed">
                  {call.scores.length} criteria evaluated under rubric v2.4 ·{" "}
                  <span className="font-semibold">
                    {call.scores.length - fails.length - flags.length} passed
                  </span>
                  {flags.length > 0 && (
                    <>
                      , <span className="font-semibold">{flags.length} flagged</span>
                    </>
                  )}
                  {fails.length > 0 && (
                    <>
                      , <span className="font-semibold">{fails.length} failed</span>
                    </>
                  )}
                  . {call.summary}
                </p>
              </div>

              {/* Criteria table */}
              <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Per-criterion findings
              </p>
              <table className="mt-2 w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-[9.5px] uppercase tracking-wider text-neutral-400">
                    <th className="py-1.5 pr-2 font-semibold">Code</th>
                    <th className="py-1.5 pr-2 font-semibold">Criterion</th>
                    <th className="py-1.5 pr-2 font-semibold">Result</th>
                    <th className="py-1.5 pr-2 font-semibold">Confidence</th>
                    {sections.transcriptRefs ? (
                      <th className="py-1.5 font-semibold">Evidence</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {call.scores.map((s) => {
                    const label = effectiveLabel(s);
                    return (
                      <tr key={s.criterionId} className="border-b border-neutral-200 align-top">
                        <td className="py-2 pr-2 font-mono text-[10.5px]">{getCriterion(s.criterionId).code}</td>
                        <td className="py-2 pr-2">
                          <p className="font-medium">{getCriterion(s.criterionId).name}</p>
                          <p className="mt-0.5 text-[10.5px] leading-snug text-neutral-500">
                            {s.rationale}
                          </p>
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className={cn(
                              "font-bold",
                              label === "fail"
                                ? "text-[#a52222]"
                                : label === "flag"
                                  ? "text-[#8a5a00]"
                                  : "text-[#006300]",
                            )}
                          >
                            {LABEL_PRINT[label]}
                            {s.override ? "*" : ""}
                          </span>
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{fmtPct(s.confidence)}</td>
                        {sections.transcriptRefs ? (
                          <td className="py-2 font-mono text-[10px] text-neutral-500">
                            [{fmtTimestamp(s.evidenceTs)}]
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {overridden.length > 0 && sections.overrides ? (
                <p className="mt-1.5 text-[10px] italic text-neutral-500">
                  * Human-reviewed label. Original model judgment retained in Appendix B.
                </p>
              ) : null}

              <div className="mt-8 flex items-end justify-between border-t border-neutral-300 pt-3 text-[10px] text-neutral-400">
                <span>Clearline Audit Platform · calibrated scoring, verified Jun 2026</span>
                <span>Page 1 of 2</span>
              </div>
            </div>

            {/* Page 2 */}
            <div className="mx-auto w-full max-w-[720px] rounded-sm border bg-white p-10 text-neutral-900 shadow-lg ring-1 ring-black/5 dark:shadow-black/40">
              {sections.transcriptRefs && fails.length + flags.length > 0 ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Appendix A — Evidence citations
                  </p>
                  <div className="mt-3 space-y-3">
                    {[...fails, ...flags].map((s) => (
                      <div key={s.criterionId} className="rounded border border-neutral-200 p-3">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="font-mono font-semibold">
                            {getCriterion(s.criterionId).code} · {getCriterion(s.criterionId).name}
                          </span>
                          <span className="font-mono text-neutral-400">
                            transcript @ {fmtTimestamp(s.evidenceTs)}
                          </span>
                        </div>
                        <p className="mt-1.5 border-l-2 border-neutral-400 pl-2.5 text-[11.5px] italic leading-relaxed text-neutral-700">
                          &ldquo;{s.evidenceQuote}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {sections.overrides && overridden.length > 0 ? (
                <>
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Appendix B — Reviewer overrides
                  </p>
                  <div className="mt-3 space-y-2">
                    {overridden.map((s) => (
                      <div key={s.criterionId} className="rounded border border-neutral-200 p-3 text-[11.5px]">
                        <p className="font-medium">
                          {getCriterion(s.criterionId).code}: model {LABEL_PRINT[s.label]} →
                          human {LABEL_PRINT[s.override!.label]}
                        </p>
                        <p className="mt-0.5 leading-snug text-neutral-600">
                          {s.override!.reason}
                        </p>
                        <p className="mt-1 text-[10px] text-neutral-400">
                          {getReviewer(s.override!.reviewerId)?.name} ·{" "}
                          {fmtDateTime(s.override!.timestamp)} · original judgment retained
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {sections.coaching ? (
                <>
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Appendix C — Communication coaching summary
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px]">
                    {[
                      ["Talk ratio (rep)", fmtPct(call.metrics.talkRatioRep)],
                      ["Interruptions", String(call.metrics.interruptions)],
                      ["Long silences", String(call.metrics.longSilences)],
                      ["Longest monologue", fmtDuration(call.metrics.longestMonologueSec)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded border border-neutral-200 p-2">
                        <p className="text-[13px] font-bold tabular-nums">{v}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-wide text-neutral-400">{k}</p>
                      </div>
                    ))}
                  </div>
                  {call.findings.slice(0, 3).map((f) => (
                    <div key={f.id} className="mt-2.5 text-[11.5px]">
                      <p className="font-medium">
                        {f.type}{" "}
                        <span className="font-mono text-[10px] text-neutral-400">
                          @ {fmtTimestamp(f.ts)}
                        </span>
                      </p>
                      <p className="mt-0.5 leading-snug text-neutral-600">
                        Suggested: {f.suggestion}
                      </p>
                    </div>
                  ))}
                </>
              ) : null}

              {/* Signature */}
              <div className="mt-10 grid grid-cols-2 gap-10">
                <div className="border-t border-neutral-400 pt-2 text-[10.5px]">
                  <p className="font-semibold">{reviewer?.name ?? "Pending human review"}</p>
                  <p className="text-neutral-500">
                    {reviewer?.role ?? "Awaiting assignment"} · {reviewer ? "Reviewed" : "—"}
                  </p>
                </div>
                <div className="border-t border-neutral-400 pt-2 text-[10.5px]">
                  <p className="font-semibold">Clearline Audit Engine v3.1</p>
                  <p className="text-neutral-500">
                    Rubric v2.4 · stability & calibration verified Jun 2026
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-end justify-between border-t border-neutral-300 pt-3 text-[10px] text-neutral-400">
                <span>
                  Every judgment cites its transcript span and rubric version — defensible by
                  construction.
                </span>
                <span>Page 2 of 2</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export default function ExportPage() {
  return <RoleGate admin={<AdminExport />} rep={<AccessDenied screen="Export preview" />} />;
}
