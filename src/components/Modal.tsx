import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const WIDTH: Record<Exclude<ModalSize, 'full'>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Hex accent for the border and title. */
  accent?: string;
  size?: ModalSize;
  /** Extra controls shown in the header, left of the close button. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** Overrides the default padded scroll body. */
  bodyClassName?: string;
}

/**
 * The single window shell for every modal: dim + blur backdrop, centred panel
 * with an accent border, a consistent header (icon · title · subtitle ·
 * actions · close) and a scrolling body. Backdrop click and the global Escape
 * key both close it.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  accent = '#00F0FF',
  size = 'lg',
  headerRight,
  children,
  bodyClassName,
}) => {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const isFull = size === 'full';

  return (
    <div
      className={`fixed z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm ${
        isFull
          ? // leave the app menu bar (~36px) visible and usable above a full-window panel
            'inset-x-0 bottom-0 top-9 p-0'
          : 'inset-0 p-3 sm:p-4'
      }`}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (!isFull && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex w-full flex-col overflow-hidden border-2 bg-[#0B0C12] text-[#EDEDEE] shadow-2xl ${
          isFull ? 'h-full max-h-none rounded-none border-x-0 border-b-0' : `max-h-[94vh] rounded-xl ${WIDTH[size]}`
        }`}
        style={{ borderColor: `${accent}66` }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className="shrink-0" style={{ color: accent }}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2
                className="truncate text-sm font-bold uppercase tracking-wide"
                style={{ color: accent }}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="truncate font-mono text-[11px] text-[#8E8E98]">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="rounded border border-white/10 bg-white/5 p-1.5 text-[#8E8E98] transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className={bodyClassName ? `flex-1 ${bodyClassName}` : 'flex-1 overflow-y-auto p-4'}>
          {children}
        </div>
      </div>
    </div>
  );
};
