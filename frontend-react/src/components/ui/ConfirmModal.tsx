import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

export function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onCancel, variant = 'danger',
}: Props) {
  if (!open) return null;

  const confirmColors = variant === 'danger'
    ? 'bg-red hover:brightness-110 shadow-red-glow text-white'
    : 'bg-yellow hover:brightness-110 text-black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl p-7 w-full max-w-md shadow-2xl animate-fade-up">
        {/* icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 ${
          variant === 'danger' ? 'bg-red/10 text-red' : 'bg-yellow/10 text-yellow'
        }`}>
          {variant === 'danger' ? '⚠' : '⚡'}
        </div>
        <h3 className="text-base font-semibold text-tp mb-2">{title}</h3>
        <div className="text-sm text-ts leading-relaxed mb-6">{message}</div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-ts bg-card-2 border border-border hover:border-border transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${confirmColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
