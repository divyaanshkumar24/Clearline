"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/**
 * Fades/slides each route's content in on mount, keyed by pathname so a
 * navigation re-triggers it. Next unmounts the previous page itself, so
 * there's no exit animation to coordinate — just a smooth entrance instead
 * of the page snapping into place.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
