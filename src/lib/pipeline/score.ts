// Scoring, lane and minimum-bar rules from the build spec (section "Build details", parts 6 and 7).
// Pure functions: no network, no database.

export type Group = "research" | "propensity" | "timing" | "lane";
export type Lane = "pre_intent" | "exploring" | "already_moving";

export type Signal = {
  group: Group;
  type: string;
  label: string;
  value: string;
  points: number | null;
  max: number | null;
  status: "observed" | "not_applicable" | "unknown";
  url?: string | null | undefined;
  date?: string | null | undefined;
  confidence?: string | null | undefined;
};

export type PersonFacts = {
  /** Best screening result among the person's records in this scan. */
  fit: number | null;
  applied: string | null;
  useCase: string | null;
  leadTitle: string | null;
  leadUrl: string | null;
  /** Best work of the last three years that is older than six months. null = none exists; undefined = lookup failed. */
  bestWork?: { title: string; url: string; top10: boolean; fwci: number | null } | null;
  /** Count of citing works with a company author. undefined = lookup failed. */
  companyCitations?: number | null | undefined;
  companyCoauthors?: string[];
  /** Companies listed as the person's own affiliation on their papers. undefined = lookup failed. */
  ownCompanies?: { name: string; lastYear: number; small: boolean }[];
  /** The profile probably combines more than one person, so its history is not used. */
  profileMixed?: boolean;
  /** Commercialization awards led by the person. undefined = lookup failed. */
  ownAwards?: {
    title: string;
    url: string;
    date: string | null;
    kind: "icorps" | "small_business";
    confidence: "high" | "medium";
  }[];
  /** null = no lab head on record; undefined = lookup failed. */
  labHead?: { name: string; awards: { title: string; url: string; kind: string }[] } | null;
  sources: string[];
  firstYear?: number | null;
  worksThisYear?: number | null;
  worksLastYear?: number | null;
};

const monthsSince = (iso: string | null | undefined) =>
  iso ? (Date.now() - new Date(iso).getTime()) / (30.44 * 86400000) : Infinity;

export function buildSignals(f: PersonFacts): Signal[] {
  const s: Signal[] = [];
  const obs = (
    group: Group,
    type: string,
    label: string,
    value: string,
    points: number,
    max: number,
    extra: Partial<Signal> = {},
  ) => s.push({ group, type, label, value, points, max, status: "observed", ...extra });
  const na = (group: Group, type: string, label: string, value: string) =>
    s.push({ group, type, label, value, points: null, max: null, status: "not_applicable" });
  // An unknown signal keeps its maximum, so missing data lowers the score instead of inflating it.
  const unknown = (
    group: Group,
    type: string,
    label: string,
    max: number,
    value = "Lookup failed",
  ) => s.push({ group, type, label, value, points: null, max, status: "unknown" });

  // ---- Research potential
  const fit = f.fit ?? 0;
  obs(
    "research",
    "thesis_fit",
    "Fit with the thesis",
    `${fit}/10 on "${(f.leadTitle ?? "").slice(0, 90)}"`,
    fit >= 9 ? 2 : fit >= 7 ? 1 : 0,
    2,
    { url: f.leadUrl },
  );
  obs(
    "research",
    "applied",
    "Applied, not pure theory",
    f.applied ?? "unclear",
    f.applied === "yes" ? 1 : 0,
    1,
  );
  obs(
    "research",
    "use_case",
    "Names a use case",
    f.useCase ?? "unclear",
    f.useCase === "yes" ? 1 : 0,
    1,
  );

  const TOO_NEW = "No work older than 6 months, so no citation data yet";
  if (f.bestWork === undefined)
    unknown("research", "field_citations", "Citations versus the field", 2);
  else if (f.bestWork === null)
    unknown("research", "field_citations", "Citations versus the field", 2, TOO_NEW);
  else {
    const w = f.bestWork;
    const pts = w.top10 ? 2 : (w.fwci ?? 0) > 1 ? 1 : 0;
    const desc = w.top10
      ? "Top 10% of its field"
      : (w.fwci ?? 0) > 1
        ? "Above field average"
        : "At or below field average";
    obs(
      "research",
      "field_citations",
      "Citations versus the field",
      `${desc}: "${w.title.slice(0, 80)}"`,
      pts,
      2,
      { url: w.url },
    );
  }

  if (f.bestWork === null)
    unknown("research", "company_citations", "Cited by company researchers", 2, TOO_NEW);
  else if (f.companyCitations === undefined || f.bestWork === undefined)
    unknown("research", "company_citations", "Cited by company researchers", 2);
  else {
    const n = f.companyCitations ?? 0;
    obs(
      "research",
      "company_citations",
      "Cited by company researchers",
      `${n} citing work${n === 1 ? "" : "s"} with a company author`,
      n >= 5 ? 2 : n >= 1 ? 1 : 0,
      2,
      { url: f.bestWork.url },
    );
  }

  // ---- Founder propensity
  if (f.ownAwards === undefined) unknown("propensity", "icorps", "I-Corps lead", 3);
  else {
    const ic = f.ownAwards
      .filter((a) => a.kind === "icorps" && a.confidence === "high")
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
    if (ic)
      obs("propensity", "icorps", "I-Corps lead", ic.title.slice(0, 110), 3, 3, {
        url: ic.url,
        date: ic.date,
        confidence: ic.confidence,
      });
    else obs("propensity", "icorps", "I-Corps lead", "None found", 0, 3);
  }

  const CO_LABEL =
    "Coauthored with a company researcher (last 3 years, papers of 15 authors or fewer)";
  const co = f.companyCoauthors;
  if (co === undefined) unknown("propensity", "company_coauthor", CO_LABEL, 2);
  else
    obs(
      "propensity",
      "company_coauthor",
      CO_LABEL,
      co.length ? co.slice(0, 3).join(", ") : "None found",
      co.length ? 2 : 0,
      2,
    );

  const IND_LABEL = "Has held a company affiliation on their own papers";
  const own = f.ownCompanies;
  if (own === undefined)
    unknown(
      "propensity",
      "industry_experience",
      IND_LABEL,
      2,
      f.profileMixed ? "Not used: profile may combine more than one person" : undefined,
    );
  else
    obs(
      "propensity",
      "industry_experience",
      IND_LABEL,
      own.length
        ? [...own]
            .sort((a, b) => b.lastYear - a.lastYear)
            .slice(0, 3)
            .map((c) => `${c.name} (${c.lastYear})`)
            .join(", ")
        : "None found",
      own.length ? 2 : 0,
      2,
    );

  if (f.labHead === undefined)
    unknown("propensity", "lab_head_awards", "Lab head has I-Corps or a small-business grant", 2);
  else if (f.labHead === null)
    na(
      "propensity",
      "lab_head_awards",
      "Lab head has I-Corps or a small-business grant",
      "No lab head on record",
    );
  else {
    const a = f.labHead.awards[0];
    obs(
      "propensity",
      "lab_head_awards",
      "Lab head has I-Corps or a small-business grant",
      a ? `${f.labHead.name}: ${a.title.slice(0, 80)}` : `${f.labHead.name}: none found`,
      a ? 2 : 0,
      2,
      { url: a?.url },
    );
  }

  const multi = new Set(f.sources).size >= 2;
  obs(
    "propensity",
    "multi_source",
    "Found through 2 or more sources",
    [...new Set(f.sources)].join(", ") || "one source",
    multi ? 1 : 0,
    1,
  );

  // ---- Timing
  if (f.firstYear === undefined)
    unknown(
      "timing",
      "career_stage",
      "Years since first year on record",
      2,
      f.profileMixed ? "Not used: profile may combine more than one person" : undefined,
    );
  else if (f.firstYear === null)
    na("timing", "career_stage", "Years since first year on record", "No history on record");
  else {
    const y = new Date().getUTCFullYear() - f.firstYear;
    obs(
      "timing",
      "career_stage",
      "Years since first year on record",
      `${y} year${y === 1 ? "" : "s"} (since ${f.firstYear})`,
      y >= 4 && y <= 8 ? 2 : (y >= 2 && y <= 3) || (y >= 9 && y <= 12) ? 1 : 0,
      2,
    );
  }

  if (f.worksThisYear === undefined)
    unknown("timing", "output_trend", "More works this year than last", 1);
  else if (f.worksThisYear === null || f.worksLastYear == null)
    na("timing", "output_trend", "More works this year than last", "No yearly counts");
  else
    obs(
      "timing",
      "output_trend",
      "More works this year than last",
      `${f.worksThisYear} this year, ${f.worksLastYear} last year`,
      f.worksThisYear > f.worksLastYear ? 1 : 0,
      1,
    );

  const recent = (f.ownAwards ?? [])
    .filter((a) => a.confidence === "high" && monthsSince(a.date) <= 6)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  if (f.ownAwards === undefined)
    unknown("timing", "recent_event", "Qualifying event in the last 6 months", 2);
  else
    obs(
      "timing",
      "recent_event",
      "Qualifying event in the last 6 months",
      recent ? recent.title.slice(0, 100) : "None found",
      recent ? 2 : 0,
      2,
      { url: recent?.url, date: recent?.date },
    );

  // ---- Lane evidence (shown, not scored)
  const exploring = (f.ownAwards ?? []).find(
    (a) => a.kind === "icorps" && a.confidence === "high" && monthsSince(a.date) <= 36,
  );
  if (exploring) {
    s.push({
      group: "lane",
      type: "lane_exploring",
      label: "I-Corps award in the last 3 years",
      value: exploring.title.slice(0, 110),
      points: null,
      max: null,
      status: "observed",
      url: exploring.url,
      date: exploring.date,
      confidence: "high",
    });
  }
  if (f.profileMixed) {
    s.push({
      group: "lane",
      type: "profile_mixed",
      label: "Profile may combine more than one person",
      value:
        "Affiliations in several countries at once; career history and company ties were not used",
      points: null,
      max: null,
      status: "observed",
      confidence: "medium",
    });
  }
  // A small company on the person's own papers is a sign of a venture, so they are not Pre-intent.
  const ventures = (f.ownCompanies ?? [])
    .filter((c) => c.small)
    .sort((a, b) => b.lastYear - a.lastYear);
  const venture = ventures[0];
  if (venture) {
    const recent = venture.lastYear >= new Date().getUTCFullYear() - 5;
    s.push({
      group: "lane",
      type: recent ? "lane_moving" : "lane_company_past",
      label: recent
        ? "Listed at a small company on their own papers in the last 5 years"
        : "Past affiliation with a small company on their own papers",
      value: `${venture.name} (${venture.lastYear})`,
      points: null,
      max: null,
      status: "observed",
      confidence: "high",
    });
  }
  for (const a of (f.ownAwards ?? []).filter((x) => x.confidence !== "high").slice(0, 2)) {
    s.push({
      group: "lane",
      type: "possible_award",
      label: "Possible award, matched by name only (not counted)",
      value: a.title.slice(0, 110),
      points: null,
      max: null,
      status: "observed",
      url: a.url,
      date: a.date,
      confidence: "medium",
    });
  }
  return s;
}

