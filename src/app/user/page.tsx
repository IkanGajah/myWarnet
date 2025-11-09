'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Computer } from '@/types/computer';

export default function ClientPage() {
  // state untuk menyimpan daftar komputer, komputer yang dipilih, nama pengguna, dan status loading
  const [computers, setComputers] = useState<Computer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editableCountdown, setEditableCountdown] = useState(3600);
  const [remainingTime, setRemainingTime] = useState<Record<string, number>>({});
  const intervalRef = useRef<number | null>(null);

  // mengambil data komputer dari supabase
  useEffect(() => {
    let mounted = true;

    // fungsi untuk memuat data komputer
    async function load(){
      setLoading(true);
      const { data, error } = await supabase.from('computers').select('*').order('name');
      if (error) console.error(error);
      if (mounted) {
        setComputers(data ?? []);
        // Initialize remaining time for each computer
        const newRemaining: Record<string, number> = {};
        (data ?? []).forEach(c => {
          if (c.status === 'in_use' && c.start_time && c.countdown_seconds) {
            const elapsed = Math.floor((Date.now() - new Date(c.start_time).getTime()) / 1000);
            newRemaining[c.id] = Math.max(0, c.countdown_seconds - elapsed);
          }
        });
        setRemainingTime(newRemaining);
      }
      setLoading(false);
    }
    load();

    // subscribe ke perubahan realtime di tabel computers
    const channel = supabase.channel('computers-realtime-client')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'computers' }, 
        (payload) => {
          console.log('Perubahan terdeteksi di client:', payload);
          load();
        }
      )
      .subscribe();

    // Set up interval to update countdown timers
    intervalRef.current = window.setInterval(() => {
      setComputers(prev => {
        const newRemaining: Record<string, number> = {};
        prev.forEach(c => {
          if (c.status === 'in_use' && c.start_time && c.countdown_seconds) {
            const elapsed = Math.floor((Date.now() - new Date(c.start_time).getTime()) / 1000);
            newRemaining[c.id] = Math.max(0, c.countdown_seconds - elapsed);
          }
        });
        setRemainingTime(newRemaining);
        return prev;
      });
    }, 1000);
   
    return () => { 
      mounted = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  // dijalankan saat tombol untuk mulai sesi diklik
  async function startSession() {
    if (!selected || !name) return alert('Pilih komputer dan masukkan nama dengan benar!');
    if (editableCountdown <= 0) return alert('Durasi countdown harus lebih dari 0!');
    
    const { data: computer } = await supabase
      .from("computers")
      .select("*")
      .eq("name", computers.find(c => c.id === selected)?.name)
      .single();

    if (computer?.status === "in_use") {
      alert("Komputer ini sedang digunakan!");
      return;
    }

    if (computers.some(c => c.user_name === name && c.status === 'in_use')) {
      alert("Nama pengguna sudah digunakan!");
      return;
    }
    
    const { error } = await supabase
      .from('computers')
      .update({ 
        status: 'in_use', 
        user_name: name, 
        start_time: new Date().toISOString(), 
        countdown_seconds: editableCountdown,
        updated_at: new Date().toISOString() 
      })
      .eq('id', selected);
    if (error) return alert('Gagal start: ' + error.message);
    alert('Sesi dimulai.');
  }

  // dijalankan saat tombol untuk akhiri sesi diklik
  async function endSession() {
    if (!selected) return;
    const { data } = await supabase.from('computers').select('*').eq('id', selected).single();
    if (data) {
      await supabase.from('sessions').insert({
        computer_id: selected,
        user_name: data.user_name,
        start_time: data.start_time,
        end_time: new Date().toISOString()
      });
    }

    if (computers.some(c => c.user_name !== name && c.status === 'in_use')) {
      alert("Nama pengguna harus sesuai dengan yang sudah digunakan!");
      return;
    }

    const { error } = await supabase
      .from('computers')
      .update({ status: 'idle', user_name: null, start_time: null, countdown_seconds: null, updated_at: new Date().toISOString() })
      .eq('id', selected);
    if (error) return alert('Gagal stop: ' + error.message);
    alert('Sesi selesai.');
  }

  // Format seconds to HH:MM:SS
  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // interface pengguna
  return (
    <div className="bg-gray-100 p-6 rounded shadow-md max-w-8xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Pake komputer</h2>

      {loading ? <p>Loading...</p> : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm">Pilih Komputer</label>
            <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} className="border p-2 rounded w-full bg-white">
              <option value="">- Pilih -</option>
              {computers.map(c => (
                <option key={c.id} value={c.id}>{c.name} - status: {c.status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm">Nama Pengguna</label>
            <input className="border p-2 rounded w-full bg-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama..." />
          </div>

          <div>
            <label className="block text-sm">Durasi Countdown (detik)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={editableCountdown}
                onChange={(e) => setEditableCountdown(Math.max(1, parseInt(e.target.value) || 0))}
                className="border p-2 rounded flex-1 bg-white"
                placeholder="Masukkan durasi dalam detik..."
                disabled={!!(selected && computers.find(c => c.id === selected)?.status === 'in_use')}
              />
              <span className="flex items-center font-mono text-lg font-semibold px-3 py-2 bg-white rounded border">
                {formatTime(editableCountdown)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={startSession} className="px-4 py-2 bg-green-600 text-white rounded">Mulai Pake</button>
            <button onClick={endSession} className="px-4 py-2 bg-red-600 text-white rounded">Selesai Pake</button>
          </div>

          {selected && (
            <div className="mt-4 p-4 bg-white rounded border">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Waktu Tersisa</p>
                <p className="font-mono text-4xl font-bold">
                  {formatTime(remainingTime[selected] ?? (computers.find(c => c.id === selected)?.countdown_seconds ?? editableCountdown))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        Pastikan untuk memasukkan nama dan komputer yang berbeda. <br />
        Untuk menghentikan sesi, gunakan nama yang sama saat memulai sesi.
      </div>
    </div>
  );
}
