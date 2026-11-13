import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPickDetail } from "@/lib/data.functions";
import { LaneBadge, SampleBanner, Tag, fmtScore } from "@/components/radar/bits";

const detailQuery = (pickId: string) =>
  queryOptions({ queryKey: ["pick", pickId], queryFn: () => getPickDetail({ data: { pickId } }) });

export const Route = createFileRoute("/founder/$pickId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(detailQuery(params.pickId));
    if (!d) throw notFound();
    return { name: d.pick.people?.name ?? "Researcher" };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — Founder Radar` : "Researcher — Founder Radar";
    const desc = "Scores, evidence, intro paths and startup case for this researcher.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => <p className="py-24 text-center text-muted-foreground">This researcher wasn't found.</p>,
  component: Founder,
});

const GROUPS = [
  ["research", "Research potential"],
  ["propensity", "Founder propensity"],
  ["timing", "Timing"],
  ["lane", "Lane signals"],
] as const;

type IntroPath = { type?: string; name?: string; detail?: string };

function Founder() {
  const { pickId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(pickId));
  if (!data) return null;
  const { pick, evidence, case: c } = data;
  const person = pick.people;
  const intros = (Array.isArray(pick.intro_paths) ? pick.intro_paths : []) as IntroPath[];
  const scores = [
    ["Research potential", pick.research_score, pick.research_coverage],
    ["Founder propensity", pick.propensity_score, pick.propensity_coverage],
    ["Timing", pick.timing_score, pick.timing_coverage],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl">
      <SampleBanner show={data.scan?.is_sample} />
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to digest</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{person?.name}</h1>
          <p className="text-muted-foreground">{person?.school}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <LaneBadge lane={pick.lane} />
            {(person?.tracks ?? []).map((t) => <Tag key={t}>{t}</Tag>)}
            <Tag>Identity: {person?.identity_confidence ?? "unknown"}</Tag>
          </div>
        </div>
        <div className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{pick.action}</div>
      </div>
      <p className="mt-4 text-lg">{pick.why}</p>
      {pick.lane_reason && <p className="mt-1 text-sm text-muted-foreground">Lane: {pick.lane_reason}</p>}
      {(person?.identity_reasons?.length ?? 0) > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">Identity: {person?.identity_reasons?.join(" · ")}</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {scores.map(([label, v, cov]) => (
          <div key={label} className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold">{fmtScore(v)}<span className="text-sm font-normal text-muted-foreground">/10</span></div>
            <div className="text-xs text-muted-foreground">{cov ?? "Coverage unknown"}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">Evidence</h2>
      <div className="mt-3 space-y-6">
        {GROUPS.map(([g, label]) => {
          const rows = evidence.filter((e) => e.score_group === g);
          if (!rows.length) return null;
          return (
            <div key={g}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {rows.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{e.label}</div>
                      <div className="text-muted-foreground">
                        {e.value}{e.status && e.status !== "observed" ? ` (${e.status.replace("_", " ")})` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {e.points != null && <span>{e.points}/{e.max_points} pts</span>}
                      {e.event_date && <span>{new Date(e.event_date).toLocaleDateString()}</span>}
                      {e.source_url && (
                        <a href={e.source_url} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">Source</a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {!evidence.length && <p className="text-sm text-muted-foreground">No evidence recorded.</p>}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">Possible intro paths</h2>
      {intros.length ? (
        <ul className="mt-3 space-y-2">
          {intros.map((i, idx) => (
            <li key={idx} className="rounded-lg border border-border px-4 py-3 text-sm">
              <span className="font-medium">{i.name}</span>
              {i.type && <span className="ml-2 text-muted-foreground">({i.type})</span>}
              {i.detail && <div className="text-muted-foreground">{i.detail}</div>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted-foreground">None found.</p>}

      <h2 className="mt-10 font-display text-xl font-bold">Startup case</h2>
      {c ? (
        <dl className="mt-3 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2">
          {([
            ["Product", c.product], ["Buyer", c.buyer], ["Competitors", c.competitors],
            ["Distance to market", c.distance_to_market], ["Risks", c.risks], ["What's unverified", c.unverified],
          ] as const).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-sm">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-3 text-sm text-muted-foreground">No case written yet.</p>}
    </div>
  );
}
