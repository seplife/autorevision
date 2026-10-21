/**
 * Connectivité : l'événement « online » du navigateur indique seulement qu'une
 * interface réseau est active, PAS que le serveur est joignable. On vérifie donc
 * la joignabilité réelle par une requête de santé avec délai maximal.
 */

export type ConnectivityStatus =
  | 'non_configure' // aucun serveur configuré
  | 'hors_ligne' // le navigateur ne détecte aucun réseau
  | 'verification' // réseau détecté, vérification du serveur en cours
  | 'serveur_injoignable' // réseau détecté mais le serveur ne répond pas
  | 'en_ligne'; // le serveur a répondu récemment

export interface ConnectivityInputs {
  configured: boolean;
  browserOnline: boolean;
  probe: 'inconnu' | 'en_cours' | 'joignable' | 'injoignable';
}

export function deriveStatus({ configured, browserOnline, probe }: ConnectivityInputs): ConnectivityStatus {
  if (!configured) return 'non_configure';
  if (!browserOnline) return 'hors_ligne';
  if (probe === 'joignable') return 'en_ligne';
  if (probe === 'injoignable') return 'serveur_injoignable';
  return 'verification';
}

export const STATUS_LABELS: Record<ConnectivityStatus, string> = {
  non_configure: 'Serveur non configuré',
  hors_ligne: 'Hors connexion',
  verification: 'Vérification du serveur…',
  serveur_injoignable: 'Serveur injoignable',
  en_ligne: 'En ligne',
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Interroge le point de santé de Supabase Auth. Toute réponse HTTP (même 4xx/5xx
 * d'authentification) n'est PAS considérée comme une preuve de bon fonctionnement :
 * seule une réponse 2xx compte comme « joignable ».
 */
export async function probeServer(
  supabaseUrl: string,
  anonKey: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 6000,
): Promise<'joignable' | 'injoignable'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: anonKey },
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok ? 'joignable' : 'injoignable';
  } catch {
    return 'injoignable';
  } finally {
    clearTimeout(timer);
  }
}

/** Délai avant la prochaine vérification : rapide si le serveur ne répond pas, avec plafond. */
export function nextProbeDelay(lastResult: 'joignable' | 'injoignable', consecutiveFailures: number): number {
  if (lastResult === 'joignable') return 60_000;
  const base = 5_000 * 2 ** Math.min(consecutiveFailures, 5);
  return Math.min(base, 120_000);
}
