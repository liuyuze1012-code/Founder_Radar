<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Founder Radar architecture
- Server logic lives in `src/lib/*.functions.ts` (startScan, advanceScan, data reads) and `src/lib/*.server.ts` (callAI, db clients) — these are the files to replace via GitHub; they keep one-step-per-call scans within worker time limits.
- All tables are read-only to the public (SELECT policies); writes happen only in server functions via the service-role client.
- Pages read from the database only, never hardcoded data; the sample scan is flagged `is_sample = true` and shows a banner.
- Report card summaries are presentation-only rewrites of saved cases.product and picks.why; validate seven- or eight-word ideas, cache by source content, and never alter sourcing, scoring, or saved startup cases.
