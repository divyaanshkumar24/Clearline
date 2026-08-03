"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  ConfidenceMeter,
  LabelBadge,
  PageHeader,
  RepAvatar,
} from "@/components/shared";
import { Reveal, Stagger } from "@/components/motion";
import { CALLS, CRITERIA, RUBRIC_VERSIONS, getRep } from "@/lib/mock-data";
import { effectiveLabel } from "@/lib/derived";
import { fmtPct, fmtTimestamp } from "@/lib/format";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AccessDenied, RoleGate } from "@/components/role-gate";

const SEVERITY_META: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: "Critical severity",
    className: "border-status-critical/30 bg-status-critical/10 text-status-critical-fg",
  },
  high: {
    label: "High severity",
    className: "border-status-serious/30 bg-status-serious/10 text-status-serious-fg",
  },
  medium: {
    label: "Medium severity",
    className: "border-status-warning/40 bg-status-warning/10 text-status-warning-fg",
  },
};

function AdminCompliance() {
  const [version, setVersion] = React.useState("rub-24");

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Compliance"
        description="Per-criterion posture across all audited calls. Every judgment carries its evidence span, rationale, calibrated confidence, and the rubric version it was scored under."
      >
        <Select
          items={Object.fromEntries(
            RUBRIC_VERSIONS.filter((r) => r.status !== "draft").map((r) => [
              r.id,
              `Rubric ${r.version}${r.status === "active" ? " (active)" : ""}`,
            ]),
          )}
          value={version}
          onValueChange={(v) => setVersion(v as string)}
        >
          <SelectTrigger size="sm" className="w-[210px] text-[13px]">
            <BookOpenCheck className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RUBRIC_VERSIONS.filter((r) => r.status !== "draft").map((r) => (
              <SelectItem key={r.id} value={r.id}>
                Rubric {r.version}
                {r.status === "active" ? " (active)" : ` · ${r.effectiveDate}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {version !== "rub-24" ? (
        <Reveal>
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-status-warning/40 bg-status-warning/8 px-4 py-2.5 text-[13px]">
            <ShieldAlert className="size-4 shrink-0 text-status-warning-fg" />
            <p>
              Viewing historical results under rubric{" "}
              <span className="font-medium">
                {RUBRIC_VERSIONS.find((r) => r.id === version)?.version}
              </span>
              . 41 calls were re-audited when v2.4 took effect —{" "}
              <Link href="/rubrics" className="font-medium text-primary hover:underline">
                see the re-audit diff
              </Link>
              .
            </p>
          </div>
        </Reveal>
      ) : null}

      <Stagger className="space-y-3">
        {CRITERIA.map((crit) => {
          const scores = CALLS.flatMap((c) =>
            c.scores
              .filter((s) => s.criterionId === crit.id)
              .map((s) => ({ ...s, call: c })),
          );
          const pass = scores.filter((s) => effectiveLabel(s) === "pass").length;
          const flag = scores.filter((s) => effectiveLabel(s) === "flag").length;
          const fail = scores.filter((s) => effectiveLabel(s) === "fail").length;
          const total = scores.length;
          const avgConf =
            scores.reduce((a, s) => a + s.confidence, 0) / Math.max(1, total);
          const worst = scores
            .filter((s) => effectiveLabel(s) === "fail")
            .sort((a, b) => a.confidence - b.confidence)
            .slice(0, 3);

          return (
            <Collapsible key={crit.id}>
              <Card
                className={cn(
                  "gap-0 py-0",
                  fail > 8 && "border-status-critical/25",
                )}
              >
                <CardContent className="p-4.5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        fail > 0
                          ? "bg-status-critical/10 text-status-critical-fg"
                          : flag > 0
                            ? "bg-status-warning/10 text-status-warning-fg"
                            : "bg-status-good/10 text-status-good-fg",
                      )}
                    >
                      {fail > 0 ? (
                        <ShieldX className="size-4.5" />
                      ) : flag > 0 ? (
                        <ShieldAlert className="size-4.5" />
                      ) : (
                        <ShieldCheck className="size-4.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold">
                          <span className="font-mono text-[11.5px] font-medium text-muted-foreground">
                            {crit.code}
                          </span>{" "}
                          {crit.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn("h-5 text-[10px] font-medium", SEVERITY_META[crit.severity].className)}
                        >
                          {SEVERITY_META[crit.severity].label}
                        </Badge>
                        <Badge variant="secondary" className="h-5 text-[10px] font-medium">
                          {crit.category}
                        </Badge>
                      </div>
                      <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
                        {crit.description}
                      </p>

                      {/* Distribution bar */}
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex h-2 max-w-md flex-1 gap-0.5 overflow-hidden rounded-full">
                          <div
                            className="bg-status-good"
                            style={{ width: `${(pass / total) * 100}%` }}
                          />
                          <div
                            className="bg-status-warning"
                            style={{ width: `${(flag / total) * 100}%` }}
                          />
                          <div
                            className="bg-status-critical"
                            style={{ width: `${(fail / total) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-[11.5px] tabular-nums">
                          <span className="text-status-good-fg">
                            {pass} pass
                          </span>
                          <span className="text-status-warning-fg">
                            {flag} flag
                          </span>
                          <span className="text-status-critical-fg">
                            {fail} fail
                          </span>
                          <span className="text-muted-foreground">
                            {fmtPct(pass / total)} compliant
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        Avg confidence
                      </p>
                      <ConfidenceMeter value={avgConf} />
                    </div>
                  </div>

                  {worst.length > 0 ? (
                    <>
                      <CollapsibleTrigger className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline">
                        <ChevronDown className="size-3.5 transition-transform in-data-[panel-open]:rotate-180" />
                        Review {fail} failing calls — lowest confidence first
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Separator className="my-3" />
                        <div className="space-y-2.5">
                          {worst.map((s) => (
                            <div
                              key={s.call.id}
                              className="flex flex-wrap items-start gap-3 rounded-lg border bg-muted/30 p-3"
                            >
                              <LabelBadge label={effectiveLabel(s)} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                  <Link
                                    href={`/calls/${s.call.id}`}
                                    className="font-mono font-medium text-primary hover:underline"
                                  >
                                    {s.call.reference}
                                  </Link>
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <RepAvatar rep={getRep(s.call.repId)} size="sm" className="size-4.5 text-[8px]" />
                                    {getRep(s.call.repId).name}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    evidence @ {fmtTimestamp(s.evidenceTs)}
                                  </span>
                                </div>
                                <p className="mt-1.5 border-l-2 border-status-critical/50 pl-2.5 text-[12.5px] italic leading-relaxed">
                                  &ldquo;{s.evidenceQuote}&rdquo;
                                </p>
                                <p className="mt-1 text-[11.5px] text-muted-foreground">
                                  {s.rationale}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <ConfidenceMeter value={s.confidence} />
                                <Link
                                  href={`/calls/${s.call.id}`}
                                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                  Open audit <ExternalLink className="size-3" />
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </Stagger>
    </div>
  );
}

export default function CompliancePage() {
  return <RoleGate admin={<AdminCompliance />} rep={<AccessDenied screen="The compliance view" />} />;
}
