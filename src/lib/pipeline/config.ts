// Pipeline settings. Starting values from the build spec (v3.5); tune on real shortlists.

export const RULES_VERSION = "v3.5-4";

/** Upper bound on records collected per scan. Keeps AI screening cost the same for any region. */
export const MAX_ITEMS = 280;
/** Search phrases used for the paper search. */
export const MAX_KEYWORDS = 3;
export const SCREEN_BATCH = 20;
export const GRANTS_PER_RESOLVE_CALL = 5;
export const GRANT_WINDOW_DAYS = 365;

export type SchoolInfo = {
  name: string;
  /** OpenAlex institution IDs (verified by live lookup). */
  openalex: string[];
  /** Lowercase fragments that identify the school in free-text organization names. */
  match: string[];
  /** Two-letter state, used for the NSF grant search. null for schools found in whole-US mode. */
  state: string | null;
};

const s = (name: string, openalex: string[], match: string[], state: string): SchoolInfo => ({
  name,
  openalex,
  match,
  state,
});

const JHU = s("Johns Hopkins University", ["I145311948"], ["johns hopkins"], "MD");
const UMD = s(
  "University of Maryland, College Park",
  ["I66946132"],
  ["maryland college park", "university of maryland college"],
  "MD",
);
const GEORGETOWN = s("Georgetown University", ["I184565670", "I2799903593"], ["georgetown"], "DC");
const GWU = s("George Washington University", ["I193531525"], ["george washington"], "DC");
const VT = s("Virginia Tech", ["I859038795"], ["virginia tech", "virginia polytechnic"], "VA");

/** Region code → schools. Codes are what Setup sends and what a thesis stores. */
export const REGION_SCHOOLS: Record<string, SchoolInfo[]> = {
  dc: [JHU, UMD, GEORGETOWN, GWU, VT],
  boston: [
    s(
      "Massachusetts Institute of Technology",
      ["I63966007"],
      ["massachusetts institute of technology"],
      "MA",
    ),
    s("Harvard University", ["I136199984"], ["harvard"], "MA"),
    s("Boston University", ["I111088046"], ["boston university"], "MA"),
    s("Northeastern University", ["I12912129"], ["northeastern university"], "MA"),
    s("Tufts University", ["I121934306"], ["tufts"], "MA"),
  ],
  nyc: [
    s("Columbia University", ["I78577930"], ["columbia university"], "NY"),
    s("New York University", ["I57206974"], ["new york university"], "NY"),
    s("Cornell University", ["I205783295", "I4387153466"], ["cornell"], "NY"),
    s("Rockefeller University", ["I83399316"], ["rockefeller university"], "NY"),
    s("Icahn School of Medicine at Mount Sinai", ["I98704320"], ["mount sinai"], "NY"),
  ],
  bay: [
    s("Stanford University", ["I97018004"], ["stanford"], "CA"),
    s(
      "University of California, Berkeley",
      ["I95457486"],
      ["university of california berkeley"],
      "CA",
    ),
    s(
      "University of California, San Francisco",
      ["I180670191"],
      ["california san francisco"],
      "CA",
    ),
    s("University of California, Santa Cruz", ["I185103710"], ["california santa cruz"], "CA"),
  ],
  socal: [
    s(
      "California Institute of Technology",
      ["I122411786"],
      ["california institute of technology"],
      "CA",
    ),
    s("University of California, Los Angeles", ["I161318765"], ["california los angeles"], "CA"),
    s(
      "University of Southern California",
      ["I1174212"],
      ["university of southern california"],
      "CA",
    ),
    s("University of California, San Diego", ["I36258959"], ["california san diego"], "CA"),
  ],
  seattle: [s("University of Washington", ["I201448701"], ["university of washington"], "WA")],
  south: [
    s("Duke University", ["I170897317"], ["duke university"], "NC"),
    s(
      "University of North Carolina at Chapel Hill",
      ["I114027177"],
      ["north carolina at chapel hill", "north carolina chapel hill"],
      "NC",
    ),
    s("North Carolina State University", ["I137902535"], ["north carolina state"], "NC"),
    s(
      "Georgia Institute of Technology",
      ["I130701444"],
      ["georgia institute of technology", "georgia tech"],
      "GA",
    ),
    s("Emory University", ["I150468666"], ["emory"], "GA"),
    s("Vanderbilt University", ["I200719446"], ["vanderbilt"], "TN"),
  ],
};

/** Scans started before regions existed stored one code per school. */
const LEGACY_SCHOOLS: Record<string, SchoolInfo> = {
  jhu: JHU,
  umd: UMD,
  georgetown: GEORGETOWN,
  gwu: GWU,
  vt: VT,
};

export type Scope = {
  /** Named schools. In whole-US mode this holds every known school, for consistent names. */
  schools: SchoolInfo[];
  /** Whole-US mode: any US institution counts, not only the named schools. */
  anyUS: boolean;
  /** States to search for grants. Empty in whole-US mode, which searches nationally. */
  states: string[];
};

export function scopeFor(codes: string[]): Scope {
  const anyUS = codes.includes("us");
  const picked = anyUS
    ? Object.values(REGION_SCHOOLS).flat()
    : codes.flatMap((c) => REGION_SCHOOLS[c] ?? (LEGACY_SCHOOLS[c] ? [LEGACY_SCHOOLS[c]!] : []));
  const schools = [
    ...new Map((picked.length ? picked : REGION_SCHOOLS["dc"]!).map((x) => [x.name, x])).values(),
  ];
  const states = anyUS
    ? []
    : [...new Set(schools.map((x) => x.state).filter((x): x is string => !!x))];
  return { schools, anyUS, states };
}

const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A school that is not in the named lists, as found in whole-US mode. */
export function adHocSchool(name: string, openalexId?: string | null): SchoolInfo {
  return { name, openalex: openalexId ? [openalexId] : [], match: [clean(name)], state: null };
}

/** Which of these schools an organization name refers to, if any. */
export function schoolByOrgName(
  org: string | null | undefined,
  schools: SchoolInfo[],
): SchoolInfo | null {
  if (!org) return null;
  const o = clean(org);
  return schools.find((x) => x.match.some((m) => m && o.includes(m))) ?? null;
}

const SOFTWARE = ["computer science", "mathematics", "decision sciences"];
const BIOMEDICAL = [
  "medicine",
  "biochemistry, genetics and molecular biology",
  "pharmacology, toxicology and pharmaceutics",
  "immunology and microbiology",
  "neuroscience",
  "health professions",
  "nursing",
  "dentistry",
];
const HARDWARE = [
  "engineering",
  "materials science",
  "physics and astronomy",
  "energy",
  "chemical engineering",
  "chemistry",
  "environmental science",
  "earth and planetary sciences",
];

/** Track from an OpenAlex research field. */
export function trackForField(field: string | null | undefined): string | null {
  const f = (field ?? "").toLowerCase();
  if (!f) return null;
  if (SOFTWARE.includes(f)) return "Software / AI";
  if (BIOMEDICAL.includes(f)) return "Biomedical";
  if (HARDWARE.includes(f)) return "Hardware";
  return null;
}
