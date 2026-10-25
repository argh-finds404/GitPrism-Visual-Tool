"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/skiper-ui/skiper101";
import { cn } from "@/lib/utils";

/**
 * Explains a value in place. Used on the object IDs this app is made of: the ID stays the thing you
 * read, and what it is sits one hover or one Tab away. Radix renders a real button, so it answers
 * to the keyboard and to screen readers too.
 */
export function InfoTip({ children, label, className }: { children: ReactNode; label: ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "cursor-help rounded underline decoration-dotted decoration-[1px] underline-offset-[3px]",
          "decoration-current/40 transition-colors hover:decoration-current focus-visible:decoration-current",
          className,
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
