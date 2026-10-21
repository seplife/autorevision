export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function LoadingScreen({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 p-6 text-slate-600 dark:text-slate-300" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
