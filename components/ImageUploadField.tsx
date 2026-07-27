'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

// A logo/banner upload that's actually seamless: pick a file, it uploads to
// Supabase Storage immediately, and the preview + saved value update the
// instant it's done -- no separate "now click Save" step for something this
// simple. Mirrors the same storage.upload()/getPublicUrl() pattern already
// used for community grow photos, just pointed at the dispensary-media
// bucket instead.
export default function ImageUploadField({
  label,
  currentUrl,
  dispensaryId,
  kind,
  shape = 'square',
  onUploaded,
}: {
  label: string;
  currentUrl: string | null;
  dispensaryId: string;
  kind: 'logo' | 'banner';
  shape?: 'square' | 'wide';
  onUploaded: (url: string) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('That image is over 8MB -- try a smaller file.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${dispensaryId}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('dispensary-media')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }
      const { data: pub } = supabase.storage.from('dispensary-media').getPublicUrl(path);
      onUploaded(pub.publicUrl);
    } catch (e) {
      setError('Upload failed -- try a smaller image or a different file.');
    }
    setUploading(false);
  };

  const previewClass = shape === 'wide' ? 'h-16 w-28' : 'h-16 w-16';

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-canopy-muted">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 overflow-hidden rounded-xl border border-canopy-border bg-canopy-bg ${previewClass}`}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-canopy-muted">
              None yet
            </div>
          )}
        </div>
        <label className="cursor-pointer rounded-full border border-canopy-border px-3 py-1.5 text-xs font-medium hover:border-canopy-green">
          {uploading ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
