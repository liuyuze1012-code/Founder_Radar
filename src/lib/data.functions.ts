import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicDb } from "./db.server";

// The latest finished scan that produced picks, so the digest never goes blank after an empty run.
async function latestDoneScan(db: ReturnType<typeof publicDb>) {
  const { data } = await db
    .from("scans")
    .select(
      "id, status, is_sample, finished_at, counts, thesis_id, theses(text, lane_sizes), picks!inner(id)",
    )
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(1, { foreignTable: "picks" })
    .limit(1)
    .maybeSingle();
  return data;
}

const PICK_SELECT = "*, people(id, name, school, tracks, identity_confidence, identity_reasons)";

export const getDigest = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const scan = await latestDoneScan(db);
  if (!scan) return { scan: null, picks: [] };
  const { data: picks } = await db
    .from("picks")
    .select(PICK_SELECT)
    .eq("scan_id", scan.id)
    .eq("in_digest", true)
    .order("rank");
  return { scan, picks: picks ?? [] };
});

export const getCandidates = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const scan = await latestDoneScan(db);
  if (!scan) return { scan: null, picks: [] };
  const { data: picks } = await db
    .from("picks")
    .select(PICK_SELECT)
    .eq("scan_id", scan.id)
    .order("rank");
  return { scan, picks: picks ?? [] };
});

export const getPickDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ pickId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = publicDb();
    const { data: pick } = await db
      .from("picks")
      .select(PICK_SELECT)
      .eq("id", data.pickId)
      .maybeSingle();
    if (!pick) return null;
    const [{ data: scan }, { data: evidence }, { data: kase }] = await Promise.all([
      db.from("scans").select("id, is_sample").eq("id", pick.scan_id).single(),
      db
        .from("evidence")
        .select("*")
        .eq("person_id", pick.person_id)
        .eq("scan_id", pick.scan_id)
        .order("event_date", { ascending: false }),
      db
        .from("cases")
        .select("*")
        .eq("person_id", pick.person_id)
        .eq("scan_id", pick.scan_id)
        .maybeSingle(),
    ]);
    return { pick, scan, evidence: evidence ?? [], case: kase };
  });

export const getScan = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: scan } = await publicDb()
      .from("scans")
      .select("id, status, stage, counts, is_sample, error")
      .eq("id", data.scanId)
      .maybeSingle();
    return scan;
  });

// ---------------------------------------------------------------------------
// Platform views: every scan is kept, so the VC can come back to any report,
// see each thesis they track, and browse everyone ever sourced.

type LaneCounts = { pre_intent: number; exploring: number; already_moving: number };

async function pagedPicks<T>(db: ReturnType<typeof publicDb>, columns: string): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data } = await db
      .from("picks")
      .select(columns)
      .order("id")
      .range(from, from + 999);
    const page = (data ?? []) as unknown as T[];
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const { data: scans } = await db
    .from("scans")
    .select(
      "id, status, stage, is_sample, started_at, finished_at, counts, error, theses(id, text, school_ids, lane_sizes, window_days)",
    )
    .order("started_at", { ascending: false })
    .limit(80);
  const picks = await pagedPicks<{
    scan_id: string;
    person_id: string;
    lane: string | null;
    in_digest: boolean;
  }>(db, "scan_id, person_id, lane, in_digest");
  const sampleIds = new Set((scans ?? []).filter((s) => s.is_sample).map((s) => s.id));
  const hasReal = (scans ?? []).some((s) => !s.is_sample);
  const people = new Set<string>();
  const byScan = new Map<string, { lanes: LaneCounts; people: number }>();
  for (const p of picks) {
    const entry = byScan.get(p.scan_id) ?? {
      lanes: { pre_intent: 0, exploring: 0, already_moving: 0 },
      people: 0,
    };
    entry.people++;
    if (p.in_digest && p.lane && p.lane in entry.lanes) entry.lanes[p.lane as keyof LaneCounts]++;
    byScan.set(p.scan_id, entry);
    if (!hasReal || !sampleIds.has(p.scan_id)) people.add(p.person_id);
  }
  return {
    scans: (scans ?? []).map((s) => ({
      ...s,
      lanes: byScan.get(s.id)?.lanes ?? { pre_intent: 0, exploring: 0, already_moving: 0 },
      people: byScan.get(s.id)?.people ?? 0,
    })),
    totalPeople: people.size,
  };
});

