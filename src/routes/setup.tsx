import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { startScan } from "@/lib/scan.functions";
import { SCHOOLS } from "@/lib/radar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Setup — Founder Radar" },
      { name: "description", content: "Set your thesis, schools and lanes, then run a scan." },
      { property: "og:title", content: "Setup — Founder Radar" },
      { property: "og:description", content: "Set your thesis, schools and lanes, then run a scan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Setup,
});

function Setup() {
  const run = useServerFn(startScan);
  const navigate = useNavigate();
  const [thesis, setThesis] = useState("");
  const [schools, setSchools] = useState<string[]>(SCHOOLS.map((s) => s.id));
  const [windowDays, setWindowDays] = useState(60);
  const [lanes, setLanes] = useState({ pre_intent: 5, exploring: 3, already_moving: 2 });
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (thesis.trim().length < 3) return setError("Enter a thesis.");
    if (!schools.length) return setError("Pick at least one school.");
    setBusy(true);
    try {
      const res = await run({ data: { thesis, schoolIds: schools, windowDays, laneSizes: lanes, passcode } });
      if (!res.ok) return setError(res.error);
      navigate({ to: "/scan/$scanId", params: { scanId: res.scanId } });
    } catch {
      setError("Something went wrong starting the scan.");
    } finally {
      setBusy(false);
    }
  }

  const laneField = (key: keyof typeof lanes, label: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type="number" min={0} max={50} value={lanes[key]}
        onChange={(e) => setLanes({ ...lanes, [key]: Number(e.target.value) })} />
    </div>
  );

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">New scan</h1>
        <p className="mt-1 text-muted-foreground">Describe what you invest in. We'll look for researchers to get to know.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="thesis">Thesis</Label>
        <Textarea id="thesis" rows={3} placeholder="AI for drug discovery" value={thesis} onChange={(e) => setThesis(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Schools</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCHOOLS.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox checked={schools.includes(s.id)}
                onCheckedChange={(v) => setSchools(v ? [...schools, s.id] : schools.filter((x) => x !== s.id))} />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="window">Time window (days)</Label>
        <Input id="window" type="number" min={1} max={365} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Lane sizes</legend>
        <div className="grid grid-cols-3 gap-3">
          {laneField("pre_intent", "Pre-intent")}
          {laneField("exploring", "Exploring")}
          {laneField("already_moving", "Already moving")}
        </div>
      </fieldset>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="passcode">Passcode</Label>
        <Input id="passcode" type="password" autoComplete="off" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Starting…" : "Run scan"}</Button>
    </form>
  );
}
