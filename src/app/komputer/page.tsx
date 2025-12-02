'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Computer, UserAccount } from '@/types/computer';

export default function ClientPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedComputerId, setSelectedComputerId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(){
      setLoading(true);
      const { data: compData, error: compError } = await supabase.from('computers').select('*').order('name');
      const { data: userData, error: userError } = await supabase.from('users').select('*').order('username');
      if (compError) console.error("Error load computers:", compError);
      if (userError) console.error("Error load users:", userError);
      
      setComputers(compData ?? []);
      setUsers(userData ?? []);
      setLoading(false);
    }

  useEffect(() => {    
    load();
    const channel = supabase.channel('computers-realtime-client')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'computers' }, 
        (payload) => {
          console.log('Perubahan terdeteksi di client (komputer):', payload);
          load();
        }
      )
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'users' }, 
        (payload) => {
          console.log('Perubahan terdeteksi di client (user):', payload);
          load();
        }
      )
      .subscribe();
   
    return () => { supabase.removeChannel(channel);};
  }, []);

  async function startSession() {
    if (!selectedComputerId || !selectedUserId) return alert('Pilih komputer dan pengguna!');
    
    const user = users.find(u => u.id === selectedUserId);
    if (!user || user.time_balance_seconds <= 0) return alert('Saldo waktu pengguna tidak mencukupi!');

    const { data: computer, error: compCheckError } = await supabase
      .from("computers")
      .select("status")
      .eq("id", selectedComputerId)
      .single();

    if (compCheckError || !computer) return alert("Gagal cek status komputer.");

    if (computer.status === "in_use") return alert("Komputer ini sedang digunakan!");

    try {
      const { data: activeSession, error: activeSessionError } = await supabase
        .from('computers')
        .select('id, name') 
        .eq('user_id', selectedUserId)
        .eq('status', 'in_use')
        .maybeSingle(); 

      if (activeSessionError) {
        throw new Error('Gagal memvalidasi sesi pengguna: ' + activeSessionError.message);
      }

      if (activeSession) {
        return alert(`Pengguna ini sudah tercatat aktif di komputer "${activeSession.name}"! Selesaikan sesi di sana terlebih dahulu.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        return alert(error.message);
      }
      return alert("Terjadi error yang tidak diketahui saat validasi sesi.");
    }
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + user.time_balance_seconds * 1000);

    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        computer_id: selectedComputerId,
        user_id: selectedUserId,
        start_time: startTime.toISOString(),
        end_time: null
      });

    if (sessionError) return alert("Gagal memulai log sesi: " + sessionError.message);

    const { error:compError } = await supabase
      .from('computers')
      .update({ 
        status: 'in_use', 
        user_id: user.id, 
        session_end_time: endTime.toISOString(), 
        updated_at: new Date().toISOString() })
      .eq('id', selectedComputerId);
    if (compError) return alert('Gagal start komputer: ' + compError.message);

    const { error: userError } = await supabase
      .from('users')
      .update({ time_balance_seconds: 0 })
      .eq('id', user.id);
    if (userError) return alert('Gagal update saldo: ' + userError.message);
    load();
    alert('Sesi dimulai.');
  }

  async function endSession() {
    if (!selectedComputerId || !selectedUserId) return alert('Pilih komputer dan pengguna! yang sesuai');
    const { data: computer, error: compFetchError } = await supabase
      .from('computers')
      .select('*')
      .eq('id', selectedComputerId)
      .single();

    if (compFetchError || !computer) return alert('Komputer tidak ditemukan');
    if (computer.user_id !== selectedUserId) return alert('Pengguna yang dipilih tidak sesuai dengan sesi yang sedang berjalan di komputer ini!');

    let remainingSeconds = 0;
    if (computer.session_end_time) {
      const remainingMillis = new Date(computer.session_end_time).getTime() - Date.now();
      remainingSeconds = Math.max(0, Math.floor(remainingMillis / 1000));
    }

    const { error } = await supabase
      .from('computers')
      .update({ status: 'idle', user_id: null, session_end_time: null, updated_at: new Date().toISOString() })
      .eq('id', selectedComputerId);
    if (error) return alert('Gagal stop: ' + error.message);

    await supabase
      .from('sessions')
      .update({ end_time: new Date().toISOString() })
      .eq('computer_id', selectedComputerId)
      .eq('user_id', selectedUserId)
      .is('end_time', null);

    if (remainingSeconds > 0) {
       const { error: refundError } = await supabase.rpc('add_to_balance', {
          user_id_input: selectedUserId,
          seconds_to_add: remainingSeconds
      });
      if (refundError) alert('Gagal mengembalikan sisa waktu: ' + refundError.message);
    }
    load();
    alert('Sesi selesai. Terima kasih!');
  }

  const formatUserBalance = (seconds: number) => {
    if (seconds <= 0) return "0 Menit";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    let str = "";
    if (h > 0) str += `${h} Jam `;
    if (m > 0) str += `${m} Menit`;
    return str;
  }

  return (
    <div className="bg-gray-100 p-6 rounded shadow-md max-w-8xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Pakai komputer</h2>

      {loading ? <p>Loading...</p> : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm">Pilih Komputer</label>
            <select
              value={selectedComputerId ?? ''} 
              onChange={(e) => setSelectedComputerId(e.target.value)} 
              className="border p-2 rounded w-full bg-white"
            >
              <option value="">- Pilih -</option>
              {computers.map(c => (
                <option key={c.id} value={c.id} disabled={c.status !== 'idle' && !users.some(u => u.id === c.user_id)}>
                  {c.name} - status: {c.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm">Nama Pengguna</label>
            <select 
              value={selectedUserId ?? ''} 
              onChange={(e) => setSelectedUserId(e.target.value)} 
              className="border p-2 rounded w-full bg-white"
            >
              <option value="">- Pilih Pengguna -</option>
              {users.map(u => (
                <option 
                  key={u.id} 
                  value={u.id} 
                  disabled={u.time_balance_seconds <= 0 && !computers.some(c => c.user_id === u.id)}
                >
                  {u.username} (Sisa waktu: {formatUserBalance(u.time_balance_seconds)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button onClick={startSession} className="px-4 py-2 bg-green-600 text-white rounded cursor-pointer">Mulai Pakai</button>
            <button onClick={endSession} className="px-4 py-2 bg-red-600 text-white rounded cursor-pointer">Selesai Pakai</button>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        Pastikan untuk memilih komputer yang tersedia (idle) dan pengguna yang memiliki sisa waktu. <br />
        Untuk menghentikan sesi, gunakan komputer dan pengguna yang sama saat memulai sesi.
      </div>
    </div>
  );
}
