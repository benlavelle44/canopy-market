import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Review queue for Learn articles drafted by the weekly content task (see
// the "learn-content-batch" scheduled task) -- nothing an automated batch
// writes goes live on its own. Same admin-check pattern as
// app/api/strains/photos/review/route.ts.

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

    const { data: drafts } = await admin
      .from('learn_articles')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: true });

    return NextResponse.json({ drafts: drafts || [] });
  } catch (err: any) {
    console.error('learn review GET error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

    const body = await req.json();
    const articleId: string = body?.articleId;
    const action: string = body?.action;
    if (!articleId || !['approve', 'discard'].includes(action)) {
      return NextResponse.json({ error: 'articleId and a valid action are required.' }, { status: 400 });
    }

    const { data: article } = await admin
      .from('learn_articles')
      .select('id, status')
      .eq('id', articleId)
      .eq('status', 'draft')
      .maybeSingle();
    if (!article) {
      return NextResponse.json({ error: 'That article is no longer pending review.' }, { status: 404 });
    }

    if (action === 'approve') {
      const { error } = await admin
        .from('learn_articles')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', articleId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from('learn_articles').delete().eq('id', articleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('learn review POST error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
