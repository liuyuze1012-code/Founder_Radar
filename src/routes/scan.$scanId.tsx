import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { advanceScan } from "@/lib/scan.functions";
import { STAGES } from "@/lib/radar";

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
    return () => { cancelled = true; };
  }, [scanId, advance, navigate, qc]);

  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl font-bold">Running scan</h1>
      <p className="mt-1 text-muted-foreground">Keep this page open until it finishes.</p>
      <ol className="mt-8 space-y-2">
        {STAGES.map((s, i) => {
          const state = i < current || stage === "done" ? "done" : i === current ? "active" : "pending";
          const width = 100 - i * 7;
          return (
            <li key={s.key} className="mx-auto" style={{ width: `${width}%` }}>
              <div className={`flex items-center justify-between rounded-md border px-4 py-2.5 text-sm transition-colors ${
                state === "done" ? "border-primary bg-primary text-primary-foreground"
                : state === "active" ? "border-primary bg-secondary font-medium animate-pulse"
                : "border-border text-muted-foreground"}`}>
                <span>{s.label}</span>
                <span className="tabular-nums">{counts[s.key] ?? (state === "done" ? "✓" : "")}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-6 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
