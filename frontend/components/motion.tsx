import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Entrance transitions are CSS-driven (tw-animate-css) so they complete even
 * when rAF is throttled (background tabs, embedded previews). Framer Motion
 * remains available for gesture-driven micro-interactions.
 */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 ease-out",
        className,
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

export function Stagger({
  children,
  className,
  step = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
}) {
  const items = React.Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <div
          key={i}
          className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 ease-out"
          style={{ animationDelay: `${i * step}s` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/** Kept for API compatibility — Stagger animates its direct children. */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
