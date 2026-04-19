import { useEffect } from 'react';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const TOAST_TYPES = {
  error: {
    container: 'bg-rose-500/10 border-rose-500/30 text-rose-100',
    icon: AlertCircle,
    iconClassName: 'text-rose-400',
  },
  info: {
    container: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-50',
    icon: Info,
    iconClassName: 'text-cyan-300',
  },
  success: {
    container: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-50',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-400',
  },
};

export const Toaster = ({ toast, onDismiss, durationMs = 3500 }) => {
  useEffect(() => {
    if (!toast?.id) return undefined;

    const timeoutId = setTimeout(() => {
      onDismiss?.();
    }, durationMs);

    return () => clearTimeout(timeoutId);
  }, [durationMs, onDismiss, toast?.id]);

  if (!toast?.message) return null;

  const { container, icon: Icon, iconClassName } = TOAST_TYPES[toast.type] ?? TOAST_TYPES.info;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md pointer-events-none">
      <div
        className={`pointer-events-auto flex items-start gap-3 rounded-2xl border backdrop-blur-xl px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]
          animate-in fade-in slide-in-from-top-4 duration-200 ${container}`}
        role="status"
      >
        <div className="mt-0.5 shrink-0">
          <Icon size={18} className={iconClassName} />
        </div>
        <div className="flex-1 text-sm leading-snug font-semibold text-center">{toast.message}</div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
