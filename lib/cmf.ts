import { ProductCategory, PRODUCT_CATEGORIES } from './types';

// Canopy Menu Feed v1 (CMF-1)
// -----------------------------------------------------------------------
// An open, standardized CSV schema for dispensary menu/inventory data.
// Any dispensary POS or seed-to-sale system (Dutchie, Flowhub, Jane, Treez,
// Cova, Blaze, LeafLogix, a spreadsheet, whatever) can export a CSV in this
// shape and it will import cleanly into Canopy Market -- and, being a
// published open spec, anyone else (another marketplace, a state system) is
// free to read or write it too. This module is the single source of truth
// for the schema; the public spec page at /cmf and the dashboard importer
// both import from here so they can never drift out of sync.

export const CMF_VERSION = '1.0';

export const VALID_CATEGORIES = new Set(PRODUCT_CATEGORIES.map((c) => c.id));

// Column order is part of the spec -- exporters should emit exactly this
// header row. Importers (ours included) are tolerant of reordered columns
// as long as the names match, but same-order is recommended for simplicity.
export const CMF_HEADERS = [
  'category',
  'name',
  'brand',
  'strain_slug',
  'sku',
  'price',
  'thc',
  'cbd',
  'in_stock',
  'description',
  'image_url',
] as const;

export type CmfHeader = (typeof CMF_HEADERS)[number];

export interface CmfRow {
  category: ProductCategory;
  name: string;
  brand: string | null;
  strain_slug: string | null;
  sku: string | null;
  price: number | null;
  thc: number | null;
  cbd: number | null;
  in_stock: boolean;
  description: string | null;
  image_url: string | null;
}

export interface CmfParseError {
  line: number; // 1-based, counting the header as line 1
  message: string;
}

export interface CmfParseResult {
  rows: CmfRow[];
  errors: CmfParseError[];
}

// Minimal CSV line splitter that handles quoted fields (with embedded
// commas and escaped "" quotes) without pulling in a dependency -- CMF-1
// files are small (a dispensary menu, not a data warehouse export).
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function toBool(v: string | undefined): boolean {
  if (!v) return true; // default to in-stock if omitted
  const s = v.trim().toLowerCase();
  return !['false', '0', 'no', 'n', 'out', 'out_of_stock'].includes(s);
}

function toNum(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: string | undefined): string | null {
  if (v === undefined) return null;
  const s = v.trim();
  return s === '' ? null : s;
}

/**
 * Parses raw CMF-1 CSV text into structured rows. Never throws -- bad rows
 * are collected in `errors` and skipped so one malformed line doesn't sink
 * an entire menu import.
 */
export function parseCmfCsv(csvText: string): CmfParseResult {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  const errors: CmfParseError[] = [];
  const rows: CmfRow[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: 'File is empty.' }] };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex: Partial<Record<CmfHeader, number>> = {};
  for (const h of CMF_HEADERS) {
    const idx = header.indexOf(h);
    if (idx !== -1) colIndex[h] = idx;
  }

  if (colIndex.category === undefined || colIndex.name === undefined) {
    errors.push({ line: 1, message: 'Header row must include at least "category" and "name" columns.' });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = splitCsvLine(lines[i]);
    const get = (h: CmfHeader) => (colIndex[h] !== undefined ? cells[colIndex[h]!] : undefined);

    const rawCategory = (get('category') || '').trim().toLowerCase() as ProductCategory;
    const name = toStr(get('name'));

    if (!name) {
      errors.push({ line: lineNum, message: 'Missing required "name" value.' });
      continue;
    }
    if (!VALID_CATEGORIES.has(rawCategory)) {
      errors.push({
        line: lineNum,
        message: `Invalid category "${get('category')}". Must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}.`,
      });
      continue;
    }

    rows.push({
      category: rawCategory,
      name,
      brand: toStr(get('brand')),
      strain_slug: toStr(get('strain_slug')),
      sku: toStr(get('sku')),
      price: toNum(get('price')),
      thc: toNum(get('thc')),
      cbd: toNum(get('cbd')),
      in_stock: toBool(get('in_stock')),
      description: toStr(get('description')),
      image_url: toStr(get('image_url')),
    });
  }

  return { rows, errors };
}

/** Builds a downloadable CMF-1 template CSV with a couple of example rows. */
export function generateCmfTemplate(): string {
  const header = CMF_HEADERS.join(',');
  const example1 = [
    'flower',
    'Blue Dream',
    'Canopy Farms',
    'blue-dream',
    'SKU-1001',
    '35',
    '21',
    '0.1',
    'true',
    '"A classic sativa-leaning hybrid, sweet berry aroma."',
    '',
  ].join(',');
  const example2 = [
    'edible',
    'Watermelon Gummies 100mg',
    'Kiva',
    '',
    'SKU-2044',
    '18',
    '',
    '',
    'true',
    '"10 pieces, 10mg THC each."',
    '',
  ].join(',');
  return [header, example1, example2].join('\n') + '\n';
}