export const getReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = publicDb();
    const { data: scan } = await db
      .from("scans")
      .select(
        "id, status, stage, is_sample, started_at, finished_at, counts, error, theses(text, lane_sizes, school_ids, window_days)",
      )
      .eq("id", data.scanId)
      .maybeSingle();
    if (!scan) return null;
    const { data: picks } = await db
      .from("picks")
      .select(PICK_SELECT)
      .eq("scan_id", scan.id)
      .order("rank");
    const { data: cases } = await db
      .from("cases")
      .select("person_id, product")
      .eq("scan_id", scan.id);
    const { reportSummaries } = await import("./report-summary.server");
    const digest = (picks ?? []).filter((pick) => pick.in_digest);
    let summaries = new Map<string, { idea: string; qualification: string }>();
    let summaryError: string | null = null;
    try {
      summaries = await reportSummaries(digest.map((pick) => ({
        id: pick.id,
        product: cases?.find((entry) => entry.person_id === pick.person_id)?.product ?? null,
        why: pick.why,
      })));
    } catch (error) {
      summaryError = error instanceof Error ? error.message : "Card summaries could not be generated.";
    }
    return {
      scan,
      summaryError,
      picks: (picks ?? []).map((pick) => ({ ...pick, cardSummary: summaries.get(pick.id) ?? null })),
    };
  });

type PersonPick = {
  id: string;
  scan_id: string;
  person_id: string;
  lane: string | null;
  action: string | null;
  in_digest: boolean;
  below_bar_reason: string | null;
  research_score: number | null;
  propensity_score: number | null;
  timing_score: number | null;
  why: string | null;
  people: {
    id: string;
    name: string;
    school: string | null;
    tracks: string[] | null;
    identity_confidence: string | null;
  } | null;
  scans: {
    id: string;
    started_at: string | null;
    finished_at: string | null;
    is_sample: boolean;
    theses: { text: string } | null;
  } | null;
};

/** Everyone ever sourced, one row per person, taken from their most recent report. */
export const getPeople = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const picks = await pagedPicks<PersonPick>(
    db,
    "id, scan_id, person_id, lane, action, in_digest, below_bar_reason, research_score, propensity_score, timing_score, why, people(id, name, school, tracks, identity_confidence), scans(id, started_at, finished_at, is_sample, theses(text))",
  );
  const hasReal = picks.some((p) => p.scans && !p.scans.is_sample);
  const when = (p: PersonPick) => p.scans?.finished_at ?? p.scans?.started_at ?? "";
  const byPerson = new Map<string, PersonPick[]>();
  for (const p of picks) {
    if (!p.people || !p.scans) continue;
    if (hasReal && p.scans.is_sample) continue;
    byPerson.set(p.person_id, [...(byPerson.get(p.person_id) ?? []), p]);
  }
  const rows = [...byPerson.values()].map((list) => {
    const sorted = [...list].sort((a, b) => when(b).localeCompare(when(a)));
    const latest = sorted[0]!;
    return {
      ...latest,
      lastSeen: when(latest),
      thesis: latest.scans?.theses?.text ?? "",
      reports: sorted.length,
      everInDigest: sorted.some((p) => p.in_digest),
      theses: [...new Set(sorted.map((p) => p.scans?.theses?.text ?? "").filter(Boolean))],
    };
  });
  rows.sort(
    (a, b) =>
      Number(b.everInDigest) - Number(a.everInDigest) ||
      Number(b.research_score ?? 0) - Number(a.research_score ?? 0),
  );
  return { rows, isSample: !hasReal };
});
