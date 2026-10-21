import { useEffect, useRef } from 'react';
import { Button } from './Button';

/** Confirmation obligatoire avant toute action destructrice ou sensible. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-xl p-0 backdrop:bg-black/50 dark:bg-marine-900 dark:text-white"
    >
      {open && (
        <div className="p-5">
          <h2 id="confirm-title" className="text-lg font-bold">
            {title}
          </h2>
          <p className="mt-2 text-slate-700 dark:text-slate-200">{message}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={loading}>
              Annuler
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
