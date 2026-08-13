import { Suspense } from 'react';
import AdminMerchClient from './AdminMerchClient';

export const metadata = {
  title: 'Merch Sync — Canopy Market',
};

export default function AdminMerchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <AdminMerchClient />
    </Suspense>
  );
}
