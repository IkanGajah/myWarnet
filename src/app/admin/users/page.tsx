'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Computer, UserAccount } from '@/types/computer'; 

// Fungsi helper untuk menambah waktu (jam ke detik)
const addHoursInSeconds = (hours: number) => hours * 3600;

// Fungsi helper untuk format detik ke H:M:S
function formatSecondsToHMS(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getRemainingSeconds(endIso?: string | null): number {
  if (!endIso) return 0;
  
  const end = new Date(endIso).getTime();
  const diff = Math.max(0, end - Date.now()); // Selisih dalam milidetik
  
  return Math.floor(diff / 1000); // Kembalikan dalam detik
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Load semua pengguna
  async function load() {
    try {
      const [userResponse, compResponse] = await Promise.all([
        supabase.from('users').select('*').order('username'),
        supabase.from('computers').select('*') // Kita perlu data komputer
      ]);

      const { data: userData, error: userError } = userResponse;
      const { data: compData, error: compError } = compResponse;

      if (userError) console.error("Gagal load users:", userError);
      if (compError) console.error("Gagal load computers:", compError);

      setUsers(userData ?? []);
      setComputers(compData ?? []);
      
    } catch (error) {
      console.error("Gagal load data:", error);
    } finally {
      setLoading(false); // Set loading false hanya di akhir
    }
  }

  useEffect(() => {
    load();

    // Subscribe ke perubahan tabel users
    const userChannel = supabase.channel('public:users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          console.log('Perubahan terdeteksi di client (users):', payload);
          load();
        }
      )
      .subscribe();

    const compChannel = supabase.channel('public:computers')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'computers' },
          (payload) => {
            console.log('Perubahan terdeteksi di client (komputer):', payload);
            load();
          }
        )
        .subscribe();

    intervalRef.current = window.setInterval(() => {
      // Kita hanya perlu memicu re-render.
      // Cara sederhana: update state computers ke nilai yg sama.
      setComputers(prev => [...prev]);
    }, 1000);
    
    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(compChannel);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };

  }, []);

  // Fitur 1: Tambah User
  async function handleAddUser() {
    if (!newUsername) return alert('Nama user tidak boleh kosong');
    
    const { error } = await supabase
      .from('users')
      .insert({ username: newUsername, time_balance_seconds: 0 }); // Saldo awal 0
      
    if (error) {
      alert('Gagal menambah user: ' + error.message);
    } else {
      setNewUsername('');
      load(); 
    }
  }

  // Fitur 2: Hapus User
  async function handleDeleteUser(userId: string) {
    if (confirm('Yakin ingin menghapus user ini? Sesi aktif mereka mungkin error.')) {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) alert('Gagal hapus: ' + error.message);
      else load(); 
    }
  }

  async function handleEditUsername(userId: string, newUsername: string) {
    const { error } = await supabase
      .from('users')
      .update({ username: newUsername })
      .eq('id', userId);
    if (error) alert('Gagal update username: ' + error.message);
    else load();
  }

  // Fitur 3: Tambah Waktu ke User
  async function handleAddTime(userId: string, hours: number) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const secondsToAdd = addHoursInSeconds(hours);
    
    // buat RPC function di Supabase
    const { error } = await supabase.rpc('add_to_balance', {
        user_id_input: userId,
        seconds_to_add: secondsToAdd
    });
      
    if (error) alert('Gagal menambah waktu: ' + error.message);
    else load();
  }

  const getUserTotalBalance = (user: UserAccount): number => {
    // 1. Ambil saldo "dompet" (dari tabel users)
    const walletBalance = user.time_balance_seconds || 0;

    // 2. Cari sesi aktif pengguna ini
    const activeComputer = computers.find(
      c => c.user_id === user.id && c.status === 'in_use'
    );

    // 3. Hitung sisa waktu sesi (jika ada)
    const sessionBalance = getRemainingSeconds(activeComputer?.session_end_time);

    // 4. Jumlahkan keduanya
    return walletBalance + sessionBalance;
  };

  return (
    <div className="bg-gray-100 p-6 rounded shadow-md max-w-8xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Manajemen Pengguna</h2>

      {loading ? <p>Loading...</p> : (
        <div>
            <div className="mb-6 flex gap-2 p-4 bg-white rounded shadow">
                <input 
                className="border p-2 rounded w-full bg-white"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Nama pengguna baru..."
                />
                <button 
                onClick={handleAddUser} 
                className="px-4 py-2 bg-blue-600 text-white rounded whitespace-nowrap cursor-pointer"
                >
                Tambah User
                </button>
            </div>

            <div className="grid gap-3">
                {users.length === 0 && <p>Belum ada pengguna terdaftar.</p>}
                {users.map(user => {
                    const totalBalance = getUserTotalBalance(user);
                    const isActive = computers.some(c => c.user_id === user.id && c.status === 'in_use');
                    return (
                    <div key={user.id} className={`bg-white p-3 rounded shadow ${isActive ? 'border-l-4 border-green-500' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-lg">{user.username}</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleDeleteUser(user.id)} 
                                    className="px-2 py-1 bg-red-600 text-white rounded text-sm cursor-pointer"
                                >
                                    Hapus
                                </button>
                                <button 
                                    onClick={() => handleEditUsername(user.id, prompt('Masukkan nama pengguna baru:', user.username) || user.username)} 
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-sm cursor-pointer"
                                >
                                    Edit Nama
                                </button>
                            </div> 
                        </div>
                        
                        <div className="text-sm text-gray-700 mb-3">
                        Saldo Waktu: <span className="font-mono font-bold">{formatSecondsToHMS(totalBalance)}</span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                        <span className="text-sm self-center">Tambah Waktu:</span>
                        <button onClick={() => handleAddTime(user.id, 1)} className="px-3 py-1 bg-green-600 text-white rounded text-sm cursor-pointer">+ 1 Jam</button>
                        <button onClick={() => handleAddTime(user.id, 3)} className="px-3 py-1 bg-green-600 text-white rounded text-sm cursor-pointer">+ 3 Jam</button>
                        <button onClick={() => handleAddTime(user.id, 5)} className="px-3 py-1 bg-green-600 text-white rounded text-sm cursor-pointer">+ 5 Jam</button>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
      )}
    </div>
  );
}