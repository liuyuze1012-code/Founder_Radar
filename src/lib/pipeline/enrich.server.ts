// Evidence gathering for one person. Outside requests only (no database), so it can be tested on its own.

import { schoolByOrgName, type SchoolInfo } from "./config";
import type { RawAuthor } from "./sources.server";
import { authorProfile, awardsByLead, companyCitations, topRecentWorks } from "./sources.server";
import type { PersonFacts } from "./score";

export type PaperPeople = {
  candidate: RawAuthor;
  school: SchoolInfo;
  labHead: RawAuthor | null;
  coauthors: RawAuthor[];
};

function schoolOfAuthor(a: RawAuthor, schools: SchoolInfo[]): SchoolInfo | null {
  for (const s of schools) {
    if (a.insts.some((i) => s.openalex.includes(i.id))) return s;
  }
  for (const i of a.insts) {
    const s = schoolByOrgName(i.name, schools);
    if (s) return s;
  }
  return null;
}

/**
 * Likely founder = first author if they are at a selected school, otherwise the first listed author who is.
 * Lab head = last author on a paper with three or more authors.
 */
export function peopleFromPaper(authors: RawAuthor[], schools: SchoolInfo[]): PaperPeople | null {
  const withId = authors.filter((a) => a.id && a.name);
  let candidate: RawAuthor | null = null;
  let school: SchoolInfo | null = null;
  for (const a of withId) {
    const s = schoolOfAuthor(a, schools);
    if (s) {
      candidate = a;
      school = s;
      break;
    }
  }
  if (!candidate || !school) return null;
  const last = withId[withId.length - 1];
  const labHead = withId.length >= 3 && last && last.id !== candidate.id ? last : null;
  const coauthors = withId.filter((a) => a.id !== candidate!.id && a.id !== labHead?.id);
  return { candidate, school, labHead, coauthors };
}

export type EnrichInput = {
  authorId: string;
  name: string;
  school: SchoolInfo | null;
  labHead: { id: string; name: string } | null;
  screening: {
    fit: number | null;
    applied: string | null;
    useCase: string | null;
    leadTitle: string | null;
    leadUrl: string | null;
  };
  sources: string[];
  knownAwards: NonNullable<PersonFacts["ownAwards"]>;
};

const olderThanSixMonths = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() > 183 * 86400000;

/** Up to five outside requests: profile, top works, company citations, own awards, lab head awards. */
export async function gatherFacts(input: EnrichInput): Promise<PersonFacts> {
  const facts: PersonFacts = { ...input.screening, sources: input.sources };

  const [profile, works, own, head] = await Promise.all([
    authorProfile(input.authorId).catch(() => undefined),
    topRecentWorks(input.authorId).catch(() => undefined),
    awardsByLead(input.name).catch(() => undefined),
    input.labHead ? awardsByLead(input.labHead.name).catch(() => undefined) : Promise.resolve(null),
  ]);

  if (profile) {
    facts.firstYear = profile.firstYear;
    facts.worksThisYear = profile.worksThisYear;
    facts.worksLastYear = profile.worksLastYear;
  }

  if (works) {
    facts.companyCoauthors = [...new Set(works.flatMap((w) => w.companyCoauthors))];
    const best = works.filter((w) => olderThanSixMonths(w.date))[0] ?? null;
    facts.bestWork = best
      ? {
          title: best.title,
          url: `https://openalex.org/${best.id}`,
          top10: best.top10,
          fwci: best.fwci,
        }
      : null;
    if (best) {
      facts.companyCitations =
        best.citedBy > 0 ? await companyCitations(best.id).catch(() => undefined) : 0;
    }
  }

  if (own) {
    const found = own.map((a) => ({
      title: a.title,
      url: a.url,
      date: a.date,
      kind: a.kind,
      // Same full name at the person's own school is a high-confidence link; elsewhere it is only supporting.
      confidence: (input.school && schoolByOrgName(a.awardee, [input.school])
        ? "high"
        : "medium") as "high" | "medium",
    }));
    const seen = new Set(input.knownAwards.map((a) => a.url));
    facts.ownAwards = [...input.knownAwards, ...found.filter((a) => !seen.has(a.url))];
  } else if (input.knownAwards.length) {
    facts.ownAwards = input.knownAwards;
  }

  if (head === null) facts.labHead = null;
  else if (head !== undefined && input.labHead) {
    const atSchool = head.filter(
      (a) => !input.school || schoolByOrgName(a.awardee, [input.school]),
    );
    facts.labHead = {
      name: input.labHead.name,
      awards: atSchool.map((a) => ({ title: a.title, url: a.url, kind: a.kind })),
    };
  }

  return facts;
}
