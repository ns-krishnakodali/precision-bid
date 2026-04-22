import { useEffect, useMemo, useRef, useState } from 'react';

import { BarChart3, LogOut, X, User } from 'lucide-react';

import { SUITE_META } from '../../constants';

const getSeatPosition = ({ totalSeats, seatIndex, xRadiusPercent, yRadiusPercent }) => {
  const angle = Math.PI / 2 - (Math.PI * 2 * seatIndex) / totalSeats;
  const x = 50 + xRadiusPercent * Math.cos(angle);
  const y = 50 - yRadiusPercent * Math.sin(angle);
  return { angle, x, y };
};

const ActionButton = ({ children, onClick, variant = 'secondary', className = '' }) => {
  const base =
    'relative overflow-hidden p-3 rounded-xl font-black transition-all duration-300 flex items-center justify-center gap-2 active:scale-95';
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

const PlayingCard = ({ card, size = 'md', className = '' }) => {
  const value = card?.value ?? '';
  const suit = String(card?.type ?? '').toLowerCase();
  const { symbol, color } = SUITE_META[suit];

  //CHECK: Update the joker logic
  const isJoker = String(suit).toLowerCase() === 'joker' || String(value).toUpperCase() === 'JOKER';

  const sizes = {
    sm: 'w-14 h-21 rounded-lg',
    md: 'w-20 h-28 rounded-xl',
  };

  return (
    <div
      className={`${sizes[size]} relative bg-linear-to-br from-white to-slate-50 text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.55)] border border-white/60
        ${className}`}
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
            <div className={`${size === 'sm' ? 'text-2xl' : 'text-5xl'} drop-shadow-sm`}>
              {symbol}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PlayerCard = ({ player }) => {
  const bids = player.bids ?? 0;
  const wins = player.wins ?? 0;
  const met = bids > 0 && wins >= bids;

  return (
    <div
      className={`relative rounded-xl sm:rounded-2xl border backdrop-blur-xl px-2.5 py-1.5  shadow-[0_10px_30px_rgba(0,0,0,0.55)] w-27 sm:w-32 flex
        flex-col items-center text-center
      ${
        player.isYou
          ? 'bg-cyan-500/20 border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.35)]'
          : 'bg-slate-950/80 border-white/15'
      }`}
    >
      <p
        className={`text-sm font-black tracking-tight truncate ${
          player.isYou ? 'text-cyan-100' : 'text-white'
        }`}
        title={player.name}
      >
        {player.name}
      </p>
      <div className="mt-1 flex items-center justify-center gap-2 w-full">
        <div className="flex-1 leading-tight flex flex-col items-center">
          <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em]">Bid</p>
          <p className="text-sm sm:text-base font-black text-white tabular-nums leading-none mt-0.5">
            {bids}
          </p>
        </div>
        <div className="w-px h-5 sm:h-6 bg-white/15" />
        <div className="flex-1 leading-tight flex flex-col items-center">
          <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em]">Wins</p>
          <p
            className={`text-sm sm:text-base font-black tabular-nums leading-none mt-0.5 ${
              met ? 'text-emerald-300' : 'text-white'
            }`}
          >
            {wins}
          </p>
        </div>
      </div>
    </div>
  );
};

const GameSeat = ({ player, totalSeats, seatIndex, playedCard }) => {
  const cardHolder = getSeatPosition({
    totalSeats,
    seatIndex,
    xRadiusPercent: 36,
    yRadiusPercent: 34,
  });

  const playedPos = getSeatPosition({
    totalSeats,
    seatIndex,
    xRadiusPercent: 19,
    yRadiusPercent: 19,
  });

  return (
    <>
      <div
        className="absolute z-20"
        style={{
          left: `${cardHolder.x}%`,
          top: `${cardHolder.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <PlayerCard player={player} />
      </div>

      {playedCard ? (
        <div
          className="absolute z-10"
          style={{
            left: `${playedPos.x}%`,
            top: `${playedPos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <PlayingCard card={playedCard} size="sm" className="transition-transform duration-300" />
        </div>
      ) : null}
    </>
  );
};

export const GameArenaPage = ({ gameData, playerName, onLeave }) => {
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const tableRef = useRef(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const players = useMemo(() => {
    const incomingPlayers = Array.isArray(gameData?.players) ? gameData.players : [];

    const normalize = (list) =>
      list.map((player, idx) => ({
        id: player.name ?? `p_${idx}`,
        name: player.name ?? `Player ${idx + 1}`,
        score: player.score ?? 0,
        bids: player.bids ?? 0,
        wins: player.wins ?? 0,
        isYou: playerName ? player.name === playerName : idx === 0,
      }));

    if (incomingPlayers.length) {
      const normalized = normalize(incomingPlayers);
      if (!normalized.some((p) => p.isYou) && normalized.length) normalized[0].isYou = true;
      const youIndex = normalized.findIndex((p) => p.isYou);
      if (youIndex > 0) {
        return [...normalized.slice(youIndex), ...normalized.slice(0, youIndex)];
      }
      return normalized;
    }

    return [
      { id: 'p1', name: playerName || 'You', score: 42, bids: 4, wins: 3, isYou: true },
      { id: 'p2', name: 'Player 2', score: 38, bids: 3, wins: 2, isYou: false },
      { id: 'p3', name: 'Player 3', score: 55, bids: 5, wins: 5, isYou: false },
      { id: 'p4', name: 'Player 4', score: 47, bids: 2, wins: 2, isYou: false },
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
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 blur-xl" />
              <div
                className="relative w-18 h-18 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl flex items-center justify-center
                  shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
              >
                <img src="/logo.svg" className="w-14 h-14" />
              </div>
            </div>
            <div className="h-16 sm:h-20 flex flex-col justify-center gap-1.5 min-w-0">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em] leading-none">
                Room Code
              </p>
              <p className="text-2xl font-mono font-black text-transparent bg-clip-text bg-linear-to-r from-cyan-300 to-blue-400 leading-none truncate">
                {roomCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ActionButton onClick={() => setIsScorecardOpen(true)} className="h-12">
              <BarChart3 size={18} className="text-cyan-300" />
              <span className="hidden sm:inline text-sm">Stats</span>
            </ActionButton>
            <ActionButton onClick={onLeave} variant="danger" className="h-12">
              <LogOut size={18} />
              <span className="hidden sm:inline text-sm">Leave Game</span>
            </ActionButton>
          </div>
        </header>
        <main className="mt-4 flex flex-col items-center">
          <div className="w-full max-w-7xl">
            <div
              ref={tableRef}
              className="relative w-full aspect-4/3 sm:aspect-16/10 lg:aspect-video"
            >
              <div className="absolute inset-0">
                <div className="absolute inset-[2%] rounded-[999px] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.18)_0%,transparent_65%)] blur-2xl" />
                <div className="absolute inset-[4%] rounded-[999px] bg-linear-to-b from-slate-700 via-slate-900 to-slate-950 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
                  <div className="absolute inset-0 rounded-[999px] shadow-[inset_0_2px_0_rgba(255,255,255,0.08),inset_0_-2px_0_rgba(0,0,0,0.6)]" />
                </div>
                <div className="absolute inset-[6%] rounded-[999px] border-2 border-dashed border-white/10" />
                <div className="absolute inset-[7%] rounded-[999px] overflow-hidden bg-linear-to-br from-emerald-950 via-slate-950 to-emerald-950">
                  <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_3px,rgba(255,255,255,0.025)_3px,rgba(255,255,255,0.025)_4px)]" />
                  <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(-45deg,transparent_0px,transparent_3px,rgba(255,255,255,0.025)_3px,rgba(255,255,255,0.025)_4px)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(255,255,255,0.12)_0%,transparent_55%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_60%)]" />
                  <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.8)]" />
                  <div className="absolute inset-[14%] rounded-[999px] border border-white/5" />
                  <div className="absolute inset-[28%] rounded-[999px] border border-white/5" />
                  <div className="absolute inset-[3%] rounded-[999px] border border-dashed border-white/10" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />

                  <div className="relative rounded-full p-0.5 overflow-hidden">
                    <div
                      className="absolute inset-[-50%] animate-spin"
                      style={{
                        animationDuration: '4s',
                        background:
                          'conic-gradient(from 0deg, transparent 0%, rgb(6 182 212) 25%, transparent 50%, rgb(59 130 246) 75%, transparent 100%)',
                      }}
                    />
                    <div className="relative px-5 sm:px-7 py-3 sm:py-4 rounded-full bg-slate-950/90 backdrop-blur-xl text-center overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.22)_0%,transparent_65%)]" />
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/60 to-transparent" />
                      <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
                        <span className="relative flex shrink-0">
                          <span className="absolute inline-flex h-2 w-2 rounded-full bg-cyan-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]" />
                        </span>

                        <div className="text-left leading-tight">
                          <p className="text-[10px] text-cyan-300/80 font-black uppercase tracking-[0.35em]">
                            Game Status
                          </p>
                          <p className="mt-1 text-base font-semibold tracking-wider whitespace-nowrap text-cyan-200 bg-clip-text">
                            {statusText}
                          </p>
                        </div>
                      </div>
                    </div>
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
            </div>
            <div className="mt-6">
              <div className="flex items-end justify-between gap-4 px-2">
                <div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight">
                    Your Hand
                  </h2>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] sm:tracking-[0.35em] mt-1">
                    Tap a card to play at your turn
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-white/10 backdrop-blur-xl">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                    Cards
                  </span>
                  <span className="text-sm font-black text-cyan-300 tabular-nums">
                    {yourHand.length}
                  </span>
                </div>
              </div>
              <div
                className="mt-3 sm:mt-4 px-3 sm:px-5 lg:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[1.75rem]
                  sm:rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
              >
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-2 pb-2">
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
      {isScorecardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button
            onClick={() => setIsScorecardOpen(false)}
            className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md"
            aria-label="Close scorecard"
          />
          <div
            className="w-full max-w-xl relative z-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_30px_120px_rgba(0,0,0,0.65)]
              overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
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
                  onClick={() => setIsScorecardOpen(false)}
                  className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center active:scale-95
                    transition-all"
                  aria-label="Close modal"
                >
                  <X className="text-slate-300" size={18} />
                </button>
              </div>
              <div className="mt-7 space-y-2">
                {players
                  .slice()
                  .sort((p1, p2) => (p2.score ?? 0) - (p1.score ?? 0))
                  .map((player, idx) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-colors ${
                        idx === 0
                          ? 'bg-cyan-500/10 border-cyan-500/20'
                          : 'bg-slate-950/40 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                            idx === 0
                              ? 'bg-cyan-500/15 border-cyan-500/25'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <User
                            size={18}
                            className={idx === 0 ? 'text-cyan-300' : 'text-slate-300'}
                          />
                        </div>
                        <div className="leading-tight">
                          <p className="font-black tracking-tight">{player.name}</p>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                            Player
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-white tabular-nums">
                          {player.score}
                        </p>
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
      )}
    </div>
  );
};
