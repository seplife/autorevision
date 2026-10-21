import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/Button';

/**
 * Mise à jour de l'application : la nouvelle version n'est activée qu'à la demande
 * de l'utilisateur, pour ne jamais interrompre une évaluation ou une synchronisation.
 * Les données locales (IndexedDB, à partir du module 8) ne sont pas touchées par
 * l'activation d'un nouveau Service Worker.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-marine-200 bg-white p-4 shadow-lg dark:border-marine-700 dark:bg-marine-900"
    >
      <p className="text-sm">
        {needRefresh
          ? 'Une nouvelle version de l’application est disponible.'
          : 'L’application est prête à s’ouvrir sans connexion sur cet appareil.'}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        {needRefresh && <Button onClick={() => void updateServiceWorker(true)}>Mettre à jour</Button>}
        <Button
          variant="secondary"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          {needRefresh ? 'Plus tard' : 'Fermer'}
        </Button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Bouton d'installation : n'apparaît que si le navigateur propose réellement l'installation. */
export function InstallButton() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const installed = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  if (!event) return null;
  return (
    <Button
      variant="success"
      onClick={async () => {
        await event.prompt();
        await event.userChoice;
        setEvent(null);
      }}
    >
      Installer l’application
    </Button>
  );
}
