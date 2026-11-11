// The Haba days that have a Meditate mark. The 30-day calendar (plan.ts) is drawn from them.
// Haba's records can be read by anyone with the page's public key (the Firestore rules allow it),
// the same way haba-mark.ts reads them before it marks.
import { habaDay } from './haba-mark.ts';

const BASE = 'https://firestore.googleapis.com/v1/projects/habits-433f8/databases/(default)/documents';
const KEY = 'AIzaSyDtkJvnZLPIkIAJzj9w3F486bX2E8T5kuU'; // public by design, the same as in haba-mark.ts

export async function meditateDays(): Promise<Set<string>> {
  const res = await fetch(`${BASE}:runQuery?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'records' }],
      where: { fieldFilter: { field: { fieldPath: 'item' }, op: 'EQUAL', value: { stringValue: 'meditate' } } },
    } }),
  });
  if (!res.ok) throw new Error(`Haba answered ${res.status}`);
  const rows = (await res.json()) as { document?: { fields?: { t?: { stringValue?: string } } } }[];
  const days = new Set<string>();
  for (const r of rows) {
    const t = r.document?.fields?.t?.stringValue;
    if (t) days.add(habaDay(t));
  }
  return days;
}
