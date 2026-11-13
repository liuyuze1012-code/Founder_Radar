/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from public APIs and joined rows */
// Fetchers for public sources. Server-only: reads keys from the environment.
// Every function makes exactly one outside request.

import { normalizeName } from "./match";

const OPENALEX = "https://api.openalex.org";
const NSF = "https://api.nsf.gov/services/v1/awards.json";

export class SourceError extends Error {
  constructor(
    public source: string,
    public status: number,
  ) {
    super(`${source} returned ${status}`);
  }
}

async function getJson(source: string, url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new SourceError(source, res.status);
  return res.json();
}

function openalexUrl(path: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  const key = process.env["OPENALEX_KEY"];
  if (key) q.set("api_key", key);
  return `${OPENALEX}${path}?${q.toString()}`;
}

const shortId = (url: string | null | undefined) => (url ? url.split("/").pop()! : "");

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function rebuildAbstract(inv: Record<string, number[]> | null | undefined): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) for (const p of positions) words[p] = word;
  const text = words.filter(Boolean).join(" ").trim();
  return text ? text.slice(0, 2500) : null;
}

export type RawAuthor = {
  id: string;
  name: string;
  pos: string;
  insts: { id: string; name: string; type: string | null; country?: string | null }[];
};

export type CollectedItem = {
  source: "paper" | "grant";
  source_id: string;
  doi: string | null;
  title: string | null;
  summary: string | null;
  item_date: string | null;
  url: string | null;
  raw: Record<string, unknown>;
};

function mapAuthors(authorships: any[]): RawAuthor[] {
  const all = (authorships ?? []).map((a) => ({
    id: shortId(a.author?.id),
    name: a.author?.display_name ?? "",
    pos: a.author_position ?? "middle",
    insts: (a.institutions ?? []).map((i: any) => ({
      id: shortId(i.id),
      name: i.display_name ?? "",
      type: i.type ?? null,
      country: i.country_code ?? null,
    })),
  }));
  // Keep rows small: the first 12 authors plus the last one.
  return all.length > 13 ? [...all.slice(0, 12), all[all.length - 1]!] : all;
}

/** Recent papers on a search phrase with an author at one of the schools, or anywhere in the US. */
export async function searchPapers(opts: {
  keyword: string;
  /** null = any US institution. */
  institutionIds: string[] | null;
  since: string;
  perPage: number;
}): Promise<CollectedItem[]> {
  const url = openalexUrl("/works", {
    search: opts.keyword,
    filter: [
      opts.institutionIds
        ? `authorships.institutions.lineage:${opts.institutionIds.join("|")}`
        : "authorships.institutions.country_code:US",
      `from_publication_date:${opts.since}`,
      "type:article|preprint",
    ].join(","),
    select:
      "id,doi,title,abstract_inverted_index,publication_date,type,authorships,primary_topic,fwci,cited_by_count",
    per_page: String(Math.min(200, opts.perPage)),
  });
  const data = await getJson("OpenAlex", url);
  return (data.results ?? []).map((w: any): CollectedItem => {
    const id = shortId(w.id);
    return {
      source: "paper",
      source_id: id,
      doi: w.doi ?? null,
      title: w.title ?? null,
      summary: rebuildAbstract(w.abstract_inverted_index),
      item_date: w.publication_date ?? null,
      url: w.doi ?? `https://openalex.org/${id}`,
      raw: {
        type: w.type ?? null,
        field: w.primary_topic?.field?.display_name ?? null,
        subfield: w.primary_topic?.subfield?.display_name ?? null,
        authors: mapAuthors(w.authorships),
        keyword: opts.keyword,
      },
    };
  });
}

function nsfDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}
function isoFromNsf(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}
const nsfAwardUrl = (id: string) => `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${id}`;

