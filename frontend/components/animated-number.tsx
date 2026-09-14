"use client";

import * as React from "react";
import { animate, useMotionValue } from "framer-motion";

/**
 * Animates a number counting up (or down) from its previous value to `value`
 * whenever `value` changes, rendering through `format` at every frame rather
 * than jumping straight to the final text. Used for KPI figures so the
 * dashboard feels alive on load instead of numbers just appearing.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = React.useState(() => format(0));
  const first = React.useRef(true);

  React.useEffect(() => {
    // First mount starts from 0 for the "counting up" effect; later updates
    // (e.g. a filter changing the figure) animate from wherever it last was.
    const from = first.current ? 0 : motionValue.get();
    first.current = false;
    motionValue.set(from);
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(format(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
