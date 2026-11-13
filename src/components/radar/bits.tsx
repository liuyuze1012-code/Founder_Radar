import type { ReactNode } from "react";
import { laneOf } from "@/lib/radar";

export function SampleBanner({ show }: { show: boolean | null | undefined }) {
  if (!show) return null;
  return (
    <div className="mb-6 rounded-md border border-sample-foreground/20 bg-sample px-4 py-2 text-sm font-medium text-sample-foreground">
      Sample data — fictional people shown for demonstration.
    </div>
  );
}

const laneStyles: Record<string, string> = {
  pre_intent: "bg-lane-pre-soft text-lane-pre border-lane-pre/30",
  exploring: "bg-lane-exp-soft text-lane-exp border-lane-exp/30",
  already_moving: "bg-lane-mov-soft text-lane-mov border-lane-mov/30",
};
export const laneBar: Record<string, string> = {
  pre_intent: "bg-lane-pre",
  exploring: "bg-lane-exp",
  already_moving: "bg-lane-mov",
};

export function LaneBadge({ lane }: { lane: string | null }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${laneStyles[lane ?? ""] ?? ""}`}>
      {laneOf(lane).title}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded border border-border bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{children}</span>;
}

export function fmtScore(n: number | string | null | undefined) {
  if (n == null) return "–";
  return Number(n).toFixed(1);
}

export function Scores({ r, p, t }: { r: unknown; p: unknown; t: unknown }) {
  const items = [
    ["Research potential", r],
    ["Founder propensity", p],
    ["Timing", t],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([label, v]) => (
        <div key={label} className="rounded-md bg-secondary px-2 py-1.5">
          <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
          <div className="text-base font-semibold">
            {fmtScore(v as number)}<span className="text-xs font-normal text-muted-foreground">/10</span>
          </div>
        </div>
      ))}
    </div>
  );
}
