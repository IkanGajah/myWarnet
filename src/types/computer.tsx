export type Computer = {
  id: string;
  name: string;
  status: 'idle' | 'in_use' | 'offline';
  user_id?: string | null;
  session_end_time?: string | null;
  updated_at?: string | null;
};

export type UserAccount = {
  id: string;
  username: string;
  time_balance_seconds: number;
  created_at: string;
}