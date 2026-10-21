import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { appConfig } from '@/lib/env';
import { deriveStatus, nextProbeDelay, probeServer, type ConnectivityInputs, type ConnectivityStatus } from './connectivity';

interface ConnectivityValue {
  status: ConnectivityStatus;
  lastServerContact: Date | null;
  recheck: () => void;
}

const ConnectivityContext = createContext<ConnectivityValue | null>(null);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [browserOnline, setBrowserOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [probe, setProbe] = useState<ConnectivityInputs['probe']>('inconnu');
  const [lastServerContact, setLastServerContact] = useState<Date | null>(null);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runProbe = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!appConfig.configured || !navigator.onLine) return;
    setProbe('en_cours');
    const result = await probeServer(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
    setProbe(result);
    if (result === 'joignable') {
      failures.current = 0;
      setLastServerContact(new Date());
    } else {
      failures.current += 1;
    }
    timer.current = setTimeout(() => void runProbe(), nextProbeDelay(result, failures.current));
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setBrowserOnline(true);
      void runProbe();
    };
    const onOffline = () => {
      setBrowserOnline(false);
      setProbe('inconnu');
      if (timer.current) clearTimeout(timer.current);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runProbe();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    void runProbe();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runProbe]);

  const value = useMemo<ConnectivityValue>(
    () => ({
      status: deriveStatus({ configured: appConfig.configured, browserOnline, probe }),
      lastServerContact,
      recheck: () => void runProbe(),
    }),
    [browserOnline, probe, lastServerContact, runProbe],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityValue {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity doit être utilisé dans ConnectivityProvider.');
  return ctx;
}