/** Pre-intent picks at or above this founder propensity get "Nurture"; below it, "Pair with operator". */
export const NURTURE_MIN = 3;

export type GroupScore = { score: number; coverage: string; coveragePct: number };

/**
 * Score = 10 × points earned ÷ points possible. Signals that do not apply are left out.
 * Signals with no data yet stay in the total, so thin evidence cannot produce a top score.
 * Coverage = signals with data ÷ signals that apply.
 */
export function scoreGroup(signals: Signal[], group: Group): GroupScore {
  const g = signals.filter((x) => x.group === group);
  const observed = g.filter((x) => x.status === "observed");
  const applicable = g.filter((x) => x.status !== "not_applicable");
  const earned = observed.reduce((n, x) => n + (x.points ?? 0), 0);
  const possible = applicable.reduce((n, x) => n + (x.max ?? 0), 0);
  const score = possible > 0 ? Math.round((earned / possible) * 100) / 10 : 0;
  const pct = applicable.length ? observed.length / applicable.length : 0;
  return {
    score,
    coverage: applicable.length
      ? `Based on ${observed.length} of ${applicable.length} signals`
      : "No applicable signals",
    coveragePct: pct,
  };
}

export type Verdict = {
  lane: Lane;
  laneReason: string;
  research: GroupScore;
  propensity: GroupScore;
  timing: GroupScore;
  meetsBar: boolean;
  belowBarReason: string | null;
  rankValue: number;
  action: string;
  why: string;
};

