// Evidence gathering for one person. Outside requests only (no database), so it can be tested on its own.

import { adHocSchool, schoolByOrgName, type Scope, type SchoolInfo } from "./config";
import type { RawAuthor } from "./sources.server";
import {
  authorProfile,
  awardsByLead,
  companyCitations,
  companySizes,
  findAuthorsAtSchool,
  lookupInstitution,
  paperByArxiv,
  repoArxivId,
  repoOwnerProfile,
  topRecentWorks,
} from "./sources.server";
import { pickCandidate } from "./match";
import type { PersonFacts } from "./score";

export type PaperPeople = {
  candidate: RawAuthor;
  role: "lead author" | "senior author";
  school: SchoolInfo;
  labHead: RawAuthor | null;
  coauthors: RawAuthor[];
};

function schoolOfAuthor(a: RawAuthor, scope: Scope): SchoolInfo | null {
  const schools = scope.schools;
  for (const s of schools) {
    if (a.insts.some((i) => s.openalex.includes(i.id))) return s;
  }
  for (const i of a.insts) {
    const s = schoolByOrgName(i.name, schools);
    if (s) return s;
  }
  if (scope.anyUS) {
    // Whole-US mode: any US institution that is not a company.
    const us = a.insts.find((i) => i.country === "US" && i.type !== "company" && i.name);
    if (us) return adHocSchool(us.name, us.id);
  }
  return null;
}

/**
 * Likely founder = the first author, if they are at a selected school. Otherwise the last (senior)
 * author, if they are. A middle author is never picked: they did not lead the work.
 * Lab head = last author, when the paper has two or more authors and the candidate is the first.
 */
export function peopleFromPaper(authors: RawAuthor[], scope: Scope): PaperPeople | null {
  const withId = authors.filter((a) => a.id && a.name);
  const first = withId[0];
  const last = withId[withId.length - 1];
  if (!first || !last) return null;
  const firstSchool = schoolOfAuthor(first, scope);
  if (firstSchool) {
    const labHead = withId.length >= 2 && last.id !== first.id ? last : null;
    const coauthors = withId.filter((a) => a.id !== first.id && a.id !== labHead?.id);
    return { candidate: first, role: "lead author", school: firstSchool, labHead, coauthors };
  }
  const lastSchool = last.id !== first.id ? schoolOfAuthor(last, scope) : null;
  if (lastSchool) {
    const coauthors = withId.filter((a) => a.id !== last.id);
    return { candidate: last, role: "senior author", school: lastSchool, labHead: null, coauthors };
  }
  return null;
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

/** A company with this many publications or fewer is treated as a small venture, not a large employer. */
// Checked against real cases: Cerecor 12, BioXcel 78, Ginkgo Bioworks 211; large employers such as
// D. E. Shaw Research (418), Praxair (517) and Genentech (26,034) fall above the line.
const SMALL_COMPANY_MAX_WORKS = 300;

const olderThanSixMonths = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() > 183 * 86400000;

/** Up to six outside requests: profile, company sizes, top works, company citations, own awards, lab head awards. */
export async function gatherFacts(input: EnrichInput): Promise<PersonFacts> {
  const facts: PersonFacts = { ...input.screening, sources: input.sources };

  const [profile, allWorks, own, head] = await Promise.all([
    authorProfile(input.authorId).catch(() => undefined),
    topRecentWorks(input.authorId).catch(() => undefined),
    awardsByLead(input.name).catch(() => undefined),
    input.labHead ? awardsByLead(input.labHead.name).catch(() => undefined) : Promise.resolve(null),
  ]);

  if (profile?.mixed) {
    // Likely two people in one profile: do not trust its history or its company affiliations.
    facts.profileMixed = true;
    facts.worksThisYear = profile.worksThisYear;
    facts.worksLastYear = profile.worksLastYear;
  } else if (profile) {
    facts.firstYear = profile.firstYear;
    facts.worksThisYear = profile.worksThisYear;
    facts.worksLastYear = profile.worksLastYear;
    if (!profile.companies.length) facts.ownCompanies = [];
    else {
      const sizes = await companySizes(profile.companies.map((c) => c.id)).catch(() => undefined);
      if (sizes) {
        facts.ownCompanies = profile.companies.map((c) => ({
          name: c.name,
          lastYear: c.lastYear,
          small: (sizes.get(c.id) ?? 0) <= SMALL_COMPANY_MAX_WORKS,
          us: c.us,
        }));
      }
    }
  }

  // In a merged profile, keep only the papers that list the person at their own school.
  const school = input.school;
  const works =
    allWorks && profile?.mixed && school
      ? allWorks.filter((w) =>
          w.ownInstitutions.some(
            (i) => school.openalex.includes(i.id) || !!schoolByOrgName(i.name, [school]),
          ),
        )
      : allWorks;

  if (works) {
    // A coauthor at the person's own former employer is a colleague, not an outside company tie.
    const employers = new Set((profile?.companies ?? []).map((c) => c.name));
    facts.companyCoauthors = [...new Set(works.flatMap((w) => w.companyCoauthors))].filter(
      (name) => !employers.has(name),
    );
    // Citation claims use a paper the person led, never one where they are a middle author.
    const best = works.filter((w) => w.led && olderThanSixMonths(w.date))[0] ?? null;
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

/**
 * The researcher behind a code repository, or null when there is no confident match.
 * First choice: the paper the README links, and that paper's lead author. This is the reliable route.
 * Fallback: the GitHub profile's real name and stated school.
 */
export async function personBehindRepo(
  fullName: string,
  ownerLogin: string,
  ownerType: string,
  scope: Scope,
): Promise<{ authorId: string; name: string; school: string; reasons: string[] } | null> {
  // Route 1: the paper the README links.
  const arxiv = await repoArxivId(fullName).catch(() => null);
  if (arxiv) {
    const paper = await paperByArxiv(arxiv);
    const lead = paper?.authors.find((a) => a.id && a.name);
    if (paper && lead) {
      const reasons = [
        `Repository README links the paper "${paper.title.slice(0, 80)}"`,
        "Lead author of that paper",
      ];
      const onPaper = peopleFromPaper(paper.authors, scope);
      if (onPaper?.role === "lead author") {
        return {
          authorId: onPaper.candidate.id,
          name: onPaper.candidate.name,
          school: onPaper.school.name,
          reasons,
        };
      }
      // A new preprint with no institution on record is not matched: guessing the author's
      // school from their name attached the wrong person in testing.
      return null;
    }
  }

  // Route 2: the GitHub profile's real name and stated school.
  const owner = await repoOwnerProfile(ownerLogin, ownerType, fullName).catch(() => null);
  const name = owner?.name?.trim() ?? "";
  if (!owner || name.split(/\s+/).length < 2) return null;
  const where = [owner.company, owner.bio, owner.location].filter(Boolean).join(" · ");
  let school = schoolByOrgName(where, scope.schools);
  if (!school && scope.anyUS && owner.company) {
    const inst = await lookupInstitution(owner.company).catch(() => null);
    if (inst && inst.type === "education") school = adHocSchool(inst.name, inst.id);
  }
  if (!school || !school.openalex.length) return null;
  const pick = pickCandidate(
    name,
    await findAuthorsAtSchool(name, school.openalex).catch(() => []),
  );
  if (!pick) return null;
  return {
    authorId: pick.candidate.id,
    name: pick.candidate.name,
    school: school.name,
    reasons: [`GitHub profile ${owner.login} names ${school.name}`, pick.reason],
  };
}
