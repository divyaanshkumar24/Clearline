"use client";

import * as React from "react";
import {
  BookOpenCheck,
  CalendarClock,
  FileDiff,
  GitBranch,
  Minus,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { Reveal } from "@/components/motion";
import { CRITERIA, RUBRIC_VERSIONS } from "@/lib/mock-data";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AccessDenied, RoleGate } from "@/components/role-gate";

const SEV_BADGE: Record<Severity, string> = {
  critical: "border-status-critical/30 bg-status-critical/10 text-status-critical-fg",
  high: "border-status-serious/30 bg-status-serious/10 text-status-serious-fg",
  medium: "border-status-warning/40 bg-status-warning/10 text-status-warning-fg",
};

const DIFF = [
  { type: "ctx", code: "C-05", text: "Suitability — objectives & horizon (medium)" },
  {
    type: "del",
    code: "C-06",
    text: "Prohibited: “guaranteed return”, “risk-free”, “sure thing”",
  },
  {
    type: "add",
    code: "C-06",
    text: "Prohibited: “guaranteed return”, “risk-free”, “sure thing”, “assured growth”, “can't lose”",
  },
  { type: "del", code: "C-07", text: "No pressure tactics — severity: medium" },
  { type: "add", code: "C-07", text: "No pressure tactics — severity: high" },
  { type: "ctx", code: "C-08", text: "Fair & balanced presentation (medium)" },
  {
    type: "add",
    code: "C-04",
    text: "Suitability now explicitly requires a liquidity-needs question",
  },
];

const REAUDIT_DIFF = [
  { call: "CALL-26701-0034", crit: "C-06", from: "flag", to: "fail", tier: "high → critical" },
  { call: "CALL-26701-0058", crit: "C-07", from: "pass", to: "flag", tier: "low → medium" },
  { call: "CALL-26700-0091", crit: "C-04", from: "pass", to: "flag", tier: "medium → medium" },
];

