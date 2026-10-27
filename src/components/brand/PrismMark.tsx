import { useId } from "react";

/** The GitPrism mark: one white beam enters a prism and leaves as a spectrum. */
export function PrismMark({ className = "h-7 w-7" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B6A0FF" />
          <stop offset="0.55" stopColor="#7654E8" />
          <stop offset="1" stopColor="#3B2A8F" />
        </linearGradient>
      </defs>
      <path d="M1 17.5 L11.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path d="M15 4 L25 26 H5 Z" fill={`url(#${id}-glass)`} />
      <path d="M15 4 L19.5 26 H25 Z" fill="#fff" opacity="0.18" />
      <path d="M20.2 15.3 L31 12.2" stroke="#68D9F5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20.9 17 L31 17" stroke="#B6A0FF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21.6 18.7 L31 21.8" stroke="#E85AC4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <PrismMark />
      <span className="display text-[1.2rem] leading-none tracking-[-0.03em]">
        Git<span className="font-[450] text-violet-ink">Prism</span>
      </span>
    </span>
  );
}
