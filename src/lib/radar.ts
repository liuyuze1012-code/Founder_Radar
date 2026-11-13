// Client-safe shared constants.

/** Regions offered on Setup. The ids match REGION_SCHOOLS in src/lib/pipeline/config.ts. */
export const REGIONS = [
  {
    id: "dc",
    name: "DC–Baltimore",
    schools: "Johns Hopkins, Maryland, Georgetown, George Washington, Virginia Tech",
  },
  { id: "boston", name: "Boston", schools: "MIT, Harvard, Boston University, Northeastern, Tufts" },
  { id: "nyc", name: "New York", schools: "Columbia, NYU, Cornell, Rockefeller, Mount Sinai" },
  {
    id: "bay",
    name: "Silicon Valley / Bay Area",
    schools: "Stanford, UC Berkeley, UCSF, UC Santa Cruz",
  },
  { id: "socal", name: "Southern California", schools: "Caltech, UCLA, USC, UC San Diego" },
  { id: "seattle", name: "Seattle", schools: "University of Washington" },
  { id: "south", name: "South", schools: "Duke, UNC, NC State, Georgia Tech, Emory, Vanderbilt" },
  { id: "us", name: "Whole US", schools: "Any US institution" },
] as const;

export const REGION_SHORTCUTS = [
  { name: "East Coast", ids: ["boston", "nyc", "dc"] },
  { name: "West Coast", ids: ["bay", "socal", "seattle"] },
] as const;

export const SCHOOLS = [
  { id: "jhu", name: "Johns Hopkins" },
  { id: "umd", name: "University of Maryland" },
  { id: "georgetown", name: "Georgetown" },
  { id: "gwu", name: "George Washington University" },
  { id: "vt", name: "Virginia Tech" },
] as const;

export const STAGES = [
  { key: "translate", label: "Translate thesis" },
  { key: "collect", label: "Collect" },
  { key: "clean", label: "Clean" },
  { key: "screen", label: "Screen" },
  { key: "resolve", label: "Resolve people" },
  { key: "enrich", label: "Enrich" },
  { key: "score", label: "Score" },
  { key: "cases", label: "Build cases" },
  { key: "done", label: "Done" },
] as const;

export const LANES = [
  {
    key: "pre_intent",
    title: "Pre-intent",
    blurb: "Valuable work, no sign of a company yet",
    cls: "lane-pre",
  },
  {
    key: "exploring",
    title: "Exploring",
    blurb: "Testing whether it could be a business",
    cls: "lane-exp",
  },
  {
    key: "already_moving",
    title: "Already moving",
    blurb: "A company exists or is forming",
    cls: "lane-mov",
  },
] as const;
export type LaneKey = (typeof LANES)[number]["key"];
export const laneOf = (k: string | null) => LANES.find((l) => l.key === k) ?? LANES[0];
