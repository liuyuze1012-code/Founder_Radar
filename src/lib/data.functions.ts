import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicDb } from "./db.server";

// The latest finished scan that produced picks, so the digest never goes blank after an empty run.
async function latestDoneScan(db: ReturnType<typeof publicDb>) {
  const { data } = await db
    .from("scans")
    .select("id, status, is_sample, finished_at, counts, thesis_id, theses(text, lane_sizes), picks!inner(id)")
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(1, { foreignTable: "picks" })
    .limit(1)
    .maybeSingle();
  return data;
}

const PICK_SELECT =
  "*, people(id, name, school, tracks, identity_confidence, identity_reasons)";

export const getDigest = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const scan = await latestDoneScan(db);
  if (!scan) return { scan: null, picks: [] };
  const { data: picks } = await db.from("picks").select(PICK_SELECT).eq("scan_id", scan.id).eq("in_digest", true).order("rank");
  return { scan, picks: picks ?? [] };
});

export const getCandidates = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  const scan = await latestDoneScan(db);
  if (!scan) return { scan: null, picks: [] };
  const { data: picks } = await db.from("picks").select(PICK_SELECT).eq("scan_id", scan.id).order("rank");
  return { scan, picks: picks ?? [] };
});

export const getPickDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ pickId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = publicDb();
    const { data: pick } = await db.from("picks").select(PICK_SELECT).eq("id", data.pickId).maybeSingle();
    if (!pick) return null;
    const [{ data: scan }, { data: evidence }, { data: kase }] = await Promise.all([
      db.from("scans").select("id, is_sample").eq("id", pick.scan_id).single(),
      db.from("evidence").select("*").eq("person_id", pick.person_id).eq("scan_id", pick.scan_id).order("event_date", { ascending: false }),
      db.from("cases").select("*").eq("person_id", pick.person_id).eq("scan_id", pick.scan_id).maybeSingle(),
    ]);
    return { pick, scan, evidence: evidence ?? [], case: kase };
  });

export const getScan = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: scan } = await publicDb().from("scans").select("id, status, stage, counts, is_sample, error").eq("id", data.scanId).maybeSingle();
    return scan;
  });
