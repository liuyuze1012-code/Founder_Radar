import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getCandidates } from "@/lib/data.functions";
import { LANES } from "@/lib/radar";
import { Card, Chip } from "@heroui/react";
import { LaneBadge, PersonAvatar, SampleBanner, fmtScore } from "@/components/radar/bits";

const candQuery = queryOptions({ queryKey: ["candidates"], queryFn: () => getCandidates() });

export const Route = createFileRoute("/candidates")({
  head: () => ({
    meta: [
      { title: "All candidates — Founder Radar" },
      {
        name: "description",
        content: "Every researcher scored in the latest scan, sortable and filterable.",
      },
      { property: "og:title", content: "All candidates — Founder Radar" },
      {
        property: "og:description",
        content: "Every researcher scored in the latest scan, sortable and filterable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(candQuery),
  component: Candidates,
});

type SortKey = "name" | "school" | "lane" | "research" | "propensity" | "timing" | "rank";

function Candidates() {
  const { data } = useSuspenseQuery(candQuery);
  const navigate = useNavigate();
  const [lane, setLane] = useState("");
  const [track, setTrack] = useState("");
  const [school, setSchool] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "research", dir: -1 });

  const tracks = useMemo(
    () => [...new Set(data.picks.flatMap((p) => p.people?.tracks ?? []))].sort(),
    [data.picks],
  );
  const schools = useMemo(
    () => [...new Set(data.picks.map((p) => p.people?.school).filter(Boolean) as string[])].sort(),
    [data.picks],
  );

  const rows = useMemo(() => {
    const val = (p: (typeof data.picks)[number]): string | number => {
      switch (sort.key) {
        case "name":
          return p.people?.name ?? "";
        case "school":
          return p.people?.school ?? "";
        case "lane":
          return LANES.findIndex((l) => l.key === p.lane);
        case "research":
          return Number(p.research_score ?? -1);
        case "propensity":
          return Number(p.propensity_score ?? -1);
        case "timing":
          return Number(p.timing_score ?? -1);
        case "rank":
          return p.rank ?? 999;
      }
    };
    return data.picks
      .filter(
        (p) =>
          (!lane || p.lane === lane) &&
          (!track || p.people?.tracks?.includes(track)) &&
          (!school || p.people?.school === school),
      )
      .sort((a, b) => {
        const x = val(a),
          y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [data.picks, lane, track, school, sort]);

  if (!data.scan) return <p className="py-24 text-center text-muted">No finished scans yet.</p>;

  const th = (key: SortKey, label: string, right = false) => (
    <th className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        className="uppercase tracking-wide hover:text-foreground"
        onClick={() =>
          setSort((s) => ({
            key,
            dir:
              s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" || key === "school" ? 1 : -1,
          }))
        }
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  const select = (
    value: string,
    set: (v: string) => void,
    label: string,
    opts: { v: string; l: string }[],
  ) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => set(e.target.value)}
      className="rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-sm"
    >
      <option value="">All {label.toLowerCase()}</option>
      {opts.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <SampleBanner show={data.scan.is_sample} />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Full pool</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">All candidates</h1>
      <p className="mt-2 text-muted">
        {rows.length} of {data.picks.length} people in the latest scan. People below the bar are
        shown with the reason.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {select(
          lane,
          setLane,
          "Lanes",
          LANES.map((l) => ({ v: l.key, l: l.title })),
        )}
        {select(
          track,
          setTrack,
          "Tracks",
          tracks.map((t) => ({ v: t, l: t })),
        )}
        {select(
          school,
          setSchool,
          "Schools",
          schools.map((s) => ({ v: s, l: s })),
        )}
      </div>
      <Card className="mt-4 gap-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                {th("name", "Name")}
                {th("lane", "Lane")}
                {th("research", "Research", true)}
                {th("propensity", "Founder", true)}
                {th("timing", "Timing", true)}
                <th className="px-4 py-3 text-left font-medium">Identity</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-default/50"
                  onClick={() => navigate({ to: "/founder/$pickId", params: { pickId: p.id } })}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={p.people?.name ?? "?"} lane={p.lane} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium">{p.people?.name}</div>
                        <div className="text-xs text-muted">
                          {[p.people?.school, ...(p.people?.tracks ?? [])]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LaneBadge lane={p.lane} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtScore(p.research_score)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtScore(p.propensity_score)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtScore(p.timing_score)}</td>
                  <td className="px-4 py-3 capitalize text-muted">
                    {p.people?.identity_confidence}
                  </td>
                  <td className="px-4 py-3">
                    {p.in_digest ? (
                      <Chip color="accent" variant="soft" size="sm">
                        In digest
                      </Chip>
                    ) : (
                      <span className="text-xs text-muted">{p.below_bar_reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
