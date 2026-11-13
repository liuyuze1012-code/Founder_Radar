import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { advanceScan } from "@/lib/scan.functions";
import { STAGES } from "@/lib/radar";
import { Alert, Card, Spinner } from "@heroui/react";
import { Check } from "lucide-react";

export const Route = createFileRoute("/scan/$scanId")({
  head: () => ({
    meta: [
      { title: "Scan in progress — Founder Radar" },
      { name: "description", content: "Follow the scan through each stage of the funnel." },
      { property: "og:title", content: "Scan in progress — Founder Radar" },
      { property: "og:description", content: "Follow the scan through each stage of the funnel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanProgress,
});

function ScanProgress() {
  const { scanId } = Route.useParams();
  const advance = useServerFn(advanceScan);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [stage, setStage] = useState<string>("translate");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        while (!cancelled) {
          const r = await advance({ data: { scanId } });
          if (cancelled) return;
          setStage(r.stage);
          setCounts(r.counts as Record<string, number>);
          if (r.error) {
            setError(r.error);
            return;
          }
          if (r.done) {
            await qc.invalidateQueries();
            setTimeout(() => !cancelled && navigate({ to: "/" }), 800);
            return;
          }
          await new Promise((res) => setTimeout(res, 500));
        }
      } catch {
        if (!cancelled) setError("The scan stopped. Reload the page to continue.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId, advance, navigate, qc]);

  const current = STAGES.findIndex((s) => s.key === stage);
  const finished = stage === "done";
  const pct = Math.round(((finished ? STAGES.length : Math.max(0, current)) / STAGES.length) * 100);
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Scan</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        {finished ? "Scan finished" : "Running scan"}
      </h1>
      <p className="mt-2 text-muted">Keep this page open. It usually takes one to three minutes.</p>
      <Card className="mt-6 gap-0 p-0">
        <div className="px-5 pt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-default">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <ol className="p-2">
          {STAGES.filter((s) => s.key !== "done").map((s, i) => {
            const state = i < current || finished ? "done" : i === current ? "active" : "pending";
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${state === "active" ? "bg-accent-soft" : ""}`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                    state === "done"
                      ? "bg-accent text-accent-foreground"
                      : state === "active"
                        ? "text-accent"
                        : "bg-default text-muted"
                  }`}
                >
                  {state === "done" ? (
                    <Check className="size-3.5" />
                  ) : state === "active" ? (
                    <Spinner size="sm" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${state === "pending" ? "text-muted" : ""}`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-muted">{STAGE_NOTE[s.key]}</div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{counts[s.key] ?? ""}</span>
              </li>
            );
          })}
        </ol>
      </Card>
      {error && (
        <Alert status="danger" className="mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>The scan stopped</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}

const STAGE_NOTE: Record<string, string> = {
  translate: "Turning the thesis into search phrases",
  collect: "Fetching recent papers and grants",
  clean: "Removing duplicates and non-research items",
  screen: "AI reads each record for fit",
  resolve: "Turning records into people",
  enrich: "Gathering public evidence on each person",
  score: "Scoring and sorting into lanes",
  cases: "Writing a startup case for each pick",
};
