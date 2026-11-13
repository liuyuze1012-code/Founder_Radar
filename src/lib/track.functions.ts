import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const input = z.object({
  pickIds: z.array(z.string().uuid()).min(1).max(15),
  passcode: z.string().max(200),
});

/** Re-check tracked people against the public sources. Uses no AI; each person costs a few lookups. */
export const recheckTracked = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["SCAN_PASSCODE"];
    if (!expected)
      return { ok: false as const, error: "Rescanning is not configured yet (no passcode set)." };
    if (!safeEqual(data.passcode, expected))
      return { ok: false as const, error: "Wrong passcode." };

    const { recheckPick } = await import("./pipeline/recheck.server");
    const results = [];
    for (let i = 0; i < data.pickIds.length; i += 3) {
      const batch = await Promise.all(
        data.pickIds.slice(i, i + 3).map((id) => recheckPick(id).catch(() => null)),
      );
      results.push(...batch.filter((r) => r !== null));
    }
    return { ok: true as const, checkedAt: new Date().toISOString(), results };
  });
