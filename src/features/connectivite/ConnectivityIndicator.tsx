import { STATUS_LABELS } from './connectivity';
import { useConnectivity } from './ConnectivityProvider';

const DOT: Record<string, string> = {
  en_ligne: 'bg-savane-500',
  verification: 'bg-ciel-400 animate-pulse',
  serveur_injoignable: 'bg-amber-500',
  hors_ligne: 'bg-slate-400',
  non_configure: 'bg-red-500',
};

export function ConnectivityIndicator() {
  const { status, recheck, lastServerContact } = useConnectivity();
  const title = lastServerContact
    ? `Dernier contact avec le serveur : ${lastServerContact.toLocaleTimeString('fr-CI', { timeZone: 'Africa/Abidjan' })}`
    : 'Aucun contact avec le serveur depuis l’ouverture';
  return (
    <button
      type="button"
      onClick={recheck}
      title={`${title}. Cliquez pour vérifier à nouveau.`}
      className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-white/90 hover:bg-white/10"
    >
      <span aria-hidden="true" className={`size-2.5 rounded-full ${DOT[status] ?? 'bg-slate-400'}`} />
      <span role="status" aria-live="polite">
        {STATUS_LABELS[status]}
      </span>
    </button>
  );
}
