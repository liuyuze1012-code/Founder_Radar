export type CardSummary = { idea: string; qualification: string };

export function validCardSummary(value: CardSummary): boolean {
  const words = value.idea.trim().split(/\s+/).filter(Boolean).length;
  return (words === 7 || words === 8) && value.qualification.trim().length > 0;
}