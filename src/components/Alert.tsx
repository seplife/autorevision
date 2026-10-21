import type { ReactNode } from 'react';

const TONES = {
  info: 'border-ciel-400 bg-marine-50 text-marine-900 dark:bg-marine-900/60 dark:text-marine-50',
  success: 'border-savane-600 bg-green-50 text-green-900 dark:bg-green-950/60 dark:text-green-100',
  warning: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
  error: 'border-red-600 bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-100',
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: ReactNode;
}) {
  // Les erreurs sont annoncées immédiatement aux lecteurs d'écran ; le reste poliment.
  const role = tone === 'error' ? 'alert' : 'status';
  return (
    <div role={role} className={`rounded-lg border-l-4 p-4 ${TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1 text-sm' : 'text-sm'}>{children}</div>}
    </div>
  );
}