function AdminRubrics() {
  const [selected, setSelected] = React.useState("rub-24");
  const version = RUBRIC_VERSIONS.find((r) => r.id === selected)!;

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Rubric management"
        description="The compliance rubric is first-class, versioned data — not a static prompt. Every score records the version it was judged under, so every historical judgment stays defensible."
      >
        <Button
          size="sm"
          onClick={() =>
            toast.success("Draft v2.5 opened for editing", {
              description: "Changes take effect only when published with an effective date.",
            })
          }
        >
          <Pencil className="size-3.5" /> Edit draft v2.5
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Version history */}
        <Reveal>
          <Card className="gap-0 py-0">
            <CardContent className="p-3">
              <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Version history
              </p>
              <div className="space-y-1">
                {RUBRIC_VERSIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors",
                      selected === r.id ? "border-border bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <GitBranch
                      className={cn(
                        "mt-0.5 size-4",
                        r.status === "active"
                          ? "text-status-good"
                          : r.status === "draft"
                            ? "text-status-warning"
                            : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold">{r.version}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4.5 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide",
                            r.status === "active" &&
                              "border-status-good/30 bg-status-good/10 text-status-good-fg",
                            r.status === "draft" &&
                              "border-status-warning/40 bg-status-warning/10 text-status-warning-fg",
                            r.status === "superseded" && "text-muted-foreground",
                          )}
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="size-3" />
                        {r.status === "draft" ? "Not yet effective" : `Effective ${r.effectiveDate}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.criteriaCount} criteria · {r.author}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* Detail */}
        <Reveal delay={0.08} className="min-w-0">
          <Tabs defaultValue="rules">
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="rules" className="gap-1.5">
                  <BookOpenCheck className="size-3.5" /> Rules
                </TabsTrigger>
                <TabsTrigger value="diff" className="gap-1.5">
                  <FileDiff className="size-3.5" /> Diff v2.3 → v2.4
                </TabsTrigger>
                <TabsTrigger value="reaudit" className="gap-1.5">
                  <RefreshCcw className="size-3.5" /> Re-audit
                </TabsTrigger>
              </TabsList>
              <p className="ml-auto text-[12px] text-muted-foreground">
                Viewing <span className="font-medium text-foreground">{version.version}</span>
                {version.status === "active" ? " — currently scoring all new calls" : ""}
              </p>
            </div>

            {/* Rules */}
            <TabsContent value="rules" className="mt-3 space-y-4">
              <Card className="gap-0 py-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-16 pl-4">Code</TableHead>
                          <TableHead>Criterion</TableHead>
                          <TableHead className="w-32">Category</TableHead>
                          <TableHead className="w-36">Severity</TableHead>
                          <TableHead className="w-14" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {CRITERIA.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="pl-4 font-mono text-[12px] font-medium">
                              {c.code}
                            </TableCell>
                            <TableCell>
                              <p className="text-[13px] font-medium">{c.name}</p>
                              <p className="mt-0.5 max-w-xl text-[11.5px] leading-snug text-muted-foreground">
                                {c.description}
                              </p>
                            </TableCell>
                            <TableCell className="text-[12px] text-muted-foreground">
                              {c.category}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn("h-5 text-[10px] font-medium capitalize", SEV_BADGE[c.severity])}
                              >
                                {c.severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground"
                                aria-label={`Edit ${c.code}`}
                                onClick={() =>
                                  toast(`${c.code} is read-only in ${version.version}`, {
                                    description:
                                      "Published rubric versions are immutable. Edit the v2.5 draft instead.",
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 py-0">
                <CardContent className="p-4">
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    Changelog — {version.version}
                  </h3>
                  <ul className="mt-2.5 space-y-1.5">
                    {version.changelog.map((c, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Diff viewer */}
            <TabsContent value="diff" className="mt-3">
              <Card className="gap-0 overflow-hidden py-0">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-[12.5px]">
                  <FileDiff className="size-4 text-muted-foreground" />
                  <span className="font-mono">v2.3</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono font-medium">v2.4</span>
                  <span className="ml-auto text-[11.5px] text-muted-foreground">
                    2 rules changed · 1 requirement added · effective 2026-06-01
                  </span>
                </div>
                <CardContent className="p-0 font-mono text-[12px] leading-6">
                  {DIFF.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3 border-l-2 px-4 py-1",
                        d.type === "add" &&
                          "border-status-good bg-status-good/8 text-status-good-fg",
                        d.type === "del" &&
                          "border-status-critical bg-status-critical/8 text-status-critical-fg line-through decoration-status-critical/50",
                        d.type === "ctx" && "border-transparent text-muted-foreground",
                      )}
                    >
                      <span className="w-4 shrink-0 select-none">
                        {d.type === "add" ? (
                          <Plus className="mt-1.5 size-3" />
                        ) : d.type === "del" ? (
                          <Minus className="mt-1.5 size-3" />
                        ) : null}
                      </span>
                      <span className="w-10 shrink-0 text-muted-foreground/70">{d.code}</span>
                      <span className="whitespace-pre-wrap">{d.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Re-audit */}
            <TabsContent value="reaudit" className="mt-3 space-y-4">
              <Card className="gap-0 py-0">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <RefreshCcw className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13.5px] font-semibold">
                        Re-audit historical calls under {version.version}
                      </h3>
                      <p className="text-[12.5px] text-muted-foreground">
                        Rescores prior calls and produces an explicit diff: which calls
                        changed status, on which criteria, and why. Original scores are
                        never overwritten.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        toast.success("Re-audit started — 87 calls queued", {
                          description:
                            "Estimated 6 minutes. You'll be notified when the diff is ready.",
                        })
                      }
                    >
                      <RefreshCcw className="size-3.5" /> Run re-audit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 py-0">
                <CardContent className="p-4">
                  <h3 className="text-[13.5px] font-semibold">
                    Last re-audit — Jun 1, 2026 (v2.3 → v2.4)
                  </h3>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    41 calls re-scored · 3 changed status · 38 unchanged
                  </p>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    {REAUDIT_DIFF.map((r) => (
                      <div
                        key={r.call}
                        className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-[12.5px]"
                      >
                        <span className="font-mono font-medium">{r.call}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {r.crit}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Badge variant="outline" className="h-5 text-[10px] capitalize text-muted-foreground">
                            {r.from}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 text-[10px] font-medium capitalize",
                              r.to === "fail"
                                ? "border-status-critical/30 bg-status-critical/10 text-status-critical-fg"
                                : "border-status-warning/40 bg-status-warning/10 text-status-warning-fg",
                            )}
                          >
                            {r.to}
                          </Badge>
                        </span>
                        <span className="ml-auto text-[11.5px] text-muted-foreground">
                          tier {r.tier}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Reveal>
      </div>
    </div>
  );
}

export default function RubricsPage() {
  return <RoleGate admin={<AdminRubrics />} rep={<AccessDenied screen="Rubric management" />} />;
}
