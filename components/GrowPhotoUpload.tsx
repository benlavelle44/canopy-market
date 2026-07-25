'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { GROW_STAGES, GrowStage } from '@/lib/types';

// Lets any signed-in shopper or grower submit a real photo of the actual
// plant -- this is the "who's really growing Bruce Banner well right now"
// feature. Uploads straight to Supabase Storage (RLS-gated to authenticated
// users) then inserts a `pending` row; nothing shows publicly until an admin
// verifies it, so this can't be used to post anything unmoderated.
export default function GrowPhotoUpload({
  strainId,
  onSubmitted,
}: {
  strainId: string;
  onSubmitted?: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<GrowStage>('pre-harvest');
  const [creditName, setCreditName] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!file) {
      setNotice('Choose a photo first.');
      return;
    }
    setSubmitting(true);
    setNotice('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setNotice('Your session expired -- sign in again.');
        setSubmitting(false);
        return;
      }
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${strainId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('strain-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) {
        setNotice(uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from('strain-photos').getPublicUrl(path);
      const { error: insertError } = await supabase.from('strain_photos').insert({
        strain_id: strainId,
        submitted_by: userId,
        image_url: pub.publicUrl,
        grow_stage: stage,
        caption: caption.trim() || null,
        credit_name: creditName.trim() || null,
      });
      if (insertError) {
        setNotice(insertError.message);
        setSubmitting(false);
        return;
      }
      setNotice('Submitted! It will show up once an admin verifies it -- you will earn +15 points then.');
      setFile(null);
      setCaption('');
      setCreditName('');
      setSubmitting(false);
      onSubmitted?.();
    } catch (e) {
      setNotice('Something went wrong uploading that photo.');
      setSubmitting(false);
    }
  };

  if (signedIn === false) {
    return (
      <p className="text-xs text-canopy-muted">
        <a href="/login" className="text-canopy-green hover:underline">
          Sign in
        </a>{' '}
        to submit a real grow photo of this strain.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-canopy-green/40 bg-canopy-green/10 px-3 py-1.5 text-xs font-medium text-canopy-green hover:bg-canopy-green/20"
      >
        📷 Submit a grow photo (+15 pts once verified)
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-canopy-border bg-canopy-card p-4">
      <p className="mb-3 text-xs text-canopy-muted">
        Got a real photo of this exact strain -- growing, pre-harvest, or a finished bud? Add it here. Verified
        submissions get credited to you and earn points.
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-3 block w-full text-xs text-canopy-muted file:mr-3 file:rounded-full file:border-0 file:bg-canopy-green file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {GROW_STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStage(s.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              stage === s.id
                ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                : 'border-canopy-border text-canopy-muted hover:border-canopy-green/50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        value={creditName}
        onChange={(e) => setCreditName(e.target.value)}
        placeholder="Grower / farm name (optional)"
        className="mb-2 w-full rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-xs focus:border-canopy-green focus:outline-none"
      />
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption (optional)"
        className="mb-3 w-full rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-xs focus:border-canopy-green focus:outline-none"
      />
      {notice && <p className="mb-2 text-xs text-canopy-green">{notice}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-full bg-canopy-green px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          {submitting ? 'Uploading…' : 'Submit for review'}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="rounded-full border border-canopy-border px-4 py-2 text-xs font-medium hover:border-canopy-green disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
