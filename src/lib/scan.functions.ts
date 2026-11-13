import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Placeholder pipeline. Real internals will replace this via GitHub.
const PIPELINE: { stage: string; count?: number }[] = [
  { stage: "translate" },
  { stage: "collect", count: 500 },
  { stage: "clean", count: 400 },
  { stage: "screen", count: 50 },
  { stage: "resolve", count: 60 },
  { stage: "enrich", count: 50 },
  { stage: "score" },
  { stage: "cases", count: 10 },
  { stage: "done" },
];

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const startInput = z.object({
  thesis: z.string().trim().min(3).max(500),
  schoolIds: z.array(z.string().max(50)).min(1).max(20),
  windowDays: z.number().int().min(1).max(365),
  laneSizes: z.object({
    pre_intent: z.number().int().min(0).max(50),
    exploring: z.number().int().min(0).max(50),
    already_moving: z.number().int().min(0).max(50),
  }),
  passcode: z.string().max(200),
});

export const startScan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => startInput.parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["SCAN_PASSCODE"];
    if (!expected) return { ok: false as const, error: "Scanning is not configured yet (no passcode set)." };
    if (!safeEqual(data.passcode, expected)) return { ok: false as const, error: "Wrong passcode." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: thesis, error: tErr } = await supabaseAdmin
      .from("theses")
      .insert({ text: data.thesis, school_ids: data.schoolIds, window_days: data.windowDays, lane_sizes: data.laneSizes })
      .select("id")
      .single();
    if (tErr || !thesis) throw new Error("Could not save thesis");
    const { data: scan, error: sErr } = await supabaseAdmin
      .from("scans")
      .insert({ thesis_id: thesis.id, status: "queued", stage: "translate", counts: {}, rules_version: "placeholder-0", is_sample: false })
      .select("id")
      .single();
    if (sErr || !scan) throw new Error("Could not create scan");
    return { ok: true as const, scanId: scan.id };
  });

export const advanceScan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: scan, error } = await supabaseAdmin.from("scans").select("*").eq("id", data.scanId).single();
    if (error || !scan) throw new Error("Scan not found");
    const counts = (scan.counts ?? {}) as Record<string, number>;
    if (scan.status === "done" || scan.status === "failed") {
      return { stage: scan.stage ?? "done", counts, done: true };
    }
    // queued → run current stage; running → move to next stage.
    let idx = PIPELINE.findIndex((p) => p.stage === scan.stage);
    if (idx < 0) idx = 0;
    if (scan.status === "running") idx = Math.min(idx + 1, PIPELINE.length - 1);
    const step = PIPELINE[idx];
    const nextCounts = step.count != null ? { ...counts, [step.stage]: step.count } : counts;
    const done = step.stage === "done";
    await supabaseAdmin
      .from("scans")
      .update({
        stage: step.stage,
        counts: nextCounts,
        status: done ? "done" : "running",
        position: { index: idx },
        ...(scan.status === "queued" ? { started_at: new Date().toISOString() } : {}),
        ...(done ? { finished_at: new Date().toISOString() } : {}),
      })
      .eq("id", scan.id);
    return { stage: step.stage, counts: nextCounts, done };
  });
