import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { getDigest } from "@/lib/data.functions";
import { LANES } from "@/lib/radar";
import { FounderCard, SampleBanner, laneUi } from "@/components/radar/bits";

const digestQuery = queryOptions({ queryKey: ["digest"], queryFn: () => getDigest() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digest — Founder Radar" },
      { name: "description", content: "This week's researchers worth getting to know, by lane." },
      { property: "og:title", content: "Digest — Founder Radar" },
      {
        property: "og:description",
        content: "This week's researchers worth getting to know, by lane.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(digestQuery),
  component: Digest,
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

function Digest() {
  const { data } = useSuspenseQuery(digestQuery);
  if (!data.scan) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">No finished scans yet</h1>
        <p className="mt-2 text-muted">Run a scan to see your digest.</p>
        <Link
          to="/setup"
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground"
        >
          Start a scan
        </Link>
      </div>
    );
  }
  const thesis = data.scan.theses as { text: string; lane_sizes: Record<string, number> } | null;
  const sizes = thesis?.lane_sizes ?? {};
  const counts = (data.scan.counts ?? {}) as Record<string, number>;
  return (
    <div>
      <SampleBanner show={data.scan.is_sample} />
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Weekly digest
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{thesis?.text}</h1>
        {data.scan.finished_at && (
          <p className="mt-2 text-sm text-muted">
            Scan finished{" "}
            {new Date(data.scan.finished_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
        <Funnel counts={counts} />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        {LANES.map((lane) => {
          const picks = data.picks.filter((p) => p.lane === lane.key);
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
                    {picks.length === 0 ? "Nobody" : `Only ${picks.length}`} met the bar this week.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
