# Founder Radar

**Meet the founders before they know they're founders.**

Founder Radar turns a VC's investment thesis into a weekly shortlist of researchers and builders worth knowing, including people who haven't decided to start a company yet. Type *"AI for drug discovery"*, pick a region, and it scans recent papers, grants and code from that region's universities. It then returns about 10 people, sorted into three lanes, with every claim linked to a public source.

Built for the Georgetown × Lovable Hackathon. Sister project: [**Unicorn Radar**](https://github.com/liuyuze1012-code/Unicorn_Radar) judges companies once they've raised a Series A. Founder Radar finds the people *before* there is a company.

---

## The problem

The best early-stage deals are won before the founder starts fundraising. By the time a startup appears on AngelList or in a warm intro, ten other funds have seen it.

The earliest public traces of a future founder already exist: a paper with an applied use case, an NSF I-Corps award, an open-source repo that suddenly gets stars, a co-author at a startup. But they're scattered across OpenAlex, NSF, GitHub and lab pages. No associate has time to read 500 abstracts a week to find the five people worth a coffee.

## What it does

1. **Describe the hunt.** Write a thesis in plain words, pick a region (DC: JHU, UMD, Georgetown, GWU, Virginia Tech; also Boston, NYC, Bay Area, SoCal), and choose a time window.
2. **Watch the funnel.** ~280 items collected → cleaned → screened by AI → ~60 people identified → ~10 picks, with live counts at every layer.
3. **Read three lanes:**
   - **Pre-intent:** strong applied research, no company yet. Build the relationship early.
   - **Exploring:** an I-Corps award, past company affiliation or other early commercial signal.
   - **Already moving:** a small-business grant or a recent company. Reach out now.
4. **Check the evidence.** Each person gets three scores (research potential, founder propensity, timing), each shown with "based on X of Y signals". Every signal links to its public source. A startup case covers product, buyer, competitors, risks, and what's still unverified.
5. **Act and track.** Each pick carries a recommended action (reach out, nurture, pair with an operator, watch). Save people to a tracked list, and reopen any past report from the dashboard.

## How it works

**One rule runs the whole pipeline: code fetches, AI reads and labels, code decides.** Cheap checks run first; reading gets deeper only as the list gets shorter.

| Step | Who | What happens |
|---|---|---|
| **Translate** | AI (small) | Turns business words into research words: "drug discovery AI" becomes "protein-ligand binding prediction" plus research fields and code terms. |
| **Collect** | Code | Searches [OpenAlex](https://openalex.org) papers, [NSF](https://www.nsf.gov/awardsearch) I-Corps and small-business awards, and GitHub repos, filtered by thesis, region and date. Capped at 280 items so cost is the same for any region. |
| **Clean** | Code | Drops duplicates, editorials, corrections, retractions, and items with no summary. |
| **Screen** | AI (small), batches of 20 | Reads each title and abstract. Scores thesis fit (0–10) and whether the work is applied and names a use case. Code applies lenient cutoffs, because losing a gem is worse than one extra read. |
| **Resolve** | Code + AI | Turns papers into *people* (lead and last authors, grant PIs, repo owners) and checks identity, flagging profiles that merge two people. |
| **Enrich** | Code | Pulls each person's track record: top recent works and field-weighted citations, company co-authors, citations from industry, their own I-Corps or SBIR awards, their lab head's commercialization history, and repos and stars. |
| **Score** | Code (pure functions) | Builds signals into three scores, assigns a lane, and applies a minimum bar. For example, a pre-intent pick needs research potential ≥ 5, signals covering at least half of its research inputs, and at least one signal beyond the paper itself. A lane shows fewer picks rather than padding with weak ones. |
| **Cases** | AI (large) | Writes the startup case for each pick, marking what is verified and what isn't. |

Every score is deterministic and auditable: the AI never decides who makes the list. Scoring rules are in `src/lib/pipeline/score.ts`.

**Honesty rules built into the product:**
- Every score shows its coverage ("based on 4 of 6 signals"). Unknown is not the same as zero.
- Name-only matches (for example, an award that *might* be this person) are shown but not counted.
- Rate-limit or out-of-credit errors stop the scan and say so, with no silent retry loops.

## Roadmap
- More sources: ClinicalTrials.gov, NIH grants, USPTO patents, arXiv.
- Weekly digests with instant alerts for "Already moving", repeating a person only when a new signal appears.
- Feedback loop: 👍/👎 and promotions train the ranking to a fund's own taste.
- Hand-off to [Unicorn Radar](https://github.com/liuyuze1012-code/Unicorn_Radar): when a tracked founder raises a Series A, score the company against 5,819 historical startups.

## Run it locally

```bash
git clone https://github.com/liuyuze1012-code/founder-radar-setup.git
cd founder-radar-setup
bun install        # or: npm install
bun run dev
bun run test
```

The pipeline needs a backend:
- **Database:** Supabase (Lovable Cloud). The schema lives in `drizzle/migrations/`. Point `.env` at your own project and set `SUPABASE_SERVICE_ROLE_KEY` as a server-side secret. It is never shipped to the browser.
- **AI:** calls go through the Lovable AI gateway (`src/lib/ai.server.ts`) to Claude Haiku (small model) and Claude Sonnet (large model). Swap the base URL and key to use your own provider.
- **Public data APIs:** OpenAlex, NSF Award Search and GitHub need no key for light use.

## Project structure

```
src/
  routes/               # dashboard, setup, live scan, report, founder detail, people, tracked
  lib/pipeline/
    config.ts           # regions, schools (OpenAlex IDs), limits
    sources.server.ts   # OpenAlex, NSF, GitHub clients
    stages.server.ts    # translate → collect → clean → screen → resolve → enrich → score → cases
    score.ts            # signals, scores, lanes, minimum bar (pure, tested)
  lib/ai.server.ts      # model calls (server-only)
drizzle/migrations/     # database schema
```

**Stack:** TanStack Start (React + TypeScript), Tailwind, Supabase, Vitest, Claude via the Lovable AI gateway · built and hosted with [Lovable](https://lovable.dev).

## Responsible use
Founder Radar only reads **public** professional records: papers, grants and code. It is meant to help investors find and *respectfully* reach out to researchers. Don't use it to build profiles of people outside their professional work, and honor anyone who asks not to be contacted.

## License
Code: [MIT](LICENSE). Data comes from OpenAlex (CC0), NSF Award Search (public domain) and the GitHub API (subject to GitHub's terms).

## Team
Built by Gavin (Yuze) Liu at Georgetown University, with Claude and Lovable. Issues and PRs are welcome.
