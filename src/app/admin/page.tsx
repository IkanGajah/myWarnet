'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Computer, UserAccount } from '@/types/computer';

function formatRemainingTime(endIso?: string | null) {
  if (!endIso) return '00:00:00';
  const end = new Date(endIso).getTime();
  const diff = Math.max(0, end - Date.now());
  const sec = Math.floor(diff / 1000);
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function AdminPage() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [users, setUsers] = useState<Map<string, UserAccount>>(new Map());
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [compResponse, userResponse] = await Promise.all([
          supabase.from('computers').select('*').order('name'),
          supabase.from('users').select('*')
        ]);

        const { data: compData, error: compError } = compResponse;
        const { data: userData, error: userError } = userResponse;

        if (compError) console.error("Error load komputer: ", compError);
        if (userError) console.error("Error load user: ", userError);

        if (mounted) {
          setComputers(compData ?? [])
          const userMap = new Map<string, UserAccount>();
          (userData ?? []).forEach(u => userMap.set(u.id, u));
          setUsers(userMap);
          setComputers(compData ?? []);
        };
      } catch (error) {
      console.error("Gagal memuat data:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    load();


    const computersChannel = supabase.channel('public:computers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'computers' },
        (payload) => {
          console.log('Perubahan terdeteksi di client (komputer):', payload);
          load();
        }
      )
      .subscribe();

    const usersChannel = supabase.channel('public:users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          console.log('Perubahan terdeteksi di client (user):', payload);
          load();
        }
      )
      .subscribe();


    intervalRef.current = window.setInterval(() => {
      setComputers(prev => { 
        const now = Date.now();
        prev.forEach(c => {
          if (c.status === 'in_use' && c.session_end_time) {
            const endTime = new Date(c.session_end_time).getTime();
            if (now >= endTime) {
              console.log(`Waktu ${c.name} telah habis, menghentikan...`);
              supabase
                .from("computers") 
                .update({ status: "idle", user_id: null, session_end_time: null })
                .eq("id", c.id)
                .then();
            }
          }
        });
        return [...prev]
      });
    }, 1000);

    return () => {
      mounted = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      supabase.removeChannel(computersChannel);
      supabase.removeChannel(usersChannel);
    };
  }, []);

  async function stopSession(computerId: string) {
    console.log("Stopping PC with id:", computerId); 

    const computer = computers.find(c => c.id === computerId);

    let remainingSeconds = 0;
    if (computer && computer.user_id && computer.session_end_time) {
      const remainingMillis = new Date(computer.session_end_time).getTime() - Date.now();
      remainingSeconds = Math.max(0, Math.floor(remainingMillis / 1000));
    }

    const { error: stopError } = await supabase
      .from("computers")
      .update({
        status: "idle",
        user_id: null,
        session_end_time: null,
      })
      .eq("id", computerId);

    if (stopError) {
      console.error("Supabase stop error:", stopError); 
      alert("Gagal menghentikan PC: " + stopError.message);
      return;
    } 
    
    if (remainingSeconds > 0 && computer && computer.user_id) {
      console.log(`Mengembalikan ${remainingSeconds} detik ke user ${computer.user_id}`);
      const { error: refundError } = await supabase.rpc('add_to_balance', {
          user_id_input: computer.user_id,
          seconds_to_add: remainingSeconds
      });
      if (refundError) {
        console.error("Supabase refund error:", refundError);
        alert("Sesi dihentikan, tapi GAGAL mengembalikan sisa waktu: " + refundError.message);
      }
    }

    await supabase
      .from('sessions')
      .update({ end_time: new Date().toISOString() })
      .eq('computer_id', computerId)
      .is('end_time', null);

    console.log("PC stopped successfully");
  }

  const getUsername = (userId: string | null | undefined) => {
    if (!userId) return '...';
    return users.get(userId)?.username ?? 'User (Unknown)';
  };

  return (
    <div className="bg-gray-100 p-6 rounded shadow-md max-w-8xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Manajemen Komputer</h2>

      {loading ? <p>Loading...</p> : (
        <div className="grid gap-3">
          {computers.map(c => (
            <div key={c.id} className={`bg-white p-3 rounded shadow flex items-center justify-between ${c.status === 'in_use' ? 'border-l-4 border-green-500' : ''}`}>
              <div>
                <div className="font-semibold">{c.name} <span className="text-sm text-gray-500">({c.status})</span></div>
                <div className="text-sm">
                  {c.status === 'in_use' ? 'Nama User: ' + getUsername(c.user_id) : 'Tidak ada pengguna'}
                </div>
                <div className="text-sm text-gray-600">Sesi berakhir: {c.session_end_time ? new Date(c.session_end_time).toLocaleString() : '-'}</div>
              </div>

              <div className="text-right">
                <div className="font-mono text-lg mb-2">{formatRemainingTime(c.session_end_time)}</div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => stopSession(c.id)} className="px-3 py-1 bg-red-600 text-white rounded cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={c.status !== 'in_use'}>Paksa berhenti</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