/** I-Corps awards since a date, in one state or nationally (NSF Awards API). */
export async function searchIcorps(opts: {
  /** null = all states. */
  state: string | null;
  since: string;
  offset?: number;
}): Promise<CollectedItem[]> {
  const q = new URLSearchParams({
    keyword: '"I-Corps"',
    ...(opts.state ? { awardeeStateCode: opts.state } : {}),
    dateStart: nsfDate(opts.since),
    printFields: "id,title,abstractText,piFirstName,piLastName,awardeeName,startDate",
    rpp: "25",
    offset: String(opts.offset ?? 1),
  });
  const data = await getJson("NSF", `${NSF}?${q.toString()}`);
  const awards: any[] = data?.response?.award ?? [];
  return awards
    .filter((a) => /i-corps/i.test(a.title ?? ""))
    .map((a): CollectedItem => ({
      source: "grant",
      source_id: `nsf:${a.id}`,
      doi: null,
      title: a.title ?? null,
      summary: a.abstractText ? String(a.abstractText).slice(0, 2500) : null,
      item_date: isoFromNsf(a.startDate),
      url: nsfAwardUrl(a.id),
      raw: {
        program: "icorps",
        pi: `${a.piFirstName ?? ""} ${a.piLastName ?? ""}`.trim(),
        awardee: a.awardeeName ?? null,
      },
    }));
}

export type PersonAward = {
  id: string;
  title: string;
  awardee: string;
  date: string | null;
  url: string;
  kind: "icorps" | "small_business";
};

/** NSF awards led by a named person that signal commercialization (I-Corps, SBIR, STTR). */
export async function awardsByLead(name: string): Promise<PersonAward[]> {
  const norm = normalizeName(name).split(" ");
  const first = norm[0] ?? "";
  const last = norm[norm.length - 1] ?? "";
  if (!first || !last) return [];
  const q = new URLSearchParams({
    pdPIName: `${first} ${last}`,
    printFields: "id,title,piFirstName,piLastName,awardeeName,startDate",
    rpp: "25",
  });
  const data = await getJson("NSF", `${NSF}?${q.toString()}`);
  const awards: any[] = data?.response?.award ?? [];
  const out: PersonAward[] = [];
  for (const a of awards) {
    const pf = normalizeName(String(a.piFirstName ?? "")).split(" ")[0] ?? "";
    const pl = normalizeName(String(a.piLastName ?? ""));
    if (pl !== last || pf !== first) continue;
    const title = String(a.title ?? "");
    const kind = /i-corps/i.test(title)
      ? "icorps"
      : /\b(SBIR|STTR)\b/.test(title)
        ? "small_business"
        : null;
    if (!kind) continue;
    out.push({
      id: String(a.id),
      title,
      awardee: String(a.awardeeName ?? ""),
      date: isoFromNsf(a.startDate),
      url: nsfAwardUrl(a.id),
      kind,
    });
  }
  return out;
}

export type AuthorProfile = {
  id: string;
  name: string;
  worksCount: number;
  firstYear: number | null;
  worksThisYear: number | null;
  worksLastYear: number | null;
  /** US companies the person's own papers list as their affiliation. */
  companies: { id: string; name: string; lastYear: number }[];
  /**
   * True when the profile shows affiliations in three or more countries in the last three years.
   * That usually means two people with the same name were merged into one profile.
   */
  mixed: boolean;
};

export async function authorProfile(authorId: string): Promise<AuthorProfile> {
  const a = await getJson(
    "OpenAlex",
    openalexUrl(`/authors/${authorId}`, {
      select: "id,display_name,works_count,affiliations,counts_by_year",
    }),
  );
  const years: number[] = (a.affiliations ?? []).flatMap((x: any) => x.years ?? []);
  const year = new Date().getUTCFullYear();
  const byYear = new Map<number, number>(
    (a.counts_by_year ?? []).map((c: any) => [c.year, c.works_count]),
  );
  return {
    id: shortId(a.id),
    name: a.display_name ?? "",
    worksCount: a.works_count ?? 0,
    firstYear: years.length ? Math.min(...years) : null,
    worksThisYear: byYear.get(year) ?? null,
    worksLastYear: byYear.get(year - 1) ?? null,
    mixed:
      new Set(
        (a.affiliations ?? [])
          .filter((x: any) => (x.years ?? []).some((y: number) => y >= year - 3))
          .map((x: any) => x.institution?.country_code)
          .filter(Boolean),
      ).size >= 3,
    companies: (a.affiliations ?? [])
      .filter(
        (x: any) =>
          x.institution?.type === "company" &&
          x.institution?.country_code === "US" &&
          (x.years ?? []).length,
      )
      .map((x: any) => ({
        id: shortId(x.institution.id),
        name: x.institution.display_name ?? "",
        lastYear: Math.max(...x.years),
      })),
  };
}

