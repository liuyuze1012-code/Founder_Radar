import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Alert, Avatar, Button, Card, Chip } from "@heroui/react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { getPickDetail } from "@/lib/data.functions";
import { laneOf } from "@/lib/radar";
import { track, untrack, useTracked } from "@/lib/tracking";

/** The shape of a pick as the pages receive it. */
export type PickRow = {
  id: string;
  lane: string | null;
  action: string | null;
  why: string | null;
  cardSummary?: { idea: string; qualification: string } | null;
  sourceIdea?: string | null;
  research_score: number | string | null;
  propensity_score: number | string | null;
  timing_score: number | string | null;
  people: {
    name: string;
    school: string | null;
    tracks: string[] | null;
    identity_confidence: string | null;
  } | null;
};

export const LANE_UI: Record<string, { dot: string; soft: string; text: string; bar: string }> = {
  pre_intent: {
    dot: "bg-lane-pre",
    soft: "bg-lane-pre-soft",
    text: "text-lane-pre",
    bar: "bg-lane-pre",
  },
  exploring: {
    dot: "bg-lane-exp",
    soft: "bg-lane-exp-soft",
    text: "text-lane-exp",
    bar: "bg-lane-exp",
  },
  already_moving: {
    dot: "bg-lane-mov",
    soft: "bg-lane-mov-soft",
    text: "text-lane-mov",
    bar: "bg-lane-mov",
  },
};
export const laneUi = (lane: string | null | undefined) =>
  LANE_UI[lane ?? ""] ?? LANE_UI["pre_intent"]!;

export function SampleBanner({ show }: { show: boolean | null | undefined }) {
  if (!show) return null;
  return (
    <Alert status="warning" className="mb-6">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Sample data</Alert.Title>
        <Alert.Description>These are fictional people, shown for demonstration.</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

export function LaneBadge({ lane }: { lane: string | null }) {
  const ui = laneUi(lane);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ui.soft} ${ui.text}`}
    >
      <span className={`size-1.5 rounded-full ${ui.dot}`} />
      {laneOf(lane).title}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <Chip size="sm" variant="soft">
      {children}
    </Chip>
  );
}

export function fmtScore(n: number | string | null | undefined) {
  if (n == null) return "–";
  return Number(n).toFixed(1);
}

export function ActionChip({ action }: { action: string | null }) {
  if (!action) return null;
  if (action === "Reach out now") {
    return (
      <Chip color="accent" variant="primary" size="sm">
        {action}
      </Chip>
    );
  }
  const color =
    action === "Nurture" ? "success" : action === "Pair with operator" ? "warning" : "default";
  return (
    <Chip color={color} variant="soft" size="sm">
      {action}
    </Chip>
  );
}

export function PersonAvatar({
  name,
  lane,
  size = "md",
}: {
  name: string;
  lane: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const parts = name.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
  const ui = laneUi(lane);
  return (
    <Avatar size={size} className={`shrink-0 ${ui.soft}`}>
      <Avatar.Fallback className={`font-semibold ${ui.text} ${ui.soft}`}>
        {initials}
      </Avatar.Fallback>
    </Avatar>
  );
}

export function ScoreMeters({
  r,
  p,
  t,
  lane,
}: {
  r: number | string | null;
  p: number | string | null;
  t: number | string | null;
  lane: string | null;
}) {
  const ui = laneUi(lane);
  const items = [
    ["Research", r],
    ["Founder", p],
    ["Timing", t],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(([label, v]) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {label}
            </span>
            <span className="text-sm font-semibold tabular-nums">{fmtScore(v)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-default">
            <div
              className={`h-full rounded-full ${ui.bar}`}
              style={{ width: `${Math.max(0, Math.min(10, Number(v ?? 0))) * 10}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const num = (v: number | string | null) => (v == null ? null : Number(v));

export function TrackButton({ pick, size = "sm" }: { pick: PickRow; size?: "sm" | "md" }) {
  const on = !!useTracked()[pick.id];
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (on) return untrack(pick.id);
    setBusy(true);
    try {
      // Save the evidence as it stands now, so a later rescan can show what changed.
      const detail = await getPickDetail({ data: { pickId: pick.id } });
      track({
        pickId: pick.id,
        name: pick.people?.name ?? "Researcher",
        school: pick.people?.school ?? null,
        tracks: pick.people?.tracks ?? [],
        lane: pick.lane,
        action: pick.action,
        research: num(pick.research_score),
        propensity: num(pick.propensity_score),
        timing: num(pick.timing_score),
        why: pick.why,
        signals: (detail?.evidence ?? []).map((e) => ({
          type: e.signal_type ?? "",
          group: e.score_group ?? "",
          label: e.label ?? "",
          value: e.value ?? "",
          points: e.points,
          max: e.max_points,
          status: e.status ?? "observed",
        })),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size={size} variant={on ? "secondary" : "outline"} isDisabled={busy} onPress={toggle}>
      {on ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      {on ? "Tracking" : busy ? "Saving…" : "Track"}
    </Button>
  );
}

export function FounderCard({ pick, reportSummary = false }: { pick: PickRow; reportSummary?: boolean }) {
  const name = pick.people?.name ?? "Researcher";
  return (
    <Card className="relative gap-4 p-5 transition-shadow duration-200 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <PersonAvatar name={name} lane={pick.lane} />
        <div className="min-w-0 flex-1">
          <Link
            to="/founder/$pickId"
            params={{ pickId: pick.id }}
            className="font-semibold leading-tight after:absolute after:inset-0 after:rounded-[inherit]"
          >
            {name}
          </Link>
          <div className="truncate text-sm text-muted">{pick.people?.school}</div>
        </div>
        <ActionChip action={pick.action} />
      </div>
      <ScoreMeters
        r={pick.research_score}
        p={pick.propensity_score}
        t={pick.timing_score}
        lane={pick.lane}
      />
      {reportSummary ? (
        <div className="space-y-2 text-sm leading-relaxed">
          <p className="font-medium text-foreground">
            <span className="text-muted">Idea · </span>
            {pick.cardSummary?.idea ?? pick.sourceIdea ?? "No source description available"}
          </p>
          <p className="text-foreground/90">
            <span className="font-medium text-muted">Why selected · </span>
            {pick.cardSummary?.qualification ?? pick.why ?? "Selection evidence unavailable"}
          </p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-foreground/90">{pick.why}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(pick.people?.tracks ?? []).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
          <Tag>Identity: {pick.people?.identity_confidence ?? "unknown"}</Tag>
        </div>
        <div className="relative z-10">
          <TrackButton pick={pick} />
        </div>
      </div>
    </Card>
  );
}
