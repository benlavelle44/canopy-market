// Lightweight fuzzy name matching -- no dependency needed for a catalog
// this size (a few hundred strain names). Used to catch typos ("Banana
// Runtzcake" -> "Banana Runtz") before burning an AI web-search call on
// something that's actually already in the database.

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Classic Levenshtein edit distance.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen;
}

export interface FuzzyMatch<T> {
  item: T;
  similarity: number;
}

/**
 * Finds catalog entries whose (normalized) name is close enough to `query`
 * to plausibly be a typo of it -- e.g. "Banana Runtzcake" vs "Banana Runtz".
 * Also checks a containment match (one is a substring of the other after
 * normalizing) since that catches merged/split words a pure edit distance
 * can undervalue.
 */
export function findSimilarNames<T>(
  query: string,
  items: T[],
  getName: (item: T) => string,
  { limit = 3, threshold = 0.62 }: { limit?: number; threshold?: number } = {}
): FuzzyMatch<T>[] {
  const nq = normalize(query);
  if (!nq) return [];

  const scored = items
    .map((item) => {
      const name = getName(item);
      const nn = normalize(name);
      let score = similarity(nq, nn);
      if (nn.includes(nq) || nq.includes(nn)) {
        score = Math.max(score, 0.8);
      }
      return { item, similarity: score };
    })
    .filter((x) => x.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

/** True if `query` is close enough to an existing name that it's very likely a typo, not a new strain. */
export function isLikelyTypo<T>(query: string, items: T[], getName: (item: T) => string): boolean {
  return findSimilarNames(query, items, getName, { limit: 1, threshold: 0.78 }).length > 0;
}

/** Basic slugify shared by anything that needs to turn a strain name into a URL slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