/** Publication counts for companies, used to tell a small venture from a large employer. */
export async function companySizes(ids: string[]): Promise<Map<string, number>> {
  const data = await getJson(
    "OpenAlex",
    openalexUrl("/institutions", {
      filter: `openalex:${ids.slice(0, 25).join("|")}`,
      select: "id,works_count",
      per_page: "25",
    }),
  );
  return new Map((data.results ?? []).map((i: any) => [shortId(i.id), i.works_count ?? 0]));
}

export type TopWork = {
  id: string;
  title: string;
  date: string | null;
  citedBy: number;
  fwci: number | null;
  top10: boolean;
  /** Company coauthors, counted only on papers with a short author list. */
  companyCoauthors: string[];
  /** Where this paper lists the person themselves. */
  ownInstitutions: { id: string; name: string }[];
};

/** A coauthor on a 35-author consortium paper is not a working relationship. */
const MAX_AUTHORS_FOR_COAUTHOR_SIGNAL = 15;

/** A person's most cited works of the last three years. */
export async function topRecentWorks(authorId: string): Promise<TopWork[]> {
  const data = await getJson(
    "OpenAlex",
    openalexUrl("/works", {
      filter: `author.id:${authorId},from_publication_date:${isoDaysAgo(3 * 365)}`,
      sort: "cited_by_count:desc",
      select:
        "id,title,publication_date,cited_by_count,fwci,citation_normalized_percentile,authorships",
      per_page: "10",
    }),
  );
  return (data.results ?? []).map((w: any): TopWork => {
    const companies = new Set<string>();
    const small = (w.authorships ?? []).length <= MAX_AUTHORS_FOR_COAUTHOR_SIGNAL;
    for (const au of small ? (w.authorships ?? []) : []) {
      if (shortId(au.author?.id) === authorId) continue;
      for (const i of au.institutions ?? [])
        if (i.type === "company" && i.display_name) companies.add(i.display_name);
    }
    return {
      id: shortId(w.id),
      title: w.title ?? "",
      date: w.publication_date ?? null,
      citedBy: w.cited_by_count ?? 0,
      fwci: typeof w.fwci === "number" ? w.fwci : null,
      top10: !!w.citation_normalized_percentile?.is_in_top_10_percent,
      companyCoauthors: [...companies],
      ownInstitutions: (w.authorships ?? [])
        .filter((au: any) => shortId(au.author?.id) === authorId)
        .flatMap((au: any) => au.institutions ?? [])
        .map((i: any) => ({ id: shortId(i.id), name: i.display_name ?? "" })),
    };
  });
}

/** How many works citing this one have an author at a company. */
export async function companyCitations(workId: string): Promise<number> {
  const data = await getJson(
    "OpenAlex",
    openalexUrl("/works", { filter: `cites:${workId}`, group_by: "authorships.institutions.type" }),
  );
  const row = (data.group_by ?? []).find(
    (g: any) => String(g.key).toLowerCase().endsWith("company") || g.key_display_name === "company",
  );
  return row?.count ?? 0;
}

/** Researchers with this name at the given institutions. */
export async function findAuthorsAtSchool(
  name: string,
  institutionIds: string[],
): Promise<{ id: string; name: string; works: number }[]> {
  const data = await getJson(
    "OpenAlex",
    openalexUrl("/authors", {
      search: name,
      filter: `affiliations.institution.id:${institutionIds.join("|")}`,
      select: "id,display_name,works_count",
      per_page: "10",
    }),
  );
  return (data.results ?? []).map((a: any) => ({
    id: shortId(a.id),
    name: a.display_name ?? "",
    works: a.works_count ?? 0,
  }));
}

/** The US institution a free-text organization name refers to, for whole-US mode. */
export async function lookupInstitution(
  name: string,
): Promise<{ id: string; name: string } | null> {
  const data = await getJson(
    "OpenAlex",
    openalexUrl("/institutions", {
      search: name.replace(/[^A-Za-z ]+/g, " "),
      filter: "country_code:US",
      select: "id,display_name",
      per_page: "1",
    }),
  );
  const hit = (data.results ?? [])[0];
  return hit ? { id: shortId(hit.id), name: hit.display_name ?? name } : null;
}
