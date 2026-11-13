// Pipeline settings. Starting values from the build spec (v3.5); tune on real shortlists.

export const RULES_VERSION = "v3.5-1";

/** Upper bound on records collected per scan. Keeps AI screening cost bounded. */
export const MAX_ITEMS = 240;
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
  state: "MD" | "DC" | "VA";
};

export const SCHOOL_INFO: Record<string, SchoolInfo> = {
  jhu: {
    name: "Johns Hopkins University",
    openalex: ["I145311948"],
    match: ["johns hopkins"],
    state: "MD",
  },
  umd: {
    name: "University of Maryland, College Park",
    openalex: ["I66946132"],
    match: ["maryland college park", "university of maryland college"],
    state: "MD",
  },
  georgetown: {
    name: "Georgetown University",
    openalex: ["I184565670", "I2799903593"],
    match: ["georgetown"],
    state: "DC",
  },
  gwu: {
    name: "George Washington University",
    openalex: ["I193531525"],
    match: ["george washington"],
    state: "DC",
  },
  vt: {
    name: "Virginia Tech",
    openalex: ["I859038795"],
    match: ["virginia tech", "virginia polytechnic"],
    state: "VA",
  },
};

export function schoolsFor(codes: string[]): SchoolInfo[] {
  return codes.map((c) => SCHOOL_INFO[c]).filter((s): s is SchoolInfo => !!s);
}

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Which selected school an organization name refers to, if any. */
export function schoolByOrgName(
  org: string | null | undefined,
  schools: SchoolInfo[],
): SchoolInfo | null {
  if (!org) return null;
  const o = clean(org);
  return schools.find((s) => s.match.some((m) => o.includes(m))) ?? null;
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
