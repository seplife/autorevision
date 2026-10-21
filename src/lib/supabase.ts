import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from './env';

let client: SupabaseClient | null = null;

/**
 * Client Supabase unique, créé avec la clé PUBLIQUE uniquement.
 * Lève une erreur explicite si la configuration est absente : aucun faux backend.
 */
export function getSupabase(): SupabaseClient {
  if (!appConfig.configured) {
    throw new Error('Supabase n’est pas configuré (voir .env.example).');
  }
  if (!client) {
    client = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}
