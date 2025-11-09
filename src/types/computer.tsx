export type Computer = {
  id: string;
  name: string;
  status: 'idle' | 'in_use' | 'offline';
  user_name?: string | null;
  start_time?: string | null;
  updated_at?: string | null;
};