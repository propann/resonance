import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '../stores/toastStore';

const STYLE: Record<ToastKind, { border: string; text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  info: { border: 'border-[#00F0FF]/50', text: 'text-[#00F0FF]', Icon: Info },
  success: { border: 'border-[#10B981]/50', text: 'text-[#34D399]', Icon: CheckCircle2 },
  error: { border: 'border-[#EF4444]/50', text: 'text-[#F87171]', Icon: AlertTriangle },
};

export const Toaster: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map(({ id, kind, message }) => {
        const { border, text, Icon } = STYLE[kind];
        return (
          <div
            key={id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border ${border} bg-[#0E0E1A]/95 px-3 py-2.5 text-xs text-[#EDEDEE] shadow-2xl backdrop-blur`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${text}`} />
            <span className="flex-1 leading-snug">{message}</span>
            <button
              onClick={() => dismiss(id)}
              className="shrink-0 text-[#8E8E98] hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
