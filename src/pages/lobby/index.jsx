import { ChevronRight, Club, Copy, Crown, LogOut, Loader2, ShieldCheck, Spade, Users } from 'lucide-react';

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

export const LobbyPage = ({
  error,
  gameData,
  onLeave,
  onStartGame,
  onUpdateVariant,
  user,
}) => {
  const isHost = gameData?.hostId === user?.uid;
  const variants =
    gameData?.type === 'spades' ? ['classic', 'oh hell'] : ['uptown', 'downtown', 'no trump'];

  const copyCode = () => {
    if (gameData?.id) {
      const dummy = document.createElement('textarea');
      document.body.appendChild(dummy);
      dummy.value = gameData.id;
      dummy.select();
      document.execCommand('copy');
      document.body.removeChild(dummy);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative z-10">
        <div className="md:col-span-7 space-y-6">
          <div className="flex items-end justify-between px-2">
            <div>
              <h2 className="text-3xl font-black flex items-center gap-3">
                <Users className="text-cyan-400" size={32} />
                Waiting Room
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                Synchronizing Players
              </p>
            </div>
            <div
              onClick={copyCode}
              className="flex items-center gap-4 bg-slate-900/60 border border-white/5 px-5 py-3 rounded-2xl cursor-pointer hover:border-cyan-500/40 transition-all group shadow-xl"
            >
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-600 uppercase font-black tracking-tighter">
                  Access Key
                </span>
                <span className="text-2xl font-mono font-black text-cyan-500 leading-none">
                  {gameData.id}
                </span>
              </div>
              <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-cyan-500/20 group-active:scale-90 transition-all">
                <Copy size={20} className="text-slate-400 group-hover:text-cyan-400" />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {gameData.players.map((p, idx) => (
              <div
                key={p.id}
                className={`group flex items-center gap-5 p-5 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500 delay-${idx * 100}`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:rotate-3 ${p.isHost ? 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {p.isHost ? <Crown size={28} /> : p.name.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-black flex items-center gap-2 flex-wrap">
                    <span className="truncate">{p.name}</span>
                    {p.id === user.uid && (
                      <span className="flex-shrink-0 text-[9px] bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-full text-cyan-400 uppercase font-black tracking-tighter">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">
                    {p.isHost ? 'Host' : 'Player'}
                  </div>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-500 font-black whitespace-nowrap hidden sm:block">
                  CONNECTED
                </div>
              </div>
            ))}

            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
                style={{ width: `${(gameData.players.length / gameData.maxPlayers) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-5 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
            <div className="space-y-6 relative z-10">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <div className="w-4 h-[2px] bg-cyan-500" /> Game Settings
              </h3>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-cyan-500/80 uppercase tracking-widest ml-1">
                  Mode
                </p>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center gap-4 group">
                  <div className="p-3 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                    {gameData.type === 'spades' ? (
                      <Spade className="text-cyan-400" />
                    ) : (
                      <Club className="text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-lg capitalize tracking-tight">
                      {gameData.type.replace('whist', ' Whist')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight">
                      {gameData.type === 'spades'
                        ? 'Partner-based trick taking.'
                        : 'Dynamic bidding and suit selection.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-cyan-500/80 uppercase tracking-widest ml-1">
                  Variant Rules
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {variants.map((v) => (
                    <button
                      key={v}
                      onClick={() => onUpdateVariant(v)}
                      disabled={!isHost}
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                        gameData.variant === v
                          ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/20'
                      }`}
                    >
                      <span className="capitalize font-black tracking-wide">{v}</span>
                      {gameData.variant === v ? (
                        <div className="bg-white/20 p-1 rounded-md">
                          <ShieldCheck size={16} />
                        </div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-800 group-hover:bg-slate-600 transition-colors" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              {isHost ? (
                <Button
                  onClick={onStartGame}
                  className="w-full h-16 text-xl tracking-[0.1em] font-black uppercase italic"
                  disabled={gameData.players.length < gameData.minPlayers}
                >
                  START GAME{' '}
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center p-6 rounded-[2rem] bg-cyan-500/5 border border-cyan-500/10">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"></div>
                  </div>
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">
                    Awaiting Host to start the game
                  </p>
                </div>
              )}

              <button
                onClick={onLeave}
                className="w-full text-[10px] font-black text-slate-600 hover:text-rose-500 transition-colors uppercase tracking-[0.3em] flex items-center justify-center gap-2"
              >
                <LogOut size={12} /> Leave Session
              </button>
            </div>

            {error && (
              <p className="mt-4 text-rose-500 text-[10px] font-black text-center uppercase tracking-widest">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

