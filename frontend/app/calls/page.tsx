"use client";

import * as React from "react";
import {
  ArrowRight,
  ArrowUpDown,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  ListFilter,
  Search,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConfidenceMeter,
  EmptyState,
  LabelBadge,
  PageHeader,
  RepAvatar,
  RiskBadge,
  StatusChip,
} from "@/components/shared";
import { Reveal } from "@/components/motion";
import { CALLS, CRITERIA, REPRESENTATIVES } from "@/lib/mock-data";
import { resolveRep } from "@/lib/live-call";
import { useLiveCalls } from "@/lib/use-live-calls";
import { callComplianceRate, effectiveLabel } from "@/lib/derived";
import { fmtDateTime, fmtDuration, fmtPct } from "@/lib/format";
import type { Call, RiskTier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRole, REP_PERSONA } from "@/components/role-context";

const PAGE_SIZE = 12;
const TIER_ORDER: Record<RiskTier, number> = { critical: 0, high: 1, medium: 2, low: 3 };

type SortKey = "risk" | "date" | "duration" | "compliance";

export default function CallsPage() {
  const { role } = useRole();
  const isRep = role === "rep";
  const [query, setQuery] = React.useState("");
  const [tier, setTier] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  const [rep, setRep] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortKey>("risk");
  const [page, setPage] = React.useState(1);
  const [preview, setPreview] = React.useState<Call | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Calls analyzed for real through /new-call, listed alongside the mock corpus
  // rather than being reachable only by direct link.
  const { calls: liveCalls } = useLiveCalls();
  const allCalls = React.useMemo(() => [...liveCalls, ...CALLS], [liveCalls]);

  // Simulated fetch for skeleton states + deep-link filter (?rep=)
  React.useEffect(() => {
    const repParam = new URLSearchParams(window.location.search).get("rep");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (repParam) setRep(repParam);
    const t = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(t);
  }, []);

  const filtered = React.useMemo(() => {
    let rows = allCalls.filter((c) => {
      if (isRep && c.repId !== REP_PERSONA.id) return false;
      if (tier !== "all" && c.riskTier !== tier) return false;
      if (status !== "all" && c.status !== status) return false;
      if (!isRep && rep !== "all" && c.repId !== rep) return false;
      if (query) {
        const q = query.toLowerCase();
        const r = resolveRep(c.repId);
        if (
          !c.reference.toLowerCase().includes(q) &&
          !r.name.toLowerCase().includes(q) &&
          !c.product.toLowerCase().includes(q) &&
          !c.clientAlias.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "date":
          return +new Date(b.date) - +new Date(a.date);
        case "duration":
          return b.durationSec - a.durationSec;
        case "compliance":
          return callComplianceRate(a) - callComplianceRate(b);
        default:
          return (
            TIER_ORDER[a.riskTier] - TIER_ORDER[b.riskTier] ||
            +new Date(b.date) - +new Date(a.date)
          );
      }
    });
    return rows;
  }, [allCalls, query, tier, status, rep, sort, isRep]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = query || tier !== "all" || status !== "all" || rep !== "all";

  const resetFilters = () => {
    setQuery("");
    setTier("all");
    setStatus("all");
    setRep("all");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title={isRep ? "My calls" : "Calls"}
        description={
          isRep
            ? "Every one of your audited calls. Open any call to see exactly which moments the audit flagged and the coaching attached to them."
            : "All audited calls, ranked by risk tier so the riskiest and least certain conversations surface first."
        }
      >
        <ButtonLink href="/new-call" variant="outline" size="sm">
          <Upload className="size-4" /> Upload recording
        </ButtonLink>
      </PageHeader>

      {/* Toolbar */}
      <Reveal>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference, rep, product…"
              className="h-8 pl-8 text-[13px]"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            items={{ all: "All tiers", critical: "Critical", high: "High", medium: "Medium", low: "Low" }}
            value={tier}
            onValueChange={(v) => { setTier(v as string); setPage(1); }}
          >
            <SelectTrigger size="sm" className="w-[130px] text-[13px]">
              <ListFilter className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Risk tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={{ all: "All statuses", pending: "Pending review", in_review: "In review", reviewed: "Reviewed", escalated: "Escalated" }}
            value={status}
            onValueChange={(v) => { setStatus(v as string); setPage(1); }}
          >
            <SelectTrigger size="sm" className="w-[150px] text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="in_review">In review</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
            </SelectContent>
          </Select>
          {!isRep ? (
          <Select
            items={Object.fromEntries([["all", "All representatives"], ...REPRESENTATIVES.map((r) => [r.id, r.name])])}
            value={rep}
            onValueChange={(v) => { setRep(v as string); setPage(1); }}
          >
            <SelectTrigger size="sm" className="w-[170px] text-[13px]">
              <SelectValue placeholder="Representative" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All representatives</SelectItem>
              {allCalls.map((c) => c.repId)
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((id) => (
                  <SelectItem key={id} value={id}>
                    {resolveRep(id).name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          ) : null}
          <Select
            items={{ risk: "Sort: Risk tier", date: "Sort: Most recent", duration: "Sort: Longest", compliance: "Sort: Lowest compliance" }}
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
          >
            <SelectTrigger size="sm" className="w-[160px] text-[13px]">
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="risk">Sort: Risk tier</SelectItem>
              <SelectItem value="date">Sort: Most recent</SelectItem>
              <SelectItem value="duration">Sort: Longest</SelectItem>
              <SelectItem value="compliance">Sort: Lowest compliance</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X className="size-3.5" /> Clear
            </Button>
          ) : null}
          <p className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">
            {filtered.length} calls
          </p>
        </div>
      </Reveal>

      {/* Table */}
      <Reveal delay={0.08} className="mt-4">
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              className="border-0"
              title="No calls match these filters"
              description="Try widening the risk tier or clearing the search. New calls appear here as soon as the pipeline scores them."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[190px] pl-4">Call</TableHead>
                    <TableHead>Representative</TableHead>
                    <TableHead className="hidden lg:table-cell">Product</TableHead>
                    <TableHead className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> Duration
                      </span>
                    </TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Compliance</TableHead>
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((call) => {
                    const repObj = resolveRep(call.repId);
                    const rate = callComplianceRate(call);
                    return (
                      <TableRow
                        key={call.id}
                        className="cursor-pointer"
                        onClick={() => setPreview(call)}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2.5">
                            {call.source === "audio" ? (
                              <AudioLines className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <div className="leading-tight">
                              <p className="font-mono text-[12px] font-medium">{call.reference}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {fmtDateTime(call.date)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RepAvatar rep={repObj} size="sm" />
                            <span className="text-[13px]">{repObj.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-[12.5px] text-muted-foreground lg:table-cell">
                          {call.product}
                        </TableCell>
                        <TableCell className="hidden text-[12.5px] tabular-nums text-muted-foreground md:table-cell">
                          {fmtDuration(call.durationSec)}
                        </TableCell>
                        <TableCell>
                          <RiskBadge tier={call.riskTier} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusChip status={call.status} />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  rate >= 0.9
                                    ? "bg-status-good"
                                    : rate >= 0.7
                                      ? "bg-status-warning"
                                      : "bg-status-critical",
                                )}
                                style={{ width: `${rate * 100}%` }}
                              />
                            </div>
                            <span className="text-[12px] tabular-nums text-muted-foreground">
                              {fmtPct(rate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            aria-label="Quick preview"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreview(call);
                            }}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && rows.length > 0 ? (
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <p className="text-[12px] text-muted-foreground tabular-nums">
                Page {safePage} of {pageCount} · showing {rows.length} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                  const p = i + Math.max(1, Math.min(safePage - 2, pageCount - 4));
                  return (
                    <Button
                      key={p}
                      variant={p === safePage ? "secondary" : "ghost"}
                      size="icon-sm"
                      className="tabular-nums"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Reveal>

      {/* Quick preview panel */}
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          {preview ? (
            <>
              <SheetHeader className="border-b pb-4">
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-mono text-sm">{preview.reference}</SheetTitle>
                  <RiskBadge tier={preview.riskTier} />
                  <StatusChip status={preview.status} />
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  {resolveRep(preview.repId).name} · {preview.clientAlias} ·{" "}
                  {fmtDateTime(preview.date)} · {fmtDuration(preview.durationSec)}
                </p>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto p-5 thin-scroll">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Summary
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed">{preview.summary}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Product
                  </p>
                  <p className="mt-1.5 text-[13px]">{preview.product}</p>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Compliance criteria · rubric v2.4
                    </p>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {preview.scores.map((s) => {
                      const crit = CRITERIA.find((c) => c.id === s.criterionId)!;
                      return (
                        <div key={s.criterionId} className="flex items-center gap-3">
                          <LabelBadge
                            label={effectiveLabel(s)}
                            className="w-16 justify-center"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {crit.code}
                              </span>{" "}
                              {crit.name}
                            </p>
                          </div>
                          <ConfidenceMeter value={s.confidence} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Coaching findings
                  </p>
                  {preview.findings.length === 0 ? (
                    <p className="mt-1.5 text-[13px] text-muted-foreground">
                      No coaching findings — strong conversation.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {preview.findings.slice(0, 6).map((f) => (
                        <Badge key={f.id} variant="secondary" className="text-[11px]">
                          {f.type}
                        </Badge>
                      ))}
                      {preview.findings.length > 6 ? (
                        <Badge variant="outline" className="text-[11px]">
                          +{preview.findings.length - 6} more
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t p-4">
                <ButtonLink href={`/calls/${preview.id}`} className="w-full">
                  Open full audit <ArrowRight className="size-4" />
                </ButtonLink>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
