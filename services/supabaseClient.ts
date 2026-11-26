import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const testSupabaseConnection = async (): Promise<{ ok: boolean; message: string }> => {
  if (!supabase) {
    return { ok: false, message: 'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no configuradas.' };
  }
  try {
    const { error } = await supabase.from('business_settings').select('id').limit(1);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Conectado correctamente a Supabase PostgreSQL.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Error de red al conectar con Supabase.' };
  }
};
