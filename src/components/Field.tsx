import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const INPUT =
  'mt-1 block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-ciel-500 dark:border-marine-600 dark:bg-marine-900 dark:text-white aria-invalid:border-red-600';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, id, className = '', children, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});
