/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows from the database */
// Re-check one tracked person against the public sources, without writing anything.
// Used by the Tracked page to show what changed since the last check.

import { publicDb } from "@/lib/db.server";
import { adHocSchool, scopeFor, type SchoolInfo } from "./config";
import { gatherFacts } from "./enrich.server";
import { buildSignals, judge } from "./score";
import { leadLink, paperPeople, repoFact, sourceName, type PoolRow } from "./stages.server";

export type RecheckResult = {
  pickId: string;
  lane: string;
  laneReason: string;
  action: string;
  why: string;
  research: number;
  propensity: number;
  timing: number;
  signals: {
    type: string;
    group: string;
    label: string;
    value: string;
    points: number | null;
    max: number | null;
    status: string;
  }[];
};

export async function recheckPick(pickId: string): Promise<RecheckResult | null> {
  const db: any = publicDb();
  const { data: pick } = await db
    .from("picks")
    .select(
      "id, scan_id, person_id, people(id, name, school, openalex_id, tracks, identity_confidence), scans(theses(school_ids))",
    )
    .eq("id", pickId)
    .maybeSingle();
  const person = pick?.people;
  if (!pick || !person?.openalex_id) return null;

  const { data: rows } = await db
    .from("person_items")
    .select(
      "person_id, item_id, role, confidence, items!inner(id, scan_id, source, title, url, item_date, fit, applied, use_case, raw)",
    )
    .eq("person_id", pick.person_id)
    .eq("items.scan_id", pick.scan_id);
  const links: PoolRow[] = (rows ?? []).map((r: any) => ({ ...r, people: person }));
  if (!links.length) return null;

  const scope = scopeFor(pick.scans?.theses?.school_ids ?? []);
  const lead = leadLink(links);
  const pp = paperPeople(links, person, scope);
  const school: SchoolInfo | null =
    scope.schools.find((s) => s.name === person.school) ??
    pp?.school ??
    (person.school ? adHocSchool(person.school) : null);

  const facts = await gatherFacts({
    authorId: person.openalex_id,
    name: person.name,
    school,
    labHead: pp?.labHead ? { id: pp.labHead.id, name: pp.labHead.name } : null,
    screening: {
      fit: lead.items.fit,
      applied: lead.items.applied,
      useCase: lead.items.use_case,
      leadTitle: lead.items.title,
      leadUrl: lead.items.url,
    },
    sources: links.map((l) => sourceName(l.items.source)),
    knownAwards: links
      .filter((l) => l.role === "grant lead")
      .map((l) => ({
        title: l.items.title ?? "I-Corps award",
        url: l.items.url ?? "",
        date: l.items.item_date,
        kind: "icorps" as const,
        confidence: l.confidence === "high" ? ("high" as const) : ("medium" as const),
      })),
  });
  facts.repo = repoFact(links);
  const signals = buildSignals(facts);
  const v = judge(signals);
  return {
    pickId,
    lane: v.lane,
    laneReason: v.laneReason,
    action: v.action,
    why: v.why,
    research: v.research.score,
    propensity: v.propensity.score,
    timing: v.timing.score,
    signals: signals.map((s) => ({
      type: s.type,
      group: s.group,
      label: s.label,
      value: s.value,
      points: s.points,
      max: s.max,
      status: s.status,
    })),
  };
}
