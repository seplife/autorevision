import { describe, expect, it, vi } from 'vitest';
import { deriveStatus, nextProbeDelay, probeServer } from '@/features/connectivite/connectivity';

describe('deriveStatus', () => {
  it('ne considère jamais « réseau détecté » comme « serveur joignable »', () => {
    expect(deriveStatus({ configured: true, browserOnline: true, probe: 'inconnu' })).toBe('verification');
    expect(deriveStatus({ configured: true, browserOnline: true, probe: 'en_cours' })).toBe('verification');
    expect(deriveStatus({ configured: true, browserOnline: true, probe: 'injoignable' })).toBe('serveur_injoignable');
    expect(deriveStatus({ configured: true, browserOnline: true, probe: 'joignable' })).toBe('en_ligne');
  });
  it('hors ligne et non configuré priment', () => {
    expect(deriveStatus({ configured: true, browserOnline: false, probe: 'joignable' })).toBe('hors_ligne');
    expect(deriveStatus({ configured: false, browserOnline: true, probe: 'joignable' })).toBe('non_configure');
  });
});

describe('probeServer', () => {
  it('appelle le point de santé avec la clé publique et sans cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await probeServer('https://x.supabase.co', 'cle', fetchMock)).toBe('joignable');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.supabase.co/auth/v1/health');
    expect(init.headers).toEqual({ apikey: 'cle' });
    expect(init.cache).toBe('no-store');
  });
  it('une réponse d’erreur HTTP compte comme injoignable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    expect(await probeServer('https://x', 'k', fetchMock)).toBe('injoignable');
  });
  it('une erreur réseau compte comme injoignable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await probeServer('https://x', 'k', fetchMock)).toBe('injoignable');
  });
  it('abandonne après le délai maximal', async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    expect(await probeServer('https://x', 'k', fetchMock, 20)).toBe('injoignable');
  });
});

describe('nextProbeDelay', () => {
  it('recul progressif plafonné à 2 minutes', () => {
    expect(nextProbeDelay('joignable', 0)).toBe(60_000);
    expect(nextProbeDelay('injoignable', 1)).toBe(10_000);
    expect(nextProbeDelay('injoignable', 2)).toBe(20_000);
    expect(nextProbeDelay('injoignable', 50)).toBe(120_000);
  });
});
