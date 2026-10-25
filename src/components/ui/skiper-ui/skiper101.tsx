"use client";

/**
 * Tooltip — adapted from Skiper UI's skiper101.
 *
 * Theirs is the idea worth keeping: a Radix tooltip whose arrow is drawn as part of the border, so
 * the bubble reads as one outlined shape instead of a box with a triangle stuck to it. The demo
 * wrapper is dropped, the shadcn colour tokens are mapped onto this project's, and the entrance
 * uses the `motion` package already here rather than the tailwindcss-animate utilities it assumed.
 *
 * Re-running `shadcn add @skiper-ui/skiper101 --overwrite` replaces this file with the demo again.
 */

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

function TooltipProvider({ delayDuration = 160, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit max-w-[18rem] text-balance rounded-lg border border-line-2 bg-surface px-2.5 py-1.5",
          "text-[0.78rem] leading-snug text-ink shadow-[0_18px_40px_-20px_rgb(0_0_0/0.55)]",
          "origin-(--radix-tooltip-content-transform-origin) tooltip-in",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow asChild>
          <span>
            <BorderArrow />
          </span>
        </TooltipPrimitive.Arrow>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/** The arrow, drawn so its two edges continue the bubble's border and its fill matches the surface. */
function BorderArrow() {
  return (
    <svg width="12" height="6" viewBox="0 0 12 6" fill="none" aria-hidden="true" className="block">
      <path d="M0 0 L6 6 L12 0" fill="var(--surface)" />
      <path d="M0 0 L6 6 L12 0" stroke="var(--line-2)" strokeWidth="1" fill="none" />
    </svg>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
