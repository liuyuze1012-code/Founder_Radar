import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { startScan } from "@/lib/scan.functions";
import { startInput, scanInputError } from "@/lib/scan-input";
import { REGIONS, REGION_SHORTCUTS } from "@/lib/radar";
import { Button, Card, Input, Label, TextArea } from "@heroui/react";
import { Check } from "lucide-react";

export const Route = createFileRoute("/setup")({
  validateSearch: (search: Record<string, unknown>): { thesis?: string; regions?: string } => ({
    ...(typeof search["thesis"] === "string" ? { thesis: search["thesis"] } : {}),
    ...(typeof search["regions"] === "string" ? { regions: search["regions"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Setup — Founder Radar" },
      { name: "description", content: "Set your thesis, regions and lanes, then run a scan." },
      { property: "og:title", content: "Setup — Founder Radar" },
      {
        property: "og:description",
        content: "Set your thesis, schools and lanes, then run a scan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Setup,
});

function Setup() {
  const run = useServerFn(startScan);
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [thesis, setThesis] = useState(search.thesis ?? "");
  const [regions, setRegions] = useState<string[]>(() => {
    const picked = (search.regions ?? "").split(",").filter((c) => REGIONS.some((r) => r.id === c));
    return picked.length ? picked : ["dc"];
  });
  // Whole US replaces the named regions; picking a region turns Whole US off.
  const toggleRegion = (id: string, on: boolean) => {
    if (id === "us") return setRegions(on ? ["us"] : []);
    setRegions(on ? [...regions.filter((r) => r !== "us"), id] : regions.filter((r) => r !== id));
  };
  const [windowDays, setWindowDays] = useState(60);
  const [lanes, setLanes] = useState({ pre_intent: 5, exploring: 3, already_moving: 2 });
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = startInput.safeParse({ thesis, schoolIds: regions, windowDays, laneSizes: lanes, passcode });
    if (!parsed.success) return setError(scanInputError(parsed.error));
    setBusy(true);
    try {
      const res = await run({
        data: parsed.data,
      });
      if (!res.ok) return setError(res.error);
      navigate({ to: "/scan/$scanId", params: { scanId: res.scanId } });
    } catch {
      setError("Could not connect to start the scan. Refresh this page and try again.");
    } finally {
      setBusy(false);
    }
  }

  const laneField = (key: keyof typeof lanes, label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        variant="secondary"
        id={key}
        type="number"
        min={0}
        max={50}
        fullWidth
        value={lanes[key]}
        onChange={(e) => setLanes({ ...lanes, [key]: Number(e.target.value) })}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">New scan</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">What do you invest in?</h1>

      <Card className="mt-8 gap-6 p-6">
        <div className="grid gap-1.5">
          <Label htmlFor="thesis">Thesis</Label>
          <TextArea
            variant="secondary"
            id="thesis"
            rows={3}
            fullWidth
            placeholder="AI for drug discovery"
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
          />
        </div>

        <fieldset className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-medium">Regions</legend>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Shortcuts</span>
              {REGION_SHORTCUTS.map((sc) => (
                <Button
                  key={sc.name}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => setRegions([...sc.ids])}
                >
                  {sc.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {REGIONS.map((r) => {
              const on = regions.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRegion(r.id, !on)}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    on
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-surface hover:border-foreground/25"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                      on ? "border-accent bg-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{r.name}</span>
                    <span className="block text-xs text-muted">{r.schools}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Every choice screens the same number of records, so a wider region costs the same.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="window">Window (days)</Label>
            <Input
              variant="secondary"
              id="window"
              type="number"
              min={1}
              max={365}
              fullWidth
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
            />
          </div>
          {laneField("pre_intent", "Pre-intent picks")}
          {laneField("exploring", "Exploring picks")}
          {laneField("already_moving", "Moving picks")}
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-border pt-6">
          <div className="grid min-w-52 flex-1 gap-1.5">
            <Label htmlFor="passcode">Passcode</Label>
            <Input
              variant="secondary"
              id="passcode"
              type="password"
              autoComplete="off"
              fullWidth
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" isDisabled={busy}>
            {busy ? "Starting…" : "Run scan"}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </form>
  );
}
