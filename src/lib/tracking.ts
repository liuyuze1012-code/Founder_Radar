// The tracked list lives in this browser only (localStorage). No account, no database table.
import { useSyncExternalStore } from "react";

export type TrackedSignal = {
  type: string;
  group: string;
  label: string;
  value: string;
  points: number | null;
  max: number | null;
  status: string;
};

export type TrackedPerson = {
  pickId: string;
  name: string;
  school: string | null;
  tracks: string[];
  lane: string | null;
  action: string | null;
  research: number | null;
  propensity: number | null;
  timing: number | null;
  why: string | null;
  trackedAt: string;
  lastCheckedAt: string | null;
  signals: TrackedSignal[];
  /** Newest first. An entry with no items means "checked, nothing changed". */
  history: { at: string; items: string[] }[];
};

export type Fresh = Pick<
  TrackedPerson,
  "lane" | "action" | "research" | "propensity" | "timing" | "why"
> & {
  signals: TrackedSignal[];
};

const KEY = "founder-radar.tracked.v1";
const EMPTY: Record<string, TrackedPerson> = {};
let cache: Record<string, TrackedPerson> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, TrackedPerson> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, TrackedPerson>;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, TrackedPerson>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked (private window). The list then lasts for this visit only.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTracked(): Record<string, TrackedPerson> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function track(person: Omit<TrackedPerson, "trackedAt" | "lastCheckedAt" | "history">) {
  write({
    ...read(),
    [person.pickId]: {
      ...person,
      trackedAt: new Date().toISOString(),
      lastCheckedAt: null,
      history: [],
    },
  });
}

export function untrack(pickId: string) {
  const next = { ...read() };
  delete next[pickId];
  write(next);
}

const LANE_NAMES: Record<string, string> = {
  pre_intent: "Pre-intent",
  exploring: "Exploring",
  already_moving: "Already moving",
};
const fmt = (n: number | null) => (n == null ? "–" : Number(n).toFixed(1));

/** Plain-language list of what differs between the stored check and a fresh one. */
export function diff(old: TrackedPerson, fresh: Fresh): string[] {
  const out: string[] = [];
  if (old.lane !== fresh.lane) {
    out.push(`Lane: ${LANE_NAMES[old.lane ?? ""] ?? "–"} → ${LANE_NAMES[fresh.lane ?? ""] ?? "–"}`);
  }
  if (old.action !== fresh.action)
    out.push(`Recommended action: ${old.action ?? "–"} → ${fresh.action ?? "–"}`);
  const scores = [
    ["Research potential", old.research, fresh.research],
    ["Founder propensity", old.propensity, fresh.propensity],
    ["Timing", old.timing, fresh.timing],
  ] as const;
  for (const [label, a, b] of scores) {
    if (a != null && b != null && Math.abs(Number(a) - Number(b)) >= 0.05)
      out.push(`${label}: ${fmt(a)} → ${fmt(b)}`);
  }
  const before = new Map(old.signals.map((s) => [s.type, s]));
  for (const s of fresh.signals) {
    const prev = before.get(s.type);
    // A failed lookup is not a change in the person.
    if (s.status === "unknown" || prev?.status === "unknown") continue;
    if (!prev) {
      if (s.status === "observed" && (s.group === "lane" || (s.points ?? 0) > 0))
        out.push(`New: ${s.label}: ${s.value}`);
    } else if (prev.value !== s.value || prev.points !== s.points) {
      out.push(`${s.label}: ${prev.value} → ${s.value}`);
    }
  }
  const after = new Set(fresh.signals.map((s) => s.type));
  for (const s of old.signals) {
    if (!after.has(s.type) && s.group === "lane") out.push(`No longer found: ${s.label}`);
  }
  return out;
}

/** Store a fresh check for each person and record what changed. Returns the number of people with changes. */
export function applyRecheck(results: (Fresh & { pickId: string })[], checkedAt: string): number {
  const next = { ...read() };
  let changed = 0;
  for (const r of results) {
    const old = next[r.pickId];
    if (!old) continue;
    const items = diff(old, r);
    if (items.length) changed++;
    next[r.pickId] = {
      ...old,
      lane: r.lane,
      action: r.action,
      research: r.research,
      propensity: r.propensity,
      timing: r.timing,
      why: r.why,
      signals: r.signals,
      lastCheckedAt: checkedAt,
      history: [{ at: checkedAt, items }, ...old.history].slice(0, 10),
    };
  }
  write(next);
  return changed;
}