export function judge(signals: Signal[]): Verdict {
  const research = scoreGroup(signals, "research");
  const propensity = scoreGroup(signals, "propensity");
  const timing = scoreGroup(signals, "timing");
  const has = (type: string) =>
    signals.some((x) => x.type === type && x.status === "observed" && (x.points ?? 0) > 0);

  const laneSignal = (type: string) => signals.find((x) => x.type === type);
  const moving = laneSignal("lane_moving");
  const exploring = laneSignal("lane_exploring") ?? laneSignal("lane_company_past");
  const lane: Lane = moving ? "already_moving" : exploring ? "exploring" : "pre_intent";
  const laneReason = moving
    ? `${moving.label}: ${moving.value}`
    : exploring
      ? `${exploring.label}: ${exploring.value}`
      : "No I-Corps or company signal found in the monitored sources";

  const earning = signals.filter((x) => x.status === "observed" && (x.points ?? 0) > 0).length;
  let below: string | null = null;
  if (earning < 2) below = "Fewer than two signals earned points";
  else if (lane === "pre_intent") {
    if (research.score < 5) below = `Research potential ${research.score.toFixed(1)} is under 5`;
    else if (research.coveragePct < 0.5)
      below = "Research potential is based on under half of its signals";
    else if (
      !has("company_coauthor") &&
      !has("lab_head_awards") &&
      !has("icorps") &&
      !has("industry_experience")
    )
      below = "No signal about the person beyond the paper";
  } else if (lane === "exploring") {
    if (research.score < 4) below = `Research potential ${research.score.toFixed(1)} is under 4`;
  }

  const rankValue =
    lane === "pre_intent"
      ? research.score * propensity.score
      : lane === "exploring"
        ? propensity.score * timing.score
        : timing.score * research.score;

  let action: string;
  if (below) action = propensity.score >= 6 ? "Watch" : "No action";
  else if (lane === "pre_intent")
    action = propensity.score >= NURTURE_MIN ? "Nurture" : "Pair with operator";
  else action = "Reach out now";

  const top = signals
    .filter(
      (x) =>
        x.status === "observed" &&
        (x.points ?? 0) > 0 &&
        x.group !== "lane" &&
        x.type !== "applied" &&
        x.type !== "use_case",
    )
    .sort(
      (a, b) =>
        (b.points ?? 0) / (b.max ?? 1) - (a.points ?? 0) / (a.max ?? 1) ||
        (b.max ?? 0) - (a.max ?? 0),
    )
    .slice(0, 3)
    .map((x) => WHY[x.type]?.(x) ?? x.label);
  const why = top.length ? top.join("; ") + "." : "Applied work that fits the thesis.";

  return {
    lane,
    laneReason,
    research,
    propensity,
    timing,
    meetsBar: !below,
    belowBarReason: below,
    rankValue,
    action,
    why: why.charAt(0).toUpperCase() + why.slice(1),
  };
}

const WHY: Record<string, (s: Signal) => string> = {
  thesis_fit: () => "strong fit with the thesis",
  field_citations: (s) =>
    s.points === 2
      ? "recent work in the top 10% of its field"
      : "recent work cited above its field average",
  company_citations: (s) => `${s.value.split(" ")[0]} company-authored works cite their research`,
  icorps: () => "has led an I-Corps team",
  company_coauthor: (s) => `has coauthored with ${s.value.split(",")[0]}`,
  industry_experience: (s) => `has been affiliated with ${s.value.split(" (")[0]}`,
  lab_head_awards: () => "lab head has commercialization grants",
  multi_source: () => "found through more than one source",
  career_stage: () => "at a career stage where people often move",
  output_trend: () => "output is rising",
  recent_event: () => "a qualifying event in the last 6 months",
};

export type Ranked<T> = T & { rank: number; inDigest: boolean; belowBarReason: string | null };

/** Rank inside each lane, then apply the quota and the two-per-lab rule. */
export function selectDigest<T extends { verdict: Verdict; labKey: string; identityHigh: boolean }>(
  people: T[],
  laneSizes: Record<string, number>,
): Ranked<T>[] {
  const out: Ranked<T>[] = [];
  let rank = 1;
  for (const lane of ["pre_intent", "exploring", "already_moving"] as Lane[]) {
    const inLane = people
      .filter((p) => p.verdict.lane === lane)
      .sort(
        (a, b) =>
          Number(b.verdict.meetsBar) - Number(a.verdict.meetsBar) ||
          b.verdict.rankValue - a.verdict.rankValue ||
          Number(b.identityHigh) - Number(a.identityHigh),
      );
    const quota = laneSizes[lane] ?? 0;
    const perLab = new Map<string, number>();
    let taken = 0;
    for (const p of inLane) {
      let reason = p.verdict.belowBarReason;
      let inDigest = false;
      if (!reason) {
        const n = perLab.get(p.labKey) ?? 0;
        if (taken >= quota) reason = "Cleared the bar; lane quota already filled";
        else if (n >= 2) reason = "Cleared the bar; two people from this lab already selected";
        else {
          inDigest = true;
          taken++;
          perLab.set(p.labKey, n + 1);
        }
      }
      out.push({ ...p, rank: rank++, inDigest, belowBarReason: inDigest ? null : reason });
    }
  }
  return out;
}
