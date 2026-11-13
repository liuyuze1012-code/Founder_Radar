import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { getReport } from "@/lib/data.functions";
import { LANES, regionCodes, regionNames } from "@/lib/radar";
import { FounderCard, SampleBanner, Tag, laneUi } from "@/components/radar/bits";
import { PeopleTable } from "@/components/radar/PeopleTable";

const reportQuery = (scanId: string) =>
  queryOptions({ queryKey: ["report", scanId], queryFn: () => getReport({ data: { scanId } }) });

export const Route = createFileRoute("/report/$scanId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(reportQuery(params.scanId));
    if (!d) throw notFound();
    return { thesis: (d.scan.theses as { text?: string } | null)?.text ?? "Report" };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.thesis ?? "Report"} — Founder Radar` },
      { name: "description", content: "The people this scan found, sorted into three lanes." },
    ],
  }),
  notFoundComponent: () => (
    <p className="py-24 text-center text-muted">This report wasn't found.</p>
  ),
  component: Report,
});

/** The scan's funnel, from records collected down to people who cleared the bar. */
function Funnel({ counts }: { counts: Record<string, number> }) {
  const steps = [
    [counts["collect"], "records collected"],
    [counts["screen"], "passed screening"],
    [counts["resolve"], "people identified"],
    [counts["score"], "cleared the bar"],
  ].filter(([n]) => n != null) as [number, string][];
  if (!steps.length) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map(([n, label], i) => (
        <div key={label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-4 text-muted" />}
          <span className="rounded-full bg-surface px-3 py-1 text-sm shadow-sm">
            <span className="font-semibold tabular-nums">{n}</span>{" "}
            <span className="text-muted">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Report() {
  const { scanId } = Route.useParams();
  const { data } = useSuspenseQuery(reportQuery(scanId));
  if (!data) return null;
  const thesis = data.scan.theses as {
    text: string;
    lane_sizes: Record<string, number>;
    school_ids: string[];
  } | null;
  const sizes = thesis?.lane_sizes ?? {};
  const counts = (data.scan.counts ?? {}) as Record<string, number>;
  const when = data.scan.finished_at ?? data.scan.started_at;
  const digest = data.picks.filter((p) => p.in_digest);
  return (
    <div>
      <SampleBanner show={data.scan.is_sample} />
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
      <div className="mb-10 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Report</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{thesis?.text}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            {when && (
              <span>
                {new Date(when).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {regionNames(thesis?.school_ids).map((r) => (
              <Tag key={r}>{r}</Tag>
            ))}
            {data.scan.status !== "done" && (
              <Tag>{data.scan.status === "failed" ? "Stopped early" : "In progress"}</Tag>
            )}
          </div>
          <Funnel counts={counts} />
        </div>
        <Link
          to="/setup"
          search={{
            thesis: thesis?.text ?? "",
            regions: regionCodes(thesis?.school_ids).join(","),
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-sm hover:border-foreground/25"
        >
          <RefreshCw className="size-4" /> Scan this thesis again
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {LANES.map((lane) => {
          const picks = digest.filter((p) => p.lane === lane.key);
          const size = sizes[lane.key] ?? 0;
          const ui = laneUi(lane.key);
          return (
            <section key={lane.key}>
              <div className="flex items-center gap-2.5">
                <span className={`size-2.5 rounded-full ${ui.dot}`} />
                <h2 className="text-lg font-semibold tracking-tight">{lane.title}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${ui.soft} ${ui.text}`}
                >
                  {picks.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{lane.blurb}</p>
              <div className="mt-4 space-y-4">
                {picks.map((p) => (
                  <FounderCard key={p.id} pick={p} />
                ))}
                {picks.length < size && (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted">
                    {picks.length === 0 ? "Nobody" : `Only ${picks.length}`} met the bar in this
                    scan.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <h2 className="mb-4 mt-14 text-xl font-semibold tracking-tight">Everyone in this scan</h2>
      <PeopleTable rows={data.picks} />
    </div>
  );
}
