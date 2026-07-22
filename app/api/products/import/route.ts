import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { parseCmfCsv } from '@/lib/cmf';

export const runtime = 'nodejs';

// Bulk menu import built around the CMF-1 open CSV schema (see /cmf and
// lib/cmf.ts). A dispensary owner uploads one CSV export from their POS
// (or a hand-filled template) and it replaces their menu in one shot:
//   - rows whose "sku" matches an existing product update that row in place
//   - rows with a new sku (or no sku, matched instead on category+name) are
//     inserted as new products
//   - existing products with a sku that no longer appears in the file are
//     removed, so a re-export always reflects current reality
// strain_slug is resolved against the strains table so flower/preroll/vape
// listings link straight into the strain detail page.

const MAX_ROWS = 2000;

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const body = await req.json();
    const dispensaryId: string = body?.dispensaryId;
    const csv: string = body?.csv;
    if (!dispensaryId || !csv) {
      return NextResponse.json({ error: 'dispensaryId and csv are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: dispensary } = await admin
      .from('dispensaries')
      .select('id, owner_id')
      .eq('id', dispensaryId)
      .maybeSingle();

    if (!dispensary || dispensary.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const { rows, errors } = parseCmfCsv(csv);

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `File has ${rows.length} rows -- CMF-1 imports are capped at ${MAX_ROWS} per upload.` },
        { status: 400 }
      );
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in the file.', parseErrors: errors }, { status: 400 });
    }

    // Resolve strain_slug -> strain_id for every slug referenced in the file.
    const slugs = Array.from(new Set(rows.map((r) => r.strain_slug).filter((s): s is string => !!s)));
    let slugToId: Record<string, string> = {};
    if (slugs.length > 0) {
      const { data: strains } = await admin.from('strains').select('id, slug').in('slug', slugs);
      slugToId = Object.fromEntries((strains || []).map((s: any) => [s.slug, s.id]));
    }
    const unmatchedSlugs = slugs.filter((s) => !slugToId[s]);

    // Existing menu, so we know what to update vs. insert vs. retire.
    const { data: existing } = await admin
      .from('products')
      .select('id, sku, category, name')
      .eq('dispensary_id', dispensaryId);
    const bySku = new Map<string, any>();
    const byCategoryName = new Map<string, any>();
    for (const p of existing || []) {
      if (p.sku) bySku.set(p.sku, p);
      byCategoryName.set(`${p.category}::${p.name.toLowerCase()}`, p);
    }

    const seenIds = new Set<string>();
    let created = 0;
    let updated = 0;
    const rowErrors: { line: number; message: string }[] = [...errors];

    for (const row of rows) {
      const match = row.sku ? bySku.get(row.sku) : byCategoryName.get(`${row.category}::${row.name.toLowerCase()}`);
      const strainId = row.strain_slug ? slugToId[row.strain_slug] || null : null;

      const record = {
        dispensary_id: dispensaryId,
        category: row.category,
        name: row.name,
        brand: row.brand,
        strain_id: strainId,
        sku: row.sku,
        price: row.price,
        thc: row.thc,
        cbd: row.cbd,
        in_stock: row.in_stock,
        description: row.description,
        image_url: row.image_url,
      };

      if (match) {
        const { error } = await admin.from('products').update(record).eq('id', match.id);
        if (error) {
          rowErrors.push({ line: 0, message: `"${row.name}": ${error.message}` });
          continue;
        }
        seenIds.add(match.id);
        updated++;
      } else {
        const { data: inserted, error } = await admin.from('products').insert(record).select('id').single();
        if (error) {
          rowErrors.push({ line: 0, message: `"${row.name}": ${error.message}` });
          continue;
        }
        if (inserted) seenIds.add(inserted.id);
        created++;
      }
    }

    // Retire products that were in the menu before but didn't appear in this
    // file at all (only for products that have a sku -- without one we can't
    // safely tell "removed" from "renamed", so we leave name-matched rows
    // that got updated alone and don't touch unmatched no-sku products).
    const toRemove = (existing || []).filter((p) => p.sku && !seenIds.has(p.id));
    let removed = 0;
    if (toRemove.length > 0) {
      const { error } = await admin
        .from('products')
        .delete()
        .in('id', toRemove.map((p) => p.id));
      if (!error) removed = toRemove.length;
    }

    return NextResponse.json({
      created,
      updated,
      removed,
      totalRows: rows.length,
      unmatchedSlugs,
      parseErrors: rowErrors,
    });
  } catch (err: any) {
    console.error('CMF-1 import route error', err);
    return NextResponse.json({ error: 'Something went wrong processing that file.' }, { status: 500 });
  }
}
