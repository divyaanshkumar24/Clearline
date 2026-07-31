"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AudioLines,
  BarChart3,
  BookOpenCheck,
  FileDown,
  GaugeCircle,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Mic,
  Moon,
  PanelLeft,
  Phone,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  UserRoundCog,
  Bell,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CALLS, ORGANIZATION } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import {
  ADMIN_PERSONA,
  REP_PERSONA,
  RoleProvider,
  useRole,
  type Role,
} from "@/components/role-context";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
};

const ADMIN_NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "Operate",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calls", label: "Calls", icon: Phone },
      { href: "/review", label: "Review queue", icon: ListChecks, badge: true },
    ],
  },
  {
    section: "Analyze",
    items: [
      { href: "/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/coaching", label: "Coaching", icon: MessagesSquare },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Govern",
    items: [
      { href: "/rubrics", label: "Rubric management", icon: BookOpenCheck },
      { href: "/export", label: "Export preview", icon: FileDown },
    ],
  },
];

const REP_NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "My workspace",
    items: [
      { href: "/", label: "My performance", icon: LayoutDashboard },
      { href: "/calls", label: "My calls", icon: Phone },
      { href: "/coaching", label: "My coaching", icon: MessagesSquare },
    ],
  },
];

function navForRole(role: Role) {
  return role === "admin" ? ADMIN_NAV : REP_NAV;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useRole();
  const pendingCount = CALLS.filter(
    (c) => c.status === "pending" || c.status === "in_review",
  ).length;
  return (
    <nav className="flex flex-col gap-5 px-3">
      {navForRole(role).map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {group.section}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.badge ? (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
                    >
                      {pendingCount}
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useRole();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-6 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <AudioLines className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Clearline</p>
          <p className="text-[11px] text-muted-foreground">Call Audit Platform</p>
        </div>
      </div>
      <div className="px-3 pb-4">
        <ButtonLink href="/new-call" className="w-full justify-center" onClick={onNavigate}>
          <Mic className="size-4" />
          New call
        </ButtonLink>
      </div>
      <div className="flex-1 overflow-y-auto pb-4 thin-scroll">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold">
            MW
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12.5px] font-medium">{ORGANIZATION.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {role === "admin" ? `${ORGANIZATION.plan} · Rubric v2.4` : `${REP_PERSONA.team} team`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const router = useRouter();
  const { role } = useRole();
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const riskCalls =
    role === "admin"
      ? CALLS.filter((c) => c.riskTier === "critical").slice(0, 5)
      : CALLS.filter((c) => c.repId === REP_PERSONA.id && c.riskTier !== "low").slice(0, 5);
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search calls, screens, representatives…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Screens">
          {navForRole(role)
            .flatMap((g) => g.items)
            .map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon className="size-4" />
                {item.label}
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandGroup heading={role === "admin" ? "High-risk calls" : "My flagged calls"}>
          {riskCalls.map((c) => (
            <CommandItem key={c.id} onSelect={() => go(`/calls/${c.id}`)}>
              <GaugeCircle className="size-4 text-status-critical" />
              <span className="font-mono text-xs">{c.reference}</span>
              <span className="truncate text-muted-foreground">{c.summary}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { role, setRole, signedIn, signOut, ready } = useRole();
  const [mounted, setMounted] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // Marketing pages render without the app chrome
  const bare = pathname.startsWith("/landing");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (ready && !signedIn && !bare) {
      router.replace("/landing");
    }
  }, [ready, signedIn, bare, router]);

  const persona =
    role === "admin"
      ? { name: ADMIN_PERSONA.name, sub: ADMIN_PERSONA.role, initials: ADMIN_PERSONA.initials }
      : { name: REP_PERSONA.name, sub: `Representative · ${REP_PERSONA.team}`, initials: REP_PERSONA.initials };

  const switchRole = (r: Role) => {
    if (r === role) return;
    setRole(r);
    router.push("/");
  };

  if (!ready) {
    if (bare) {
      return (
        <>
          {children}
          <Toaster position="bottom-right" />
        </>
      );
    }
    return null;
  }

  if (!signedIn && !bare) {
    return null;
  }

  if (bare) {
    return (
      <>
        {children}
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarInner />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" className="lg:hidden" />}
            >
              <PanelLeft className="size-4.5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarInner onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setCmdOpen(true)}
            className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border bg-card px-3 text-[13px] text-muted-foreground shadow-xs transition-colors hover:bg-accent"
          >
            <Search className="size-3.5" />
            <span>Search…</span>
            <kbd className="ml-auto rounded border bg-muted px-1.5 py-px font-mono text-[10px] hidden sm:inline-block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {role === "admin" ? (
              <Badge
                variant="outline"
                className="hidden gap-1.5 border-status-good/30 bg-status-good/5 text-[11px] font-medium text-status-good-fg sm:inline-flex"
              >
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-good opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-status-good" />
                </span>
                Pipeline healthy
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="hidden gap-1.5 border-primary/25 bg-primary/5 text-[11px] font-medium text-primary sm:inline-flex"
              >
                <UserRound className="size-3" />
                Representative view
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4.5" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-status-critical" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="size-4.5" />
              ) : (
                <Moon className="size-4.5" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-1 rounded-full outline-offset-2">
                <Avatar className="size-7.5 border">
                  <AvatarFallback
                    className={cn(
                      "text-[11px] font-semibold",
                      role === "admin"
                        ? "bg-primary/10 text-primary"
                        : "bg-chart-2/15 text-status-good-fg",
                    )}
                  >
                    {persona.initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <p className="text-[13px] font-medium">{persona.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{persona.sub}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                  Switch persona (demo)
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => switchRole("admin")}>
                  <UserRoundCog className="size-4" />
                  <div className="flex-1 leading-tight">
                    <p className="text-[13px]">{ADMIN_PERSONA.name}</p>
                    <p className="text-[11px] text-muted-foreground">Admin · {ADMIN_PERSONA.role}</p>
                  </div>
                  {role === "admin" ? <Check className="size-3.5 text-primary" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchRole("rep")}>
                  <UserRound className="size-4" />
                  <div className="flex-1 leading-tight">
                    <p className="text-[13px]">{REP_PERSONA.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Employee · Representative
                    </p>
                  </div>
                  {role === "rep" ? <Check className="size-3.5 text-primary" /> : null}
                </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Notification settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  signOut();
                  router.replace("/landing");
                }}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
      <Toaster position="bottom-right" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <ShellInner>{children}</ShellInner>
    </RoleProvider>
  );
}
