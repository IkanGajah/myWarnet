'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Computer } from '@/types/computer';

export default function ClientPage() {
  // state untuk menyimpan daftar komputer, komputer yang dipilih, nama pengguna, dan status loading
  const [computers, setComputers] = useState<Computer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  // mengambil data komputer dari supabase
  useEffect(() => {
    let mounted = true;

    // fungsi untuk memuat data komputer
    async function load(){
      setLoading(true);
      const { data, error } = await supabase.from('computers').select('*').order('name');
      if (error) console.error(error);
      if (mounted) setComputers(data ?? []);
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
   
    return () => { mounted = false; supabase.removeChannel(channel);};
  }, []);

  // dijalankan saat tombol untuk mulai sesi diklik
  async function startSession() {
    if (!selected || !name) return alert('Pilih komputer dan masukkan nama dengan benar!');
    
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
      .update({ status: 'in_use', user_name: name, start_time: new Date().toISOString(), updated_at: new Date().toISOString() })
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
      .update({ status: 'idle', user_name: null, start_time: null, updated_at: new Date().toISOString() })
      .eq('id', selected);
    if (error) return alert('Gagal stop: ' + error.message);
    alert('Sesi selesai.');
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

          <div className="flex gap-3">
            <button onClick={startSession} className="px-4 py-2 bg-green-600 text-white rounded">Mulai Pake</button>
            <button onClick={endSession} className="px-4 py-2 bg-red-600 text-white rounded">Selesai Pake</button>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        Pastikan untuk memasukkan nama dan komputer yang berbeda. <br />
        Untuk menghentikan sesi, gunakan nama yang sama saat memulai sesi.
      </div>
    </div>
  );
}
