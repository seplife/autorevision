import { describe, expect, it } from 'vitest';
import { readConfig } from '@/lib/env';

const KEY = 'eyJhbGciOiJIUzI1NiJ9.cle-publique-de-test';

describe('readConfig', () => {
  it('signale une configuration absente sans lever d’exception', () => {
    const cfg = readConfig({});
    expect(cfg.configured).toBe(false);
    if (!cfg.configured) expect(cfg.problems.length).toBeGreaterThan(0);
  });

  it('refuse les valeurs d’exemple de .env.example', () => {
    expect(readConfig({ VITE_SUPABASE_URL: 'https://votre-projet.supabase.co', VITE_SUPABASE_ANON_KEY: KEY }).configured).toBe(false);
    expect(
      readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiY3NhZGlnbGF4a2hrcHN1a3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MjUwNDUsImV4cCI6MjEwNzIwMTA0NX0.pG7CLvrwnO4PNEWNpdvgvKGPepVYq2odwcsO0AyOdH4' }).configured,
    ).toBe(false);
  });

  it('accepte une configuration valide et normalise les URL', () => {
    const cfg = readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: KEY }, 'http://localhost:5173/');
    expect(cfg).toEqual({
      configured: true,
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: KEY,
      appUrl: 'http://localhost:5173',
    });
  });
});
