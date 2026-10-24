// Soft ambient light behind a section, in the spectrum colours.
// Purely decorative: no layout, no pointer events, no motion.

type Tone = "violet" | "cyan" | "magenta" | "amber" | "green";

const VAR: Record<Tone, string> = {
  violet: "var(--violet)",
  cyan: "var(--cyan)",
  magenta: "var(--magenta)",
  amber: "var(--amber)",
  green: "var(--add)",
};

const SPOTS = [
  { left: "-8%", top: "-12%", size: "56vmax" },
  { left: "62%", top: "28%", size: "48vmax" },
  { left: "18%", top: "70%", size: "40vmax" },
];

export function Aurora({ tones, strength = 1, className = "" }: { tones: Tone[]; strength?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {tones.slice(0, 3).map((t, i) => (
        <span
          key={t + i}
          className="absolute rounded-full opacity-[0.13] blur-[90px] dark:opacity-[0.16]"
          style={{
            left: SPOTS[i].left,
            top: SPOTS[i].top,
            width: SPOTS[i].size,
            height: SPOTS[i].size,
            background: `radial-gradient(circle, ${VAR[t]}, transparent 65%)`,
            transform: `scale(${strength})`,
          }}
        />
      ))}
    </div>
  );
}
