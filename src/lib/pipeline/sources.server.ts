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
  source: "paper" | "grant" | "repo";
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
  /** Companies the person's own papers list as their affiliation. */
  companies: { id: string; name: string; lastYear: number; us: boolean }[];
  /**
   * True when the profile shows affiliations in three or more countries, or at five or more
   * universities, in the last three years. That usually means two people with the same name were
   * merged into one profile.
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
    mixed: looksMerged(a.affiliations ?? [], year),
    companies: (a.affiliations ?? [])
      .filter((x: any) => x.institution?.type === "company" && (x.years ?? []).length)
      .map((x: any) => ({
        id: shortId(x.institution.id),
        name: x.institution.display_name ?? "",
        lastYear: Math.max(...x.years),
        us: x.institution?.country_code === "US",
      })),
  };
}

/**
 * Signs that one profile holds two or more people with the same name: affiliations in three or
 * more countries, or at five or more universities, within the last three years.
 */
export function looksMerged(affiliations: any[], year: number): boolean {
  const recent = affiliations.filter((x: any) =>
    (x.years ?? []).some((y: number) => y >= year - 3),
  );
  const countries = new Set(recent.map((x: any) => x.institution?.country_code).filter(Boolean));
  const schools = new Set(
    recent
      .filter((x: any) => x.institution?.type === "education")
      .map((x: any) => x.institution?.id),
  );
  return countries.size >= 3 || schools.size >= 5;
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
  /** True when the person is the first or last author: a paper they led. */
  led: boolean;
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
      led: (w.authorships ?? []).some(
        (au: any) =>
          shortId(au.author?.id) === authorId &&
          (au.author_position === "first" || au.author_position === "last"),
      ),
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
): Promise<{ id: string; name: string; type: string | null } | null> {
  const data = await getJson(
    "OpenAlex",
    openalexUrl("/institutions", {
      search: name.replace(/[^A-Za-z ]+/g, " "),
      filter: "country_code:US",
      select: "id,display_name,type",
      per_page: "1",
    }),
  );
  const hit = (data.results ?? [])[0];
  return hit
    ? { id: shortId(hit.id), name: hit.display_name ?? name, type: hit.type ?? null }
    : null;
}

// ---------------------------------------------------------------- GitHub

const GITHUB = "https://api.github.com";

async function github(path: string, raw = false): Promise<any> {
  const token = process.env["GITHUB_TOKEN"];
  const res = await fetch(`${GITHUB}${path}`, {
    headers: {
      Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "User-Agent": "founder-radar",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new SourceError("GitHub", res.status);
  return raw ? res.text() : res.json();
}

/** The arXiv paper a repository's README points to first, if any. Research code usually links its paper. */
export async function repoArxivId(fullName: string): Promise<string | null> {
  const readme: string = await github(`/repos/${fullName}/readme`, true);
  const m = readme.slice(0, 20000).match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i);
  return m ? m[1]! : null;
}

/** Recently created repositories on a topic that other people have starred. */
export async function searchRepos(opts: {
  term: string;
  since: string;
  minStars: number;
  perPage: number;
}): Promise<CollectedItem[]> {
  const q = `${opts.term} created:>=${opts.since} stars:>=${opts.minStars} fork:false`;
  const data = await github(
    `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(50, opts.perPage)}`,
  );
  // Curated lists and surveys link other people's papers, so they do not point to one builder.
  const isList = (r: any) =>
    /awesome|curated|survey|paper[-_ ]?list|reading[-_ ]?list/i.test(
      `${r.name ?? ""} ${r.description ?? ""}`,
    );
  const repos = (data.items ?? []).filter((r: any) => !isList(r));
  return repos.map((r: any): CollectedItem => ({
    source: "repo",
    source_id: `gh:${r.full_name}`,
    doi: null,
    title: r.full_name ?? null,
    summary:
      [
        r.description ?? "",
        (r.topics ?? []).length ? `Topics: ${(r.topics ?? []).slice(0, 8).join(", ")}` : "",
        r.language ? `Language: ${r.language}` : "",
        `Stars: ${r.stargazers_count ?? 0}`,
      ]
        .filter(Boolean)
        .join(". ") || null,
    item_date: r.created_at ? String(r.created_at).slice(0, 10) : null,
    url: r.html_url ?? null,
    raw: {
      kind: "repo",
      owner: r.owner?.login ?? "",
      ownerType: r.owner?.type ?? "User",
      stars: r.stargazers_count ?? 0,
      term: opts.term,
    },
  }));
}

export type RepoOwner = {
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
};

/** The person behind a repository: its owner, or the top contributor when an organization owns it. */
export async function repoOwnerProfile(
  login: string,
  ownerType: string,
  fullName: string,
): Promise<RepoOwner | null> {
  let user = login;
  if (ownerType === "Organization") {
    const contributors = await github(`/repos/${fullName}/contributors?per_page=1`);
    user = contributors?.[0]?.login ?? "";
  }
  if (!user) return null;
  const u = await github(`/users/${encodeURIComponent(user)}`);
  return {
    login: u.login ?? user,
    name: u.name ?? null,
    company: u.company ?? null,
    location: u.location ?? null,
    bio: u.bio ?? null,
  };
}

/** The paper behind an arXiv ID, with its authors. */
export async function paperByArxiv(
  arxivId: string,
): Promise<{ id: string; title: string; field: string | null; authors: RawAuthor[] } | null> {
  const w = await getJson(
    "OpenAlex",
    openalexUrl(`/works/doi:10.48550/arXiv.${arxivId}`, {
      select: "id,title,authorships,primary_topic",
    }),
  ).catch(() => null);
  if (!w?.id) return null;
  return {
    id: shortId(w.id),
    title: w.title ?? "",
    field: w.primary_topic?.field?.display_name ?? null,
    authors: mapAuthors(w.authorships),
  };
}

/** Where a researcher is now. New preprints often list no institution, so the profile is the fallback. */
export async function authorHome(
  authorId: string,
): Promise<{ id: string; name: string; country: string | null; type: string | null } | null> {
  const a = await getJson(
    "OpenAlex",
    openalexUrl(`/authors/${authorId}`, { select: "id,last_known_institutions" }),
  );
  const i = (a.last_known_institutions ?? [])[0];
  return i
    ? {
        id: shortId(i.id),
        name: i.display_name ?? "",
        country: i.country_code ?? null,
        type: i.type ?? null,
      }
    : null;
}
