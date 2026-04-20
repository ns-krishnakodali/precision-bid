import { Layers, Loader2 } from 'lucide-react';

const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  loading = false,
}) => {
  const base =
    'relative overflow-hidden px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]',
    secondary: 'bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10',
    danger: 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/30',
    outline: 'border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="animate-spin" size={20} /> : children}
    </button>
  );
};

export const GameArenaPage = ({ onAbortToLobby }) => (
  <div className="min-h-screen text-white flex items-center justify-center flex-col gap-6 relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)]" />
    <div className="animate-in zoom-in-50 duration-1000 flex flex-col items-center gap-6 relative z-10">
      <div className="relative">
        <Layers size={80} className="text-cyan-500 animate-pulse" />
        <div className="absolute -inset-4 bg-cyan-500/20 blur-2xl rounded-full -z-10 animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Initializing Deck</h1>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.4em]">
          Shuffling cards...
        </p>
      </div>
    </div>
    <Button
      variant="danger"
      onClick={onAbortToLobby}
      className="mt-12 scale-75 opacity-50 hover:opacity-100"
    >
      DEBUG: ABORT TO LOBBY
    </Button>
  </div>
);
