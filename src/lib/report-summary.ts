export type CardSummary = { idea: string; qualification: string };

export type IdeaRecord = {
  source: string | null;
  source_id: string | null;
  title: string | null;
  summary: string | null;
  fit: number | null;
};

/** Prefer a substantive, thesis-relevant primary record over a generated case. */
export function selectIdeaRecord(records: IdeaRecord[]): IdeaRecord | undefined {
  return [...records].sort((a, b) =>
    Number(Boolean(b.summary?.trim())) - Number(Boolean(a.summary?.trim())) ||
    (b.fit ?? 0) - (a.fit ?? 0),
  ).find((record) => record.summary?.trim() || record.title?.trim());
}

export function ideaInput(record: IdeaRecord | undefined, product: string | null): string | null {
  if (record?.summary?.trim()) return `Source: ${record.source}\nTitle: ${record.title ?? ""}\nDescription: ${record.summary}`;
  if (product?.trim()) return `Possible product from saved startup case: ${product}`;
  return record?.title?.trim() ? `Source: ${record.source}\nTitle: ${record.title}` : null;
}

export function validCardSummary(value: CardSummary): boolean {
  const words = value.idea.trim().split(/\s+/).filter(Boolean).length;
  return (words === 7 || words === 8) && value.qualification.trim().length > 0;
}