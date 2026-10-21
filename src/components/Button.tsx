import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Loading';

const VARIANTS = {
  primary: 'bg-marine-900 text-white hover:bg-marine-800 dark:bg-ciel-400 dark:text-marine-950 dark:hover:bg-ciel-300',
  secondary:
    'border border-marine-200 bg-white text-marine-900 hover:bg-marine-50 dark:border-marine-600 dark:bg-marine-900 dark:text-white dark:hover:bg-marine-800',
  success: 'bg-savane-700 text-white hover:bg-savane-600',
  danger: 'bg-red-700 text-white hover:bg-red-600',
  ghost: 'text-marine-800 hover:bg-marine-50 dark:text-ciel-300 dark:hover:bg-marine-900',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  loading?: boolean;
}

export function Button({ variant = 'primary', loading = false, className = '', children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
