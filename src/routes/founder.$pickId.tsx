import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPickDetail } from "@/lib/data.functions";
import { Card } from "@heroui/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  ActionChip,
  LaneBadge,
  PersonAvatar,
  SampleBanner,
  Tag,
  TrackButton,
  fmtScore,
  laneUi,
} from "@/components/radar/bits";

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
  notFoundComponent: () => (
    <p className="py-24 text-center text-muted-foreground">This researcher wasn't found.</p>
  ),
  component: Founder,
});

const GROUPS = [
  ["research", "Research potential"],
  ["propensity", "Founder propensity"],
  ["timing", "Timing"],
  ["lane", "Lane signals"],
] as const;

type IntroPath = { type?: string; name?: string; detail?: string };

const STATUS_NOTE: Record<string, string> = {
  unknown: "No data yet",
  not_applicable: "Does not apply",
};

function Founder() {
  const { pickId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(pickId));
  if (!data) return null;
  const { pick, evidence, case: c } = data;
  const person = pick.people;
  const ui = laneUi(pick.lane);
  const intros = (Array.isArray(pick.intro_paths) ? pick.intro_paths : []) as IntroPath[];
  const scores = [
    ["Research potential", pick.research_score, pick.research_coverage],
    ["Founder propensity", pick.propensity_score, pick.propensity_coverage],
    ["Timing", pick.timing_score, pick.timing_coverage],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <SampleBanner show={data.scan?.is_sample} />
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to digest
      </Link>

      <Card className="mt-4 gap-5 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <PersonAvatar name={person?.name ?? "Researcher"} lane={pick.lane} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">{person?.name}</h1>
            <p className="text-muted">{person?.school}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <LaneBadge lane={pick.lane} />
              {(person?.tracks ?? []).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
              <Tag>Identity: {person?.identity_confidence ?? "unknown"}</Tag>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionChip action={pick.action} />
            <TrackButton pick={pick} size="md" />
          </div>
        </div>
        <p className="text-lg leading-relaxed">{pick.why}</p>
        <div className="space-y-1 text-sm text-muted">
          {pick.lane_reason && <p>Lane: {pick.lane_reason}</p>}
          {(person?.identity_reasons?.length ?? 0) > 0 && (
            <p>Identity: {person?.identity_reasons?.join(" · ")}</p>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {scores.map(([label, v, cov]) => (
          <Card key={label} className="gap-2 p-5">
            <div className="text-sm text-muted">{label}</div>
            <div className="text-3xl font-semibold tabular-nums">
              {fmtScore(v)}
              <span className="text-base font-normal text-muted">/10</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-default">
              <div
                className={`h-full rounded-full ${ui.bar}`}
                style={{ width: `${Math.max(0, Math.min(10, Number(v ?? 0))) * 10}%` }}
              />
            </div>
            <div className="text-xs text-muted">{cov ?? "Coverage unknown"}</div>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Evidence</h2>
      <p className="mt-1 text-sm text-muted">
        Every line comes from a public record. Follow the source link to check it.
      </p>
      <div className="mt-4 space-y-4">
        {GROUPS.map(([g, label]) => {
          const rows = evidence.filter((e) => e.score_group === g);
          if (!rows.length) return null;
          return (
            <Card key={g} className="gap-0 p-0">
              <h3 className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {label}
              </h3>
              <ul className="divide-y divide-border">
                {rows.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{e.label}</div>
                      <div className="text-muted">{e.value}</div>
                    </div>
                    <div className="flex items-center gap-3 text-muted">
                      {e.status && e.status !== "observed" ? (
                        <span className="rounded-full bg-default px-2 py-0.5 text-xs">
                          {STATUS_NOTE[e.status] ?? e.status}
                        </span>
                      ) : (
                        e.points != null && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                              e.points > 0 ? `${ui.soft} ${ui.text}` : "bg-default"
                            }`}
                          >
                            {e.points}/{e.max_points}
                          </span>
                        )
                      )}
                      {e.event_date && (
                        <span className="text-xs">
                          {new Date(e.event_date).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {e.source_url && (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          Source <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        {!evidence.length && <p className="text-sm text-muted">No evidence recorded.</p>}
      </div>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Possible intro paths</h2>
      {intros.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intros.map((i, idx) => (
            <Card key={idx} className="gap-1 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {i.type}
              </div>
              <div className="font-medium">{i.name}</div>
              {i.detail && <div className="text-sm text-muted">{i.detail}</div>}
            </Card>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">None found.</p>
      )}

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Startup case</h2>
      <p className="mt-1 text-sm text-muted">
        Written by AI from the records above. Treat it as a possibility, not a fact.
      </p>
      {c ? (
        <Card className="mt-4 p-6">
          <dl className="grid gap-6 sm:grid-cols-2">
            {(
              [
                ["Product", c.product],
                ["Buyer", c.buyer],
                ["Competitors", c.competitors],
                ["Distance to market", c.distance_to_market],
                ["Risks", c.risks],
                ["What's unverified", c.unverified],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No case written yet. Cases are written for digest picks.
        </p>
      )}
    </div>
  );
}
