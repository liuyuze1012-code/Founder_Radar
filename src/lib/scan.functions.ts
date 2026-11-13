import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { startInput, scanInputError } from "./scan-input";

// Scan token: HMAC of the scan ID keyed by the passcode, issued only after the passcode check.
async function scanToken(scanId: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`scan:${scanId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export const startScan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => startInput.safeParse(d))
  .handler(async ({ data: parsed }) => {
    if (!parsed.success) return { ok: false as const, error: scanInputError(parsed.error) };
    const data = parsed.data;
    const expected = process.env["SCAN_PASSCODE"];
    if (!expected) return { ok: false as const, error: "Scanning is not configured yet (no passcode set)." };
    if (!safeEqual(data.passcode, expected)) return { ok: false as const, error: "Wrong passcode." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: thesis, error: tErr } = await supabaseAdmin
      .from("theses")
      .insert({ text: data.thesis, school_ids: data.schoolIds, window_days: data.windowDays, lane_sizes: data.laneSizes })
      .select("id")
      .single();
    if (tErr || !thesis) {
      console.error("startScan thesis insert failed", tErr?.code, tErr?.message);
      return { ok: false as const, error: "Could not save your thesis. Please try again." };
    }
    const { data: scan, error: sErr } = await supabaseAdmin
      .from("scans")
      .insert({ thesis_id: thesis.id, status: "queued", stage: "translate", counts: {}, rules_version: "pending", is_sample: false })
      .select("id")
      .single();
    if (sErr || !scan) {
      console.error("startScan scan insert failed", sErr?.code, sErr?.message);
      return { ok: false as const, error: "Your thesis was saved, but the scan could not start. Please try again." };
    }
    return { ok: true as const, scanId: scan.id, token: await scanToken(scan.id, expected) };
  });

export const advanceScan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ scanId: z.string().uuid(), token: z.string().max(128) }).parse(d))
  .handler(async ({ data }) => {
    const secret = process.env["SCAN_PASSCODE"];
    if (!secret || !safeEqual(data.token, await scanToken(data.scanId, secret))) {
      throw new Error("Not authorized to run this scan.");
    }
    // One small unit of work per call. The pipeline lives in src/lib/pipeline.
    const { runStep } = await import("./pipeline/stages.server");
    return runStep(data.scanId);
  });
