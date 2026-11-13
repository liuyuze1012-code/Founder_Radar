import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Card } from "@heroui/react";
import { ArrowRight, FileText, RefreshCw, ScanSearch, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { deleteTheses } from "@/lib/scan.functions";
import { getDashboard } from "@/lib/data.functions";
import { LANES, regionCodes, regionNames } from "@/lib/radar";
import { useTracked } from "@/lib/tracking";
import { SampleBanner, Tag, laneUi } from "@/components/radar/bits";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Founder Radar" },
      {
        name: "description",
        content: "Every thesis you track, every scan you have run, and everyone sourced.",
      },
      { property: "og:title", content: "Dashboard — Founder Radar" },
      {
        property: "og:description",
        content: "Every thesis you track, every scan you have run, and everyone sourced.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

type Scan = Awaited<ReturnType<typeof getDashboard>>["scans"][number];
type ThesisRow = { id: string; text: string; school_ids: string[] } | null;

const thesisOf = (s: Scan) => s.theses as ThesisRow;
const whenOf = (s: Scan) => s.finished_at ?? s.started_at ?? "";
const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function LaneCounts({ lanes }: { lanes: Scan["lanes"] }) {
  return (
    <div className="flex items-center gap-3">
      {LANES.map((l) => (
        <span key={l.key} className="inline-flex items-center gap-1.5 text-sm" title={l.title}>
          <span className={`size-2 rounded-full ${laneUi(l.key).dot}`} />
          <span className="font-semibold tabular-nums">{lanes[l.key]}</span>
        </span>
      ))}
    </div>
  );
}

function StatusTag({ scan }: { scan: Scan }) {
  if (scan.status === "done") return null;
  return <Tag>{scan.status === "failed" ? "Stopped early" : "In progress"}</Tag>;
}

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const qc = useQueryClient();
  const removeFn = useServerFn(deleteTheses);
  const remove = async (text: string, list: Scan[]) => {
    if (!window.confirm(`Delete this thesis and its ${list.length} ${list.length === 1 ? "scan" : "scans"}?`)) return;
    const passcode = window.prompt("Passcode");
    if (!passcode) return;
    const thesisIds = [...new Set(list.map((s) => thesisOf(s)?.id).filter((x): x is string => !!x))];
    const res = await removeFn({ data: { passcode, thesisIds } });
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Deleted "${data.titles[text] ?? text}"`);
    await qc.invalidateQueries();
  };
  const tracked = Object.keys(useTracked()).length;
  const real = data.scans.filter((s) => !s.is_sample);
  const scans = real.length ? real : data.scans;
  const reports = scans.filter((s) => s.status === "done" || s.people > 0);

  // One entry per thesis the VC has scanned, newest first.
  const theses = new Map<string, { text: string; scans: Scan[] }>();
  for (const s of scans) {
    const text = thesisOf(s)?.text?.trim() ?? "";
    if (!text) continue;
    const key = text.toLowerCase();
    const entry = theses.get(key) ?? { text, scans: [] };
    entry.scans.push(s);
    theses.set(key, entry);
  }

  const stats = [
    [theses.size, theses.size === 1 ? "thesis tracked" : "theses tracked"],
    [reports.length, reports.length === 1 ? "report saved" : "reports saved"],
    [data.totalPeople, "people sourced"],
    [tracked, "on your watchlist"],
  ] as const;

  return (
    <div>
      <SampleBanner show={!real.length && data.scans.length > 0} />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Dashboard</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Your sourcing radar</h1>
        </div>
        <Link
          to="/setup"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <ScanSearch className="size-4" /> New scan
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([n, label]) => (
          <Card key={label} className="gap-1 p-5">
            <div className="text-3xl font-semibold tabular-nums">{n}</div>
            <div className="text-sm text-muted">{label}</div>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Theses you track</h2>
      {theses.size === 0 ? (
        <Card className="mt-4 items-center gap-2 p-12 text-center">
          <h3 className="text-lg font-semibold">No scans yet</h3>
          <p className="max-w-md text-sm text-muted">
            Describe what you invest in and run your first scan.
          </p>
          <Link
            to="/setup"
            className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Start a scan
          </Link>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[...theses.values()].map((t) => {
            const latest = t.scans.find((s) => s.status === "done") ?? t.scans[0]!;
            const codes = regionCodes(thesisOf(latest)?.school_ids);
            return (
              <Card key={t.text} className="gap-4 p-5">
                <div>
                  <h3 className="text-lg font-semibold leading-snug" title={t.text}>{data.titles[t.text] ?? t.text}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {regionNames(thesisOf(latest)?.school_ids).map((r) => (
                      <Tag key={r}>{r}</Tag>
                    ))}
                    <span className="text-sm text-muted">
                      {t.scans.length} {t.scans.length === 1 ? "scan" : "scans"} · last{" "}
                      {shortDate(whenOf(latest))}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-default/60 px-4 py-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted">
                      Latest picks
                    </div>
                    <div className="mt-1">
                      <LaneCounts lanes={latest.lanes} />
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    <span className="font-semibold tabular-nums text-foreground">
                      {latest.people}
                    </span>{" "}
                    people found
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/report/$scanId"
                    params={{ scanId: latest.id }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
                  >
                    <FileText className="size-4" /> Open latest report
                  </Link>
                  <Link
                    to="/setup"
                    search={{ thesis: t.text, regions: codes.join(",") }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-foreground/25"
                  >
                    <RefreshCw className="size-4" /> Scan again
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(t.text, t.scans)}
                    aria-label="Delete thesis"
                    className="ml-auto inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {reports.length > 0 && (
        <>
          <h2 className="mt-12 text-xl font-semibold tracking-tight">All reports</h2>
          <Card className="mt-4 gap-0 p-0">
            <ul className="divide-y divide-border">
              {reports.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/report/$scanId"
                    params={{ scanId: s.id }}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-default/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{data.titles[thesisOf(s)?.text?.trim() ?? ""] ?? thesisOf(s)?.text}</span>
                        <StatusTag scan={s} />
                      </div>
                      <div className="mt-0.5 text-sm text-muted">
                        {shortDate(whenOf(s))} ·{" "}
                        {regionNames(thesisOf(s)?.school_ids).join(", ") || "No region"}
                      </div>
                    </div>
                    <div className="text-sm text-muted">
                      <span className="font-semibold tabular-nums text-foreground">{s.people}</span>{" "}
                      people
                    </div>
                    <LaneCounts lanes={s.lanes} />
                    <ArrowRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {LANES.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${laneUi(l.key).dot}`} /> {l.title} picks
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
