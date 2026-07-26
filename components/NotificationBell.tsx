'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { Notification } from '@/lib/types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// Closes the loop on every async approval flow in the app (strain finder
// verification, grow photo verification, dispensary owner replies) --
// before this, a user had no way to know any of that happened short of
// manually revisiting the page.
export default function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-canopy-muted hover:bg-canopy-card hover:text-canopy-text"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-canopy-green px-1 text-[10px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-canopy-border bg-canopy-panel shadow-glow">
          <div className="flex items-center justify-between border-b border-canopy-border px-4 py-2.5">
            <span className="text-sm font-semibold text-canopy-text">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-canopy-green hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-canopy-muted">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-canopy-muted">Nothing yet.</p>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`border-b border-canopy-border px-4 py-3 text-sm transition hover:bg-canopy-card ${
                      !n.read ? 'bg-canopy-green/5' : ''
                    }`}
                  >
                    <div className="mb-0.5 flex items-start justify-between gap-2">
                      <span className={`font-medium ${!n.read ? 'text-canopy-text' : 'text-canopy-muted'}`}>
                        {n.title}
                      </span>
                      {!n.read && <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-canopy-green" />}
                    </div>
                    {n.body && <p className="mb-1 text-xs text-canopy-muted">{n.body}</p>}
                    <p className="text-[11px] text-canopy-muted">{timeAgo(n.created_at)}</p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => markRead(n.id)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => markRead(n.id)} className="cursor-pointer">
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
