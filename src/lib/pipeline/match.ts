// Name matching used when linking a grant lead to a researcher profile.

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parts(name: string): { first: string; last: string } {
  const p = normalizeName(name).split(" ").filter(Boolean);
  return { first: p[0] ?? "", last: p[p.length - 1] ?? "" };
}

/**
 * "full": same first and last name (middle names and initials ignored).
 * "initial": same last name and first initial.
 */
export function nameMatch(a: string, b: string): "full" | "initial" | null {
  const x = parts(a);
  const y = parts(b);
  if (!x.last || !y.last || x.last !== y.last) return null;
  if (x.first && y.first && x.first === y.first && x.first.length > 1) return "full";
  if (x.first && y.first && x.first[0] === y.first[0]) return "initial";
  return null;
}

export type Candidate = { id: string; name: string; works?: number };

/** Spec rule: High = exactly one full-name match at the school; Medium = exactly one initial match. */
export function pickCandidate(
  target: string,
  candidates: Candidate[],
): { candidate: Candidate; confidence: "high" | "medium"; reason: string } | null {
  const full = candidates
    .filter((c) => nameMatch(target, c.name) === "full")
    .sort((a, b) => (b.works ?? 0) - (a.works ?? 0));
  if (full.length === 1) {
    return {
      candidate: full[0]!,
      confidence: "high",
      reason: "Only researcher with this full name at the school",
    };
  }
  if (full.length > 1) {
    // Duplicate profiles are common. Accept the main one only when it clearly dominates.
    const [top, second] = full;
    if ((top!.works ?? 0) >= 10 && (second!.works ?? 0) <= (top!.works ?? 0) * 0.2) {
      return {
        candidate: top!,
        confidence: "medium",
        reason: "Several profiles share this name at the school; used the main one",
      };
    }
    return null;
  }
  const initial = candidates.filter((c) => nameMatch(target, c.name) === "initial");
  if (initial.length === 1) {
    return {
      candidate: initial[0]!,
      confidence: "medium",
      reason: "Last name and first initial match one researcher at the school",
    };
  }
  return null;
}
