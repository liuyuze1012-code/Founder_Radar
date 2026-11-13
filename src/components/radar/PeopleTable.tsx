import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, Chip, Input } from "@heroui/react";
import { LANES } from "@/lib/radar";
import { LaneBadge, PersonAvatar, fmtScore, type PickRow } from "./bits";

export type TableRow = PickRow & {
  in_digest: boolean;
  below_bar_reason: string | null;
  /** Set on the People page, where rows come from many reports. */
  thesis?: string;
  lastSeen?: string;
  reports?: number;
};

type SortKey = "name" | "lane" | "research" | "propensity" | "timing";

const selectCls = "rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-sm";

/** A sortable, filterable table of people. Rows open the person's detail page. */
export function PeopleTable({
  rows,
  showThesis = false,
}: {
  rows: TableRow[];
  showThesis?: boolean;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [lane, setLane] = useState("");
  const [track, setTrack] = useState("");
  const [thesis, setThesis] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const tracks = useMemo(
    () => [...new Set(rows.flatMap((p) => p.people?.tracks ?? []))].sort(),
    [rows],
  );
  const theses = useMemo(
    () => [...new Set(rows.map((p) => p.thesis ?? "").filter(Boolean))].sort(),
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (p) =>
        (!lane || p.lane === lane) &&
        (!track || p.people?.tracks?.includes(track)) &&
        (!thesis || p.thesis === thesis) &&
        (!q || `${p.people?.name ?? ""} ${p.people?.school ?? ""}`.toLowerCase().includes(q)),
    );
    if (!sort) return filtered;
    const val = (p: TableRow): string | number => {
      switch (sort.key) {
        case "name":
          return p.people?.name ?? "";
        case "lane":
          return LANES.findIndex((l) => l.key === p.lane);
        case "research":
          return Number(p.research_score ?? -1);
        case "propensity":
          return Number(p.propensity_score ?? -1);
        case "timing":
          return Number(p.timing_score ?? -1);
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, query, lane, track, thesis, sort]);

  const th = (key: SortKey, label: string, right = false) => (
    <th className={`px-4 py-3 font-medium ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        className="uppercase tracking-wide hover:text-foreground"
        onClick={() =>
          setSort((s) => ({
            key,
            dir: s?.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1,
          }))
        }
      >
        {label}
        {sort?.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search by name or school"
          placeholder="Search name or school"
          className="w-60 rounded-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Lane"
          value={lane}
          onChange={(e) => setLane(e.target.value)}
          className={selectCls}
        >
          <option value="">All lanes</option>
          {LANES.map((l) => (
            <option key={l.key} value={l.key}>
              {l.title}
            </option>
          ))}
        </select>
        {tracks.length > 0 && (
          <select
            aria-label="Track"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className={selectCls}
          >
            <option value="">All tracks</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {showThesis && theses.length > 1 && (
          <select
            aria-label="Thesis"
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            className={selectCls}
          >
            <option value="">All theses</option>
            {theses.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-sm text-muted">
          {shown.length} of {rows.length}
        </span>
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
                <th className="px-4 py-3 text-left font-medium">
                  {showThesis ? "Last seen in" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((p) => (
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
                  <td className="max-w-xs px-4 py-3">
                    {showThesis ? (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{p.thesis}</span>
                          {p.in_digest && (
                            <Chip color="accent" variant="soft" size="sm">
                              Pick
                            </Chip>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {p.lastSeen &&
                            new Date(p.lastSeen).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          {(p.reports ?? 1) > 1 ? ` · in ${p.reports} reports` : ""}
                        </div>
                      </div>
                    ) : p.in_digest ? (
                      <Chip color="accent" variant="soft" size="sm">
                        Pick
                      </Chip>
                    ) : (
                      <span className="text-xs text-muted">{p.below_bar_reason}</span>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    Nobody matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
