import { useMemo, useState } from 'react';

import { BarChart3, LogOut, X, User } from 'lucide-react';

const ActionButton = ({ children, onClick, variant = 'secondary', className = '' }) => {
  const base =
    'relative overflow-hidden px-5 py-3 rounded-xl font-black transition-all duration-300 flex items-center justify-center gap-2 active:scale-95';
  const variants = {
    primary:
      'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]',
    secondary: 'bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10',
    danger: 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 border border-rose-500/30',
    outline: 'border-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10',
  };

  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const getSuitMeta = (type) => {
  const normalizedType = String(type ?? '').toLowerCase();

  if (normalizedType === 'heart') return { symbol: '\u2665', color: 'text-rose-500' };
  if (normalizedType === 'diamond') return { symbol: '\u2666', color: 'text-rose-500' };
  if (normalizedType === 'club') return { symbol: '\u2663', color: 'text-slate-800' };
  if (normalizedType === 'spade') return { symbol: '\u2660', color: 'text-slate-800' };

  return { symbol: '\u2605', color: 'text-amber-300' };
};

const PlayingCard = ({ card, size = 'md', className = '' }) => {
  const value = card?.value ?? '';
  const suit = card?.type ?? '';
  const { symbol, color } = getSuitMeta(suit);
  const isJoker = String(suit).toLowerCase() === 'joker' || String(value).toUpperCase() === 'JOKER';

  const sizes = {
    sm: 'w-14 h-20 rounded-xl',
    md: 'w-20 h-28 rounded-2xl',
  };

  return (
    <div
      className={`${sizes[size]} relative bg-linear-to-br from-white to-slate-50 text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.55)] border border-white/60 ${className}`}
    >
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-black/10 pointer-events-none" />
      {isJoker ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center px-3">
            <p className="text-[10px] font-black tracking-[0.4em] text-slate-600">JOKER</p>
            <p className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-cyan-500 to-blue-600">
              ★
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className={`absolute top-2 left-2 ${color}`}>
            <div className="text-sm font-black leading-none">{value}</div>
            <div className="text-sm leading-none -mt-0.5">{symbol}</div>
          </div>
          <div className={`absolute bottom-2 right-2 ${color} rotate-180`}>
            <div className="text-sm font-black leading-none">{value}</div>
            <div className="text-sm leading-none -mt-0.5">{symbol}</div>
          </div>
          <div className={`absolute inset-0 flex items-center justify-center ${color}`}>
            <div className={`${size === 'sm' ? 'text-3xl' : 'text-5xl'} drop-shadow-sm`}>
              {symbol}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ScorecardModal = ({ isOpen, onClose, players }) => {
  if (!isOpen) return null;

  const sortedPlayers = [...players].sort((p1, p2) => (p2.score ?? 0) - (p1.score ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md"
        aria-label="Close scorecard"
      />
      <div className="w-full max-w-xl relative z-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_30px_120px_rgba(0,0,0,0.65)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.12)_0%,transparent_55%)]" />
        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">
                Scorecard
              </p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                Current Scores
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center active:scale-95 transition-all"
              aria-label="Close modal"
            >
              <X className="text-slate-300" size={18} />
            </button>
          </div>

          <div className="mt-7 space-y-2">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-colors ${
                  idx === 0 ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-slate-950/40 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                      idx === 0 ? 'bg-cyan-500/15 border-cyan-500/25' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <User size={18} className={idx === 0 ? 'text-cyan-300' : 'text-slate-300'} />
                  </div>
                  <div className="leading-tight">
                    <p className="font-black tracking-tight">{player.name}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                      Player
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white tabular-nums">{player.score}</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                    Points
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const getSeatPosition = ({ totalSeats, seatIndex, xRadiusPercent = 42, yRadiusPercent = 30 }) => {
  const angle = (Math.PI * 2 * seatIndex) / totalSeats - Math.PI / 2;
  const x = 50 + xRadiusPercent * Math.cos(angle);
  const y = 50 + yRadiusPercent * Math.sin(angle);

  return { angle, x, y };
};

const GameSeat = ({ player, totalSeats, seatIndex, playedCard }) => {
  const iconPosition = getSeatPosition({
    totalSeats,
    seatIndex,
    xRadiusPercent: 56,
    yRadiusPercent: 43,
  });

  const cardPosition = getSeatPosition({
    totalSeats,
    seatIndex,
    xRadiusPercent: 30,
    yRadiusPercent: 21,
  });

  return (
    <>
      {playedCard ? (
        <div
          className="absolute"
          style={{
            left: `${cardPosition.x}%`,
            top: `${cardPosition.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <PlayingCard card={playedCard} size="sm" className="transition-transform duration-300" />
        </div>
      ) : null}

      <div
        className="absolute"
        style={{
          left: `${iconPosition.x}%`,
          top: `${iconPosition.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="relative flex flex-col items-center gap-2">
          <div
            className={`w-14 h-14 rounded-3xl border flex items-center justify-center shadow-xl ${
              player.isYou
                ? 'bg-cyan-500/15 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.25)]'
                : 'bg-slate-900/60 border-white/10'
            }`}
          >
            <User size={22} className={player.isYou ? 'text-cyan-300' : 'text-slate-200'} />
          </div>
          <div className="text-center leading-tight">
            <p className="text-xs font-black tracking-tight">{player.name}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export const GameArenaPage = ({ gameData, onAbortToLobby, onLeave, playerName }) => {
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  const players = useMemo(() => {
    const incomingPlayers = Array.isArray(gameData?.players) ? gameData.players : [];

    if (incomingPlayers.length) {
      const normalized = incomingPlayers.map((player, idx) => ({
        id: player.name ?? `p_${idx}`,
        name: player.name ?? `Player ${idx + 1}`,
        score: player.score ?? 0,
        isYou: playerName ? player.name === playerName : idx === 0,
      }));

      if (!normalized.some((p) => p.isYou) && normalized.length) normalized[0].isYou = true;
      return normalized;
    }

    return [
      { id: 'p1', name: playerName || 'You', score: 42, isYou: true },
      { id: 'p2', name: 'Player 2', score: 38, isYou: false },
      { id: 'p3', name: 'Player 3', score: 55, isYou: false },
      { id: 'p4', name: 'Player 4', score: 47, isYou: false },
    ];
  }, [gameData, playerName]);

  const roomCode = String(gameData?.code ?? '------').toUpperCase();

  const yourHand = useMemo(
    () => [
      { value: 'A', type: 'spade' },
      { value: 'K', type: 'spade' },
      { value: 'Q', type: 'spade' },
      { value: 'J', type: 'spade' },
      { value: '10', type: 'spade' },
      { value: '9', type: 'heart' },
      { value: '8', type: 'heart' },
      { value: '7', type: 'diamond' },
      { value: '6', type: 'diamond' },
      { value: '5', type: 'club' },
      { value: '4', type: 'club' },
      { value: '3', type: 'club' },
      { value: '2', type: 'club' },
    ],
    []
  );

  const playedCards = useMemo(() => {
    const samples = [
      { value: '9', type: 'spade' },
      { value: 'A', type: 'heart' },
      { value: 'K', type: 'diamond' },
      { value: 'Q', type: 'club' },
    ];

    return players.reduce((acc, player, idx) => {
      acc[player.id] = samples[idx % samples.length];
      return acc;
    }, {});
  }, [players]);

  const statusText = useMemo(() => {
    const waitingFor = players.find((p) => !p.isYou)?.name ?? players[0]?.name ?? 'Player';
    return `Waiting for ${waitingFor}`;
  }, [players]);

  const leaveHandler = () => {
    if (onLeave) onLeave();
    else onAbortToLobby?.();
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/10 rounded-full blur-[160px]" />
      <div className="absolute bottom-[-35%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[160px]" />
      <div
        className="absolute inset-0 opacity-20 pointer-events-none
          bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-size-[40px_40px]"
      />
      <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

      <div className="relative z-10 p-4 sm:p-6 lg:p-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 bg-slate-950 border border-white/10 rounded-2xl flex items-center justify-center shadow-xl shrink-0">
              <img src="/logo.svg" className="w-10 h-10" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em]">
                ROOM CODE
              </p>
              <p className="text-xl sm:text-2xl font-mono font-black text-cyan-500 leading-none truncate">
                {roomCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ActionButton onClick={() => setIsScorecardOpen(true)} className="h-12 px-5">
              <BarChart3 size={18} className="text-cyan-300" />
              <span className="hidden sm:inline">Scorecard</span>
            </ActionButton>
            <ActionButton onClick={leaveHandler} variant="danger" className="h-12 px-5">
              <LogOut size={18} />
              <span className="hidden sm:inline">Leave Game</span>
            </ActionButton>
          </div>
        </header>

        <main className="mt-8 lg:mt-10 flex flex-col items-center">
          <div className="w-full max-w-6xl">
            <div className="relative w-full aspect-16/10 sm:aspect-video lg:aspect-18/9">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[92%] h-[72%] rounded-[999px] relative">
                  <div className="absolute -inset-2 rounded-[999px] bg-linear-to-br from-cyan-500/10 via-transparent to-blue-600/10 blur-xl" />
                  <div className="absolute inset-0 rounded-[999px] bg-slate-950/70 border border-white/10 shadow-[0_60px_160px_rgba(0,0,0,0.70)] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(6,182,212,0.18)_0%,transparent_55%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.12)_0%,transparent_60%)]" />
                    <div className="absolute inset-0 opacity-60 bg-[linear-gradient(transparent_0px,transparent_10px,rgba(255,255,255,0.03)_10px,rgba(255,255,255,0.03)_11px)] bg-size-[100%_24px]" />
                    <div className="absolute inset-5 rounded-[999px] border border-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
                    <div className="absolute inset-10 rounded-[999px] bg-linear-to-br from-cyan-500/10 via-transparent to-blue-600/10" />
                    <div className="absolute inset-0 shadow-[inset_0_30px_80px_rgba(0,0,0,0.55)]" />
                  </div>
                </div>
              </div>

              <div className="absolute inset-0">
                {players.map((player, idx) => (
                  <GameSeat
                    key={player.id}
                    player={player}
                    totalSeats={players.length}
                    seatIndex={idx}
                    playedCard={playedCards[player.id]}
                  />
                ))}
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-[2.25rem] p-px bg-linear-to-r from-cyan-500/35 via-white/10 to-blue-600/35 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
                  <div className="px-6 py-4 rounded-[2.2rem] bg-slate-950/55 border border-white/10 backdrop-blur-3xl text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.14)_0%,transparent_55%)]" />
                    <div className="relative z-10">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em]">
                        Game Status
                      </p>
                      <p className="mt-1 text-lg sm:text-xl font-black tracking-tight">
                        {statusText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <div className="flex items-end justify-between gap-4 px-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">Your Hand</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em] mt-1">
                    Tap a card to play later
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 sm:p-6 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
                <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {yourHand.map((card, idx) => (
                    <button
                      key={`${card.value}_${card.type}_${idx}`}
                      className="shrink-0 active:scale-95 transition-transform duration-200 group"
                    >
                      <PlayingCard
                        card={card}
                        size="md"
                        className="group-hover:-translate-y-1 transition-transform duration-200"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ScorecardModal
        isOpen={isScorecardOpen}
        onClose={() => setIsScorecardOpen(false)}
        players={players}
      />
    </div>
  );
};
