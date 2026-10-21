import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/, message: 'VITE_SUPABASE_URL doit être une URL http(s).' }),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'VITE_SUPABASE_ANON_KEY est manquante ou trop courte.')
    .refine((v) => !/remplacez/i.test(v), 'VITE_SUPABASE_ANON_KEY contient encore la valeur d’exemple.'),
  VITE_APP_URL: z.url().optional(),
});

export type AppConfig =
  | { configured: true; supabaseUrl: string; supabaseAnonKey: string; appUrl: string }
  | { configured: false; problems: string[] };

/**
 * Lit et valide la configuration. Ne lève jamais d'exception : en cas de problème,
 * l'application affiche un écran « Configuration requise » au lieu de simuler un backend.
 */
export function readConfig(raw: Record<string, unknown>, fallbackOrigin?: string): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    return { configured: false, problems: parsed.error.issues.map((i) => i.message) };
  }
  const url = parsed.data.VITE_SUPABASE_URL.replace(/\/+$/, '');
  if (/votre-projet/.test(url)) {
    return { configured: false, problems: ['VITE_SUPABASE_URL contient encore la valeur d’exemple.'] };
  }
  return {
    configured: true,
    supabaseUrl: url,
    supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
    appUrl: (parsed.data.VITE_APP_URL ?? fallbackOrigin ?? '').replace(/\/+$/, ''),
  };
}

const DEFAULT_ENV: Record<string, unknown> = {
  VITE_SUPABASE_URL: 'https://hynxhnjktexeylrtmixa.supabase.co',
  VITE_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bnhobmprdGV4ZXlscnRtaXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTM4MjUsImV4cCI6MjEwODA2OTgyNX0.ailGspt8lokPHIzg5hyXXv-eYjEEEFSOAIJjCKhdfAM',
};

const rawEnv = import.meta.env as unknown as Record<string, unknown>;

export const appConfig: AppConfig = readConfig(
  {
    ...DEFAULT_ENV,
    ...(rawEnv.VITE_SUPABASE_URL ? { VITE_SUPABASE_URL: rawEnv.VITE_SUPABASE_URL } : {}),
    ...(rawEnv.VITE_SUPABASE_ANON_KEY ? { VITE_SUPABASE_ANON_KEY: rawEnv.VITE_SUPABASE_ANON_KEY } : {}),
    ...(rawEnv.VITE_APP_URL ? { VITE_APP_URL: rawEnv.VITE_APP_URL } : {}),
  },
  typeof window !== 'undefined' ? window.location.origin : undefined,
);
