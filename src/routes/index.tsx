import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDigest } from "@/lib/data.functions";
import { LANES } from "@/lib/radar";
import { SampleBanner, Scores, Tag, laneBar } from "@/components/radar/bits";

const digestQuery = queryOptions({ queryKey: ["digest"], queryFn: () => getDigest() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digest — Founder Radar" },
      { name: "description", content: "This week's researchers worth getting to know, by lane." },
      { property: "og:title", content: "Digest — Founder Radar" },
      { property: "og:description", content: "This week's researchers worth getting to know, by lane." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(digestQuery),
  component: Digest,
});

function Digest() {
  const { data } = useSuspenseQuery(digestQuery);
  if (!data.scan) {
    return (
      <div className="py-24 text-center">
        <h1 className="font-display text-3xl font-bold">No finished scans yet</h1>
        <p className="mt-2 text-muted-foreground">Run a scan to see your digest.</p>
        <Link to="/setup" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go to Setup</Link>
      </div>
    );
  }
  const thesis = data.scan.theses as { text: string; lane_sizes: Record<string, number> } | null;
  const sizes = thesis?.lane_sizes ?? {};
  return (
    <div>
      <SampleBanner show={data.scan.is_sample} />
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Weekly digest</p>
        <h1 className="font-display text-3xl font-bold">{thesis?.text}</h1>
        {data.scan.finished_at && (
          <p className="mt-1 text-sm text-muted-foreground">Scan finished {new Date(data.scan.finished_at).toLocaleDateString()}</p>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {LANES.map((lane) => {
          const picks = data.picks.filter((p) => p.lane === lane.key);
          const size = sizes[lane.key] ?? 0;
          return (
            <section key={lane.key}>
              <div className={`h-1 rounded-full ${laneBar[lane.key]}`} />
              <h2 className="mt-3 font-display text-xl font-bold">{lane.title}</h2>
              <p className="text-sm text-muted-foreground">{lane.blurb}</p>
              <div className="mt-4 space-y-3">
                {picks.map((p) => (
                  <Link key={p.id} to="/founder/$pickId" params={{ pickId: p.id }}
                    className="block rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{p.people?.name}</div>
                        <div className="text-sm text-muted-foreground">{p.people?.school}</div>
                      </div>
                      <span className="text-xs font-medium text-foreground">{p.action}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(p.people?.tracks ?? []).map((t) => <Tag key={t}>{t}</Tag>)}
                      <Tag>Identity: {p.people?.identity_confidence ?? "unknown"}</Tag>
                    </div>
                    <div className="mt-3"><Scores r={p.research_score} p={p.propensity_score} t={p.timing_score} /></div>
                    <p className="mt-3 text-sm">{p.why}</p>
                  </Link>
                ))}
                {picks.length < size && (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    Only {picks.length} met the bar this week.
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
