import type { ReactNode } from "react";

/** Chapter heading. Chapters are a real sequence, so they are numbered. */
export function Chapter({
  n,
  name,
  title,
  children,
  className = "",
  id,
  compact = false,
}: {
  n: number;
  name: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  /** Smaller title for headings that share the screen with a sticky stage. */
  compact?: boolean;
}) {
  return (
    <header className={`max-w-[44rem] ${className}`}>
      <p className="mb-5 flex items-center gap-3 text-[0.9rem] text-ink-3">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-line-2 font-mono text-[0.75rem] text-violet">
          {n}
        </span>
        <span>
          Chapter {n}, <span className="text-ink">{name}</span>
        </span>
      </p>
      <h2
        id={id}
        className={`display text-ink ${compact ? "text-[clamp(2.2rem,3.6vw,3.6rem)]" : "text-[clamp(2.6rem,5.6vw,4.9rem)]"}`}
      >
        {title}
      </h2>
      {children && <div className="mt-6 max-w-[38rem] text-[1.08rem] leading-relaxed text-ink-2">{children}</div>}
    </header>
  );
}
