'use client';

import { generateCmfTemplate } from '@/lib/cmf';

export default function DownloadCmfTemplateButton({ className }: { className?: string }) {
  const download = () => {
    const csv = generateCmfTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cmf-1-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={download}
      className={
        className ||
        'btn-glow rounded-full bg-gradient-to-r from-canopy-green to-canopy-lime px-5 py-2.5 text-sm font-semibold text-black'
      }
    >
      Download CMF-1 template (.csv)
    </button>
  );
}
