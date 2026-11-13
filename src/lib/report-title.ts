/** Titles are display-only; the original thesis remains the scan input. */
export const SHORT_PROMPT_LIMIT = 80;

export function needsReportTitle(prompt: string): boolean {
  return prompt.length > SHORT_PROMPT_LIMIT;
}

export function fallbackReportTitle(prompt: string): string {
  if (!needsReportTitle(prompt)) return prompt;
  const firstSentence = prompt.trim().split(/[.!?\n]/)[0] ?? prompt.trim();
  if (firstSentence.length <= SHORT_PROMPT_LIMIT) return firstSentence;
  const prefix = firstSentence.slice(0, SHORT_PROMPT_LIMIT - 1);
  const boundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, boundary > 0 ? boundary : prefix.length).trimEnd()}…`;
}

export function validReportTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= SHORT_PROMPT_LIMIT && trimmed.split(/\s+/).length <= 12;
}