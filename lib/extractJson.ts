// Claude's final text response occasionally includes reasoning/prose before
// (or instead of a clean) JSON object, even when the prompt insists on JSON
// only -- this bit us once already in the strain-research route. Centralized
// here so every route that asks Claude for structured JSON parses it the
// same robust way: fenced code block first, then a brace-span scan, then a
// raw parse as a last resort.
export function extractTrailingJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return JSON.parse(text.trim());
}

// Claude's `content` array can contain multiple blocks (or a non-text block
// first) -- concatenating every text-type block is more robust than blindly
// indexing content[0], which returns an empty string (and silently breaks
// downstream JSON parsing) the moment that assumption doesn't hold.
export function extractAllText(content: any[] | undefined): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}
