# Founder Radar — Implementation Plan

All table, column and function names are kept exactly as written in the spec.

## 1. Backend setup
- Enable Lovable Cloud.
- Ask you for `SCAN_PASSCODE` through the secure secrets form (value never in code or chat).
- Check that `OPENALEX_KEY` and `GITHUB_TOKEN` exist. Cloud is not enabled yet, so I can't confirm this now. If they were saved somewhere else, they need adding again after Cloud is on.
- Create a Lovable AI key for the AI helper.

## 2. Database (one migration)
Create the eight tables with the exact columns in the spec. Choices the spec leaves open:
- `id` columns are uuid with `gen_random_uuid()`. Timestamps are `timestamptz`. `created_at`, `started_at` and `retrieved_at` default to `now()`.
- Foreign keys: `scans.thesis_id → theses`, `items.scan_id → scans`, `person_items.person_id/item_id`, `evidence.person_id/scan_id`, `picks.scan_id/person_id`, `cases.scan_id/person_id`, all with on delete cascade.
- Enum-like columns (status, source, verdict, lane, score_group, identity_confidence, evidence status) are text with CHECK constraints rather than Postgres enums, so your GitHub code can change them more easily.
- `research_score`, `propensity_score` and `timing_score` are `numeric(3,1)` on a 0–10 scale. `points` and `max_points` stay int as specified.
- `people.openalex_id` is unique and nullable, as specified.
- Indexes on `picks(scan_id)`, `evidence(person_id, scan_id)`, `items(scan_id)` and `scans(status, finished_at)`.
- Access: GRANT SELECT to anon and authenticated. Turn on RLS with a SELECT policy for everyone and no write policies. Only service_role (server functions) can write.
- Sample data goes in the same migration as literal INSERTs: 1 thesis ("AI for drug discovery") and 1 finished scan with `is_sample = true`. It adds 20 fictional people across the 5 schools, 3 lanes and 3 tracks. Each person gets 3–6 evidence rows, 1 picks row and 1 case. A few items and person_items rows are included so the tables aren't empty. Some lanes will have more people than their lane size (shown as "Below bar") and at least one lane will have fewer (to show the "Only N met the bar" message).

## 3. Server functions (`createServerFn`, in `src/server/*.functions.ts` and `*.server.ts`)
- **callAI** (server-only helper, not callable from the browser): uses Lovable AI's Claude endpoint. "small" = `anthropic/claude-haiku-4-5`, "large" = `anthropic/claude-sonnet-5`. It asks for JSON in the given `jsonSchema` format and reads the full streamed reply on the server before returning parsed JSON. On 402 or 429 it returns a clear typed error with no retry. 403 and refusals are also returned as errors and never retried.
- **startScan**: checks input, compares the passcode on the server against `SCAN_PASSCODE` (constant-time compare). It then inserts a `theses` row, inserts a `scans` row (`status = queued`, `stage = translate`, `is_sample = false`, `rules_version = "placeholder-0"`) and returns `{ scanId }`.
- **advanceScan**: loads the scan and moves one stage forward through translate → collect(500) → clean(400) → screen(50) → resolve(60) → enrich(50) → score → cases(10) → done. It updates `stage`, `counts`, `status` and `started_at`/`finished_at`, then returns `{ stage, counts, done }`. Calling it on a finished scan just returns the done state, so repeat calls are safe.

## 4. Screens (TanStack routes; data loaded through route loaders and queries)
- `/` **Digest** — the latest scan with `status = done`, shown in three lane columns with cards and the "Only N met the bar this week." message.
- `/setup` **Setup** — the form from the spec; "Run scan" goes to the progress page.
- `/scan/$scanId` **Scan progress** — a vertical funnel. It calls advanceScan in a loop, shows the count at each stage, and goes to Digest when done.
- `/founder/$pickId` **Founder detail** — uses the pick, because scores depend on the scan. Shows the card, scores with coverage text, evidence grouped by score_group, intro paths and the startup case.
- `/candidates` **All candidates** — a sortable table with lane, track and school filters and "In digest" / "Below bar" tags with the reason. Clicking a row opens detail.
- A "Sample data" banner shows on any screen whose scan has `is_sample = true`.
- Design: white background, dark navy text, purple, amber and slate lane colors set as design tokens, a professional serif + sans font pairing, and top navigation (Setup, Digest, All candidates). Each page gets its own title and description.

## 5. What won't work on this platform as written
- **Long-running scans.** Server functions have short time limits, so a real scan can't run in one call. The one-step `advanceScan` design fits. But the browser drives the loop, so if the tab closes the scan pauses until someone reopens the progress page. A background runner (cron) can be added later if you want.
- **Edge Functions.** This stack uses server functions, not separate Edge Functions. Your GitHub replacements should edit those files.
- **Schema changes from GitHub.** The project rules say migrations must be changed through Lovable, not pushed from GitHub. Function internals can be replaced from GitHub. New tables or columns must be requested here.
- **"Smallest Claude" is a fixed choice.** The model IDs are written into callAI. A newer model won't be picked up automatically.

## 6. Changes I'd recommend (and why)
1. **Protect advanceScan.** As written, anyone can advance any scan. I'd have it also accept the passcode, or a per-scan token returned by startScan.
2. **Limit passcode attempts.** Add a simple lockout after repeated wrong passcodes to block guessing.
3. **Digest fallback.** Placeholder scans create no picks, so after your first real run the Digest would be empty. I'd show the latest finished scan that has picks, with a note about which scan is on screen (see question 1).
4. **Fill in `theses.keywords` and `fields`.** These are left empty (the "translate" step's job), not invented.

## 7. Questions before building
1. Once a real scan finishes with no picks, should Digest show it (empty) or keep showing the latest scan that has picks?
2. What are the three tracks called (for example "Therapeutics", "Platform/Tools", "Diagnostics")? Should `tracks` use fixed values?
3. Should the Setup screen allow schools beyond the five preselected ones? If so, which list, and what format should `school_ids` use (short slugs like `jhu`, or OpenAlex institution IDs)?
4. Is the passcode protection on advanceScan (change 1) acceptable?
5. Should the 0–10 scores show one decimal (7.5) or whole numbers?
