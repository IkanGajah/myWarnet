'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Computer } from '@/types/computer';

// format duration dari waktu mulai hingga sekarang
function formatDuration(startIso?: string | null) {
  if (!startIso) return '00:00:00';
  const start = new Date(startIso).getTime();
  const diff = Math.max(0, Date.now() - start);
  const sec = Math.floor(diff / 1000);
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// format remaining countdown time
function formatCountdown(startIso?: string | null, countdownSeconds?: number | null) {
  if (!startIso || !countdownSeconds) return '00:00:00';
  const elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const remaining = Math.max(0, countdownSeconds - elapsed);
  const h = Math.floor(remaining / 3600).toString().padStart(2, '0');
  const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function AdminPage() {
  // state untuk menyimpan daftar komputer, komputer yang dipilih, nama pengguna, dan status loading
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // mengambil data komputer dari supabase
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from('computers').select('*').order('name');
      if (error) console.error(error);
      if (mounted) setComputers(data ?? []);
      setLoading(false);
    }
    load();


    const channel = supabase.channel('public:computers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'computers' },
        (payload) => {
          const ev = payload.eventType;
          const newRow = payload.new as Computer | null;
          const oldRow = payload.old as Computer | null;
          setComputers(prev => {
            if (ev === 'INSERT') return [...prev, newRow!];
            if (ev === 'UPDATE') return prev.map(p => p.id === newRow!.id ? newRow! : p);
            if (ev === 'DELETE') return prev.filter(p => p.id !== oldRow!.id);
            return prev;
          });
        }
      )
      .subscribe();


    intervalRef.current = window.setInterval(() => {
      setComputers(prev => [...prev]);
    }, 1000);

    return () => {
      mounted = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  async function stopSession(id: string) {
    console.log("Stopping PC with id:", id); 

    const { error } = await supabase
      .from("computers")
      .update({
        status: "idle",
        user_name: null,
        start_time: null,
        countdown_seconds: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", JSON.stringify(error, null, 2)); 
    } else {
      console.log("PC stopped successfully ✅");
    }
  }


  return (
    <div className="bg-gray-100 p-6 rounded shadow-md max-w-8xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Operator Komputer</h2>

      {loading ? <p>Loading...</p> : (
        <div className="grid gap-3">
          {computers.map(c => (
            <div key={c.id} className="bg-white p-3 rounded shadow flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.name} <span className="text-sm text-gray-500">({c.status})</span></div>
                <div className="text-sm">{c.user_name ? `Nama user: ${c.user_name}` : 'Tidak ada pengguna'}</div>
                <div className="text-sm text-gray-600">Waktu mulai: {c.start_time ? new Date(c.start_time).toLocaleString() : '-'}</div>
              </div>

              <div className="text-right">
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">Waktu Penggunaan</div>
                  <div className="font-mono text-lg">{formatDuration(c.start_time)}</div>
                </div>
                {c.countdown_seconds && (
                  <div className="mb-2">
                    <div className="text-xs text-gray-500 mb-1">Waktu Tersisa</div>
                    <div className="font-mono text-lg font-bold text-blue-600">{formatCountdown(c.start_time, c.countdown_seconds)}</div>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => stopSession(c.id)} className="px-3 py-1 bg-red-600 text-white rounded">Paksa berhenti</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
