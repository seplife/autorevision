import type { ReactNode } from 'react';

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-marine-800 dark:bg-marine-900 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-bold text-marine-900 dark:text-white">{title}</h2>}
      {children}
    </section>
  );
}

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-marine-900 sm:text-3xl dark:text-white">{title}</h1>
      {description && <p className="mt-2 text-slate-600 dark:text-slate-300">{description}</p>}
    </header>
  );
}
