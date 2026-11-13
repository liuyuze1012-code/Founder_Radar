import { z } from "zod";

export const startInput = z.object({
  thesis: z.string().trim().min(3, "Enter a thesis of at least 3 characters.").max(500, "Keep your thesis to 500 characters or fewer."),
  schoolIds: z.array(z.string().max(50)).min(1, "Pick at least one region.").max(20),
  windowDays: z.number().int("Window must be a whole number of days.").min(1, "Window must be between 1 and 365 days.").max(365, "Window must be between 1 and 365 days."),
  laneSizes: z.object({
    pre_intent: z.number().int().min(0).max(50),
    exploring: z.number().int().min(0).max(50),
    already_moving: z.number().int().min(0).max(50),
  }),
  passcode: z.string().max(200, "Passcode must be 200 characters or fewer."),
});

export function scanInputError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue?.path[0] === "laneSizes") return "Each lane must have a whole number of picks between 0 and 50.";
  return issue?.message ?? "Check your scan settings.";
}