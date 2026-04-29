import { useEffect, useMemo, useRef, useState } from 'react';

import { BarChart3, Crown, LogOut, Star, User, X } from 'lucide-react';

import { Toaster } from '../../components';
import {
  BID_WHIST_VARIANT,
  BIDDING,
  CARD_SUITS,
  CLUB,
  DIAMOND,
  GAME_TYPE,
  HEART,
  JOKER,
  SELECT_TRUMP_STATUS,
  SPADE,
  SPADES_VARIANT,
  SUITE_META,
} from '../../constants';
import { gameService } from '../../services';

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

const Border = () => (
  <div className="relative mt-3 h-0.5 w-full overflow-hidden">
    <div className="absolute inset-0 bg-linear-to-r from-transparent via-cyan-500/70 to-transparent" />
    <div className="absolute inset-x-[18%] top-0 h-px bg-cyan-300/60 blur-sm" />
  </div>
);

const PlayingCard = ({ card, size = 'md', className = '' }) => {
  const value = card?.value ?? '';
  const suit = card?.suit ?? '';
  const { symbol, color } = SUITE_META[suit] ?? {};

  const sizes = {
    xs: 'w-11 h-16 rounded-md',
    sm: 'w-13 h-19 rounded-lg',
    md: 'w-20 h-30 rounded-xl',
  };

  const cornerTextSize = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
  };

  const centerTextSize = {
    xs: 'text-xl',
    sm: 'text-2xl',
    md: 'text-5xl',
  };

  return (
    <div
      className={`${sizes[size]} relative bg-linear-to-br from-white to-slate-50 text-slate-900 shadow-[0_16px_35px_rgba(0,0,0,0.5)] border border-white/60
        animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ${className}`}
    >
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-black/10 pointer-events-none" />
      <div className={`absolute top-1.5 left-1.5 ${color}`}>
        <div className={`${cornerTextSize[size]} font-black leading-none`}>{value}</div>
        <div className={`${cornerTextSize[size]} leading-none -mt-0.5`}>{symbol}</div>
      </div>
      <div className={`absolute bottom-1.5 right-1.5 ${color} rotate-180`}>
        <div className={`${cornerTextSize[size]} font-black leading-none`}>{value}</div>
        <div className={`${cornerTextSize[size]} leading-none -mt-0.5`}>{symbol}</div>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${color}`}>
        <div className={`${centerTextSize[size]} drop-shadow-sm`}>{symbol}</div>
      </div>
    </div>
  );
};

const PlayerCard = ({ player, isPlayerTurn = false, isTurnStarter = false }) => {
  const bids = player.bids ?? 0;
  const wins = player.wins ?? 0;
  const met = bids > 0 && wins >= bids;

  return (
    <div
      className={`relative rounded-xl border backdrop-blur-xl px-2.5 py-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.5)] w-25 sm:w-30 flex flex-col items-center text-center ${
        isPlayerTurn
          ? 'bg-cyan-500/20 border-cyan-400/50 shadow-[0_0_22px_rgba(6,182,212,0.35)]'
          : 'bg-slate-950/80 border-white/15'
      }`}
    >
      {isTurnStarter && (
        <div
          className="absolute right-2 top-1.6 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/25 bg-slate-950/85
            shadow-[0_0_12px_rgba(6,182,212,0.2)] sm:h-4.5 sm:w-4.5"
          title="Started this turn"
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.22)_0%,transparent_70%)]" />
          <Star size={9} className="relative text-cyan-200 sm:h-2.5 sm:w-2.5" />
        </div>
      )}
      <div className="w-full flex items-center justify-center gap-1.5 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isPlayerTurn ? 'bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]' : 'bg-slate-500'
          }`}
        />
        <p
          className={`text-xs sm:text-sm font-black tracking-tight truncate ${
            isPlayerTurn ? 'text-cyan-100' : 'text-white'
          }`}
          title={player.name}
        >
          {player.name}
        </p>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 w-full">
        <div className="rounded-lg bg-white/5 border border-white/5 px-1.5 py-1 leading-none">
          <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.18em]">Bid</p>
          <p className="mt-0.5 text-xs sm:text-sm font-black text-white tabular-nums">{bids}</p>
        </div>

        <div className="rounded-lg bg-white/5 border border-white/5 px-1.5 py-1 leading-none">
          <p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.18em]">Wins</p>
          <p
            className={`mt-0.5 text-xs sm:text-sm font-black tabular-nums ${
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

const GameSeat = ({ player, totalSeats, seatIndex, playedCard, isPlayerTurn, isTurnStarter }) => {
  const playersPosition = getSeatPosition({
    totalSeats,
    seatIndex,
    xRadiusPercent: 37,
    yRadiusPercent: 31,
  });

  return (
    <div
      className="absolute z-20"
      style={{
        left: `${playersPosition.x}%`,
        top: `${playersPosition.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative flex flex-col items-center gap-1.5 sm:gap-2">
        <div className="relative z-20 -mb-0.5">
          {Object.keys(playedCard ?? {}).length > 0 ? (
            <>
              <div className="absolute inset-x-2 bottom-0 h-3 rounded-full bg-cyan-400/20 blur-md" />
              <PlayingCard
                card={playedCard}
                size="xs"
                className="relative transition-transform duration-300 hover:-translate-y-1"
              />
            </>
          ) : (
            <>
              <div className="absolute inset-x-2 bottom-0 h-3 rounded-full bg-cyan-400/10 blur-md" />
              <div
                className="relative w-11 h-16 rounded-md bg-linear-to-br from-slate-800/80 to-slate-950/90 border border-white/10 backdrop-blur-xl
                  shadow-[0_16px_35px_rgba(0,0,0,0.35)] overflow-hidden"
              >
                <div className="absolute inset-1 rounded-[inherit] border border-cyan-300/20" />
                <div
                  className="absolute inset-2 rounded-sm
                    bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_5px)]"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.14)_0%,transparent_65%)]" />
              </div>
            </>
          )}
        </div>
        <div className="relative z-10">
          <PlayerCard player={player} isPlayerTurn={isPlayerTurn} isTurnStarter={isTurnStarter} />
        </div>
      </div>
    </div>
  );
};

export const GameArenaPage = ({ lobbyId, gameData, playerName, onLeave }) => {
  const [toast, setToast] = useState(null);
  const [openScorecardModal, setOpenScoreCardModal] = useState(false);
  const [bidCount, setBidCount] = useState('');

  const tableRef = useRef(null);

  const winnerNames = gameData.winnerNames ?? [];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (winnerNames.length === 0) {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [winnerNames.length]);

  const currentRound = gameData.rounds?.at(-1);

  const players = useMemo(
    () =>
      (gameData.players ?? []).map((player) => ({
        name: player.name,
        score: player.score,
        accumulated: player.accumulated,
        bids: currentRound?.players?.[player.name].bids,
        wins: currentRound?.players?.[player.name].wins,
      })),
    [gameData.players, currentRound]
  );

  const playerHand = useMemo(
    () => gameData.players.find((playerData) => playerData?.name === playerName)?.cards ?? [],
    [gameData.players, playerName]
  );

  const playedCards = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(currentRound?.players ?? {}).map(([playerName, playerDetails]) => [
          playerName,
          playerDetails.played?.[Number(currentRound?.currentTurn ?? 1) - 1] ?? {},
        ])
      ),
    [currentRound]
  );

  const sortedPlayers = useMemo(
    () =>
      [...players].sort(
        (player1, player2) =>
          (player2.score ?? 0) - (player1.score ?? 0) ||
          (player2.accumulated ?? 0) - (player1.accumulated ?? 0)
      ),
    [players]
  );

  // Variables
  const currentPlayer = players[gameData?.currentPlayerIdx ?? 0]?.name;
  const isPlayerTurn = currentPlayer === playerName;
  const leadSuit =
    Number(currentRound?.currentTurn ?? 0) - 1 >= 0
      ? (currentRound.players?.[players[currentRound?.startPlayerIdx ?? -1]?.name]?.played?.[
          Number(currentRound?.currentTurn ?? 0) - 1
        ]?.suit ?? '')
      : '';
  const restrictedSuit =
    leadSuit && playerHand.some((cardDetails) => cardDetails.suit === leadSuit) ? leadSuit : '';
  const isBidValid =
    bidCount !== '' &&
    Number.isInteger(Number(bidCount)) &&
    Number(bidCount) >= 0 &&
    Number(bidCount) <= playerHand.length;
  const winningPlayers = players.filter((player) => winnerNames.includes(player.name));

  // Handler methods
  const handleUserBid = async () => {
    if (!isBidValid) {
      setToast({
        message: `Enter a valid bid between 0 and ${playerHand.length}.`,
        type: 'error',
      });
      return;
    }

    const isLastBidder =
      (gameData?.currentPlayerIdx + 1) % players.length === currentRound.startPlayerIdx;

    await gameService.updateRoundState(lobbyId, playerName, {}, Number(bidCount), !isLastBidder);
    if (isLastBidder)
      await gameService.updateRoundTrump(
        lobbyId,
        gameData.variant === BID_WHIST_VARIANT.UPTOWN ||
          gameData.variant === BID_WHIST_VARIANT.DOWNTOWN
          ? undefined
          : gameData.gameType === GAME_TYPE.SPADES
            ? SPADE
            : ''
      );
  };

  const handleRoundTrump = async (suit) => {
    await gameService.updateRoundTrump(lobbyId, suit);
  };

  const handleCardPlay = async (cardDetails) => {
    if (Object.keys(cardDetails ?? {}).length === 0) {
      setToast({
        message: 'Invalid card details',
        type: 'error',
      });
      return;
    }

    const isLastPlay =
      (gameData?.currentPlayerIdx + 1) % players.length === currentRound.startPlayerIdx;

    await gameService.updateRoundState(lobbyId, playerName, cardDetails, undefined, !isLastPlay);
    if (isLastPlay) {
      await gameService.updateTurnWinner(lobbyId);
    }
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <Toaster toast={toast} onDismiss={() => setToast(null)} />
      <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/10 rounded-full blur-[160px]" />
      <div className="absolute bottom-[-35%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[160px]" />
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-size-[40px_40px]" />
      <div className="relative z-10 px-8 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 blur-xl" />
              <div className="relative w-18 h-18 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <img src="/logo.svg" className="w-14 h-14" />
              </div>
            </div>
            <div className="h-16 sm:h-20 flex flex-col justify-center gap-1.5 min-w-0">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em] leading-none">
                Room Code
              </p>
              <p className="text-2xl font-mono font-black text-transparent bg-clip-text bg-linear-to-r from-cyan-300 to-blue-400 leading-none truncate">
                {String(gameData.code ?? '------')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ActionButton onClick={() => setOpenScoreCardModal(true)} className="h-12">
              <BarChart3 size={18} className="text-cyan-300" />
              <span className="hidden sm:inline text-sm">Stats</span>
            </ActionButton>
            <ActionButton onClick={onLeave} variant="danger" className="h-12">
              <LogOut size={18} />
              <span className="hidden sm:inline text-sm">Leave Game</span>
            </ActionButton>
          </div>
        </header>
        <Border />
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <div
              className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/5 px-3 leading-none shadow-[0_10px_30px_rgba(0,0,0,0.2)]
                backdrop-blur-xl"
            >
              <span className="text-[9px] font-black uppercase leading-none tracking-[0.24em] text-slate-500">
                Game
              </span>
              <span className="ml-1.5 max-w-24 truncate text-xs font-black leading-none tracking-wider text-slate-100 sm:max-w-32">
                {gameData.gameType}
              </span>
            </div>
            <div
              className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/5 px-3 leading-none shadow-[0_10px_30px_rgba(0,0,0,0.2)]
                backdrop-blur-xl"
            >
              <span className="text-[9px] font-black uppercase leading-none tracking-[0.24em] text-slate-500">
                Variant
              </span>
              <span className="ml-1.5 max-w-24 truncate text-xs font-black leading-none tracking-wider text-slate-100 sm:max-w-32">
                {gameData.variant}
              </span>
            </div>
            {currentRound?.trumpSuit && (
              <div
                className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/5 px-3 leading-none shadow-[0_10px_30px_rgba(0,0,0,0.2)]
                backdrop-blur-xl"
              >
                <span className="text-[9px] font-black uppercase leading-none tracking-[0.24em] text-slate-500">
                  Trump
                </span>
                <span className="ml-1.5 max-w-24 truncate text-xs font-black leading-none tracking-wider text-slate-100 capitalize sm:max-w-32">
                  {currentRound.trumpSuit}
                </span>
                <span
                  className={`ml-1.5 text-sm leading-none ${
                    SUITE_META[currentRound.trumpSuit]?.color ?? 'text-slate-100'
                  }`}
                >
                  {SUITE_META[currentRound.trumpSuit]?.symbol ?? ''}
                </span>
              </div>
            )}
          </div>
          <div
            className="inline-flex h-8 items-center rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 leading-none shadow-[0_10px_30px_rgba(0,0,0,0.24)]
              backdrop-blur-xl"
          >
            <span className="text-[9px] font-black uppercase leading-none tracking-[0.24em] text-cyan-300/70">
              Round
            </span>
            <span
              className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400/10 px-1.5 text-xs font-black leading-none tabular-nums
            text-cyan-100"
            >
              {gameData.roundNumber}
            </span>
          </div>
        </div>
        <main className="mt-2 flex flex-col items-center">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <div className="relative w-53">
                  <div className="absolute -inset-2 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
                  <div className="relative rounded-full p-0.5 overflow-hidden">
                    <div
                      className="absolute inset-[-50%] animate-spin"
                      style={{
                        animationDuration: '4.2s',
                        background:
                          'conic-gradient(from 0deg, transparent 0%, rgb(6 182 212) 25%, transparent 50%, rgb(59 130 246) 75%, transparent 100%)',
                      }}
                    />
                    <div className="relative px-5 py-3 sm:py-4 rounded-full bg-slate-950/90 backdrop-blur-xl text-center overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.22)_0%,transparent_65%)]" />
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/60 to-transparent" />
                      <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
                        <span className="relative flex shrink-0">
                          <span className="absolute inline-flex h-2 w-2 rounded-full bg-cyan-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]" />
                        </span>
                        <div className="text-left leading-tight">
                          <p className="text-[10px] text-cyan-300/80 font-black uppercase tracking-[0.35em]">
                            {gameData.roundStatus}
                          </p>
                          <p className="mt-1 block max-w-34 truncate text-sm font-semibold tracking-wider text-cyan-200 bg-clip-text sm:max-w-38">
                            {gameData.statusText || `Waiting for ${currentPlayer}`}
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
                    key={idx}
                    player={player}
                    totalSeats={players.length}
                    seatIndex={idx}
                    playedCard={playedCards[player.name]}
                    isPlayerTurn={currentPlayer === player.name}
                    isTurnStarter={currentRound?.startPlayerIdx === idx}
                  />
                ))}
              </div>
            </div>
            <Border />
            <div className="mt-6 mb-2">
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
                    {playerHand.length}
                  </span>
                </div>
              </div>
              <div
                className="mt-3 sm:mt-4 px-3 sm:px-5 lg:px-6 py-4 min-h-40 sm:min-h-42 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[1.75rem]
                  sm:rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.5)] flex justify-center"
              >
                {playerHand.length === 0 ? (
                  <div className="min-h-28 flex items-center justify-center text-center px-4">
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em]">
                        Empty Hand
                      </p>
                      <p className="mt-2 text-sm sm:text-base font-black tracking-normal text-slate-200/90">
                        All cards played this round
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-3.5 pt-2 pb-2">
                    {playerHand.map((cardDetails, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={
                          gameData.roundStatus === BIDDING ||
                          !isPlayerTurn ||
                          (restrictedSuit !== '' && cardDetails.suit !== restrictedSuit)
                        }
                        className="rounded-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 transition-all
                          duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2
                        focus-visible:ring-offset-slate-950 ring-2 ring-cyan-400/35 shadow-[0_16px_35px_rgba(0,0,0,0.25)] enabled:hover:-translate-y-1
                          enabled:active:scale-[0.99] enabled:hover:ring-cyan-300/75 enabled:hover:shadow-[0_0_28px_rgba(6,182,212,0.18)] disabled:cursor-not-allowed
                          disabled:opacity-25 disabled:ring-0 disabled:shadow-none"
                        style={{
                          animationDelay: `${idx * 45}ms`,
                          animationFillMode: 'both',
                        }}
                        onClick={() => handleCardPlay(cardDetails)}
                      >
                        <PlayingCard
                          card={cardDetails}
                          size="md"
                          className="transition-transform duration-200"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      {openScorecardModal && (
        <div className="fixed inset-0 z-90 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
          <button
            onClick={() => setOpenScoreCardModal(false)}
            className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md"
            aria-label="Close scorecard"
          />
          <div
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[2.5rem] border border-white/5
            bg-slate-900/40 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-label="Scorecard"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.12)_0%,transparent_55%)]" />
            <div className="relative z-10 flex h-full min-h-0 flex-col p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                    Scorecard
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    Current Scores
                  </h3>
                </div>
                <button
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-all hover:bg-white/10
                  active:scale-95"
                  aria-label="Close modal"
                  onClick={() => setOpenScoreCardModal(false)}
                >
                  <X className="text-slate-300" size={18} />
                </button>
              </div>
              <div className="mt-7 flex-1 space-y-2 overflow-y-auto pr-1 sm:pr-2">
                {sortedPlayers.map((player, idx) => (
                  <div
                    key={player.name ?? idx}
                    className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${
                      idx === 0
                        ? 'border-cyan-500/20 bg-cyan-500/10'
                        : 'border-white/5 bg-slate-950/40'
                    }`}
                  >
                    {idx === 0 && (
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/50 to-transparent" />
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                            idx === 0
                              ? 'border-cyan-500/25 bg-cyan-500/15'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <User
                            size={18}
                            className={idx === 0 ? 'text-cyan-300' : 'text-slate-300'}
                          />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate font-black tracking-wide text-white">
                              {player.name}
                            </p>
                            {idx === 0 && (
                              <span
                                className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[8px] font-black uppercase
                                    tracking-[0.2em] text-cyan-200"
                              >
                                Lead
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                              Player
                            </p>
                            {(player.accumulated ?? 0) > 0 && (
                              <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5">
                                <span
                                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400/15 text-[9px] font-black leading-none
                                  text-amber-200"
                                >
                                  !
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200/70">
                                  Accum.
                                </span>
                                <span className="text-[10px] font-black tabular-nums text-amber-100">
                                  {player.accumulated}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 pl-2 text-right">
                        <p
                          className={`text-3xl font-black leading-none tabular-nums ${idx === 0 ? 'text-cyan-100' : 'text-white'}`}
                        >
                          {player.score}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                          Points
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {gameData.roundStatus === BIDDING && isPlayerTurn && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md" />
          <div
            className="w-full max-w-5xl relative z-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_30px_120px_rgba(0,0,0,0.65)]
              overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-label="Place your bid"
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.14)_0%,transparent_55%)]" />
            <div className="relative z-10 px-6 py-5 flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between px-3">
                <div className="min-w-0">
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 truncate">
                    Enter Your Bid
                  </h3>
                </div>
              </div>
              <div className="mt-7 grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 flex-1 min-h-0">
                <div className="lg:col-span-2">
                  <div className="p-5 sm:p-6 rounded-4xl bg-slate-950/35 border border-white/5 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em]">
                      Number of bids
                    </p>
                    <div className="mt-4">
                      <label className="sr-only" htmlFor="bidCount">
                        Enter number of bids
                      </label>
                      <input
                        id="bidCount"
                        type="number"
                        inputMode="numeric"
                        value={bidCount}
                        min={0}
                        max={playerHand.length}
                        placeholder="0"
                        onChange={(event) => setBidCount(event.target.value)}
                        className="w-full h-14 px-4 rounded-2xl bg-slate-950/60 border border-white/10 text-white font-black text-lg tracking-tight
                          focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500/30 transition
                          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
                          Max {playerHand.length}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                      <p className="text-xs text-slate-300/80 font-black leading-relaxed">
                        Bid how many tricks you expect to win this round.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!isBidValid}
                      onClick={handleUserBid}
                      className={`mt-5 w-full h-12 rounded-2xl border font-black tracking-tight flex items-center justify-center gap-2 transition-all duration-200 ${
                        isBidValid
                          ? 'bg-linear-to-r from-cyan-500 to-blue-600 border-transparent text-white hover:shadow-[0_0_22px_rgba(6,182,212,0.35)] active:scale-[0.99]'
                          : 'bg-linear-to-r from-cyan-500/30 to-blue-600/30 border-cyan-500/20 text-white/70 cursor-not-allowed'
                      }`}
                    >
                      Confirm Bid
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
                      {gameData.gameType}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
                      {gameData.variant}
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-3 flex flex-col min-h-0">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em]">
                        Your Hand
                      </p>
                      <h4 className="mt-1 text-lg sm:text-xl font-black tracking-tight">
                        All Cards Available
                      </h4>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-white/10 backdrop-blur-xl">
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                        Cards
                      </span>
                      <span className="text-sm font-black text-cyan-300 tabular-nums">
                        {playerHand.length}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex-1 min-h-0 rounded-4xl bg-slate-950/35 border border-white/5 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,0.45)] overflow-hidden">
                    <div className="p-4 sm:p-6 h-full min-h-0 overflow-y-auto">
                      {playerHand.length === 0 ? (
                        <div className="h-full min-h-40 flex items-center justify-center">
                          <p className="text-sm text-slate-400 font-black uppercase tracking-[0.3em]">
                            No cards yet
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-3 sm:hidden">
                            {playerHand.map((card, idx) => (
                              <div key={idx} className="flex justify-center">
                                <PlayingCard card={card} size="sm" />
                              </div>
                            ))}
                          </div>
                          <div className="hidden sm:grid lg:hidden grid-cols-4 gap-4">
                            {playerHand.map((card, idx) => (
                              <div key={idx} className="flex justify-center">
                                <PlayingCard card={card} size="sm" />
                              </div>
                            ))}
                          </div>
                          <div className="hidden lg:grid grid-cols-6 gap-4">
                            {playerHand.map((card, idx) => (
                              <div key={idx} className="flex justify-center">
                                <PlayingCard card={card} size="md" />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {gameData.roundStatus === SELECT_TRUMP_STATUS && isPlayerTurn && (
        <div className="fixed inset-0 z-60 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md" />
          <div
            className="w-full max-w-xl relative z-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-[0_30px_120px_rgba(0,0,0,0.65)]
              overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Choose trump suit"
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.12)_0%,transparent_55%)]" />
            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex items-start justify-center gap-4">
                <div className="min-w-0">
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 truncate">
                    Choose a Trump Suit
                  </h3>
                  <p className="mt-3 text-sm text-slate-300/80 font-black leading-relaxed tracking-wide">
                    Pick the suit that will dominate this round.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
                      {gameData.gameType}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
                      {gameData.variant}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {CARD_SUITS.map((suit, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="group relative rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-xl px-5 py-5 shadow-[0_18px_55px_rgba(0,0,0,0.45)]
                      transition-all duration-200 hover:bg-white/5 hover:border-white/15 active:scale-[0.99] text-left"
                    onClick={() => handleRoundTrump(suit)}
                  >
                    <div className="absolute inset-0 rounded-[inherit] ring-1 ring-black/10 pointer-events-none" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.35em]">
                          Suit
                        </p>
                        <p className="mt-1 text-lg sm:text-xl font-black tracking-tight text-white capitalize">
                          {suit}
                        </p>
                      </div>
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                          suit === HEART || suit === DIAMOND
                            ? 'bg-rose-500/10 border-rose-500/20'
                            : 'bg-slate-200/5 border-white/10'
                        }`}
                      >
                        <span
                          className={`text-3xl font-black leading-none ${SUITE_META[suit]?.color ?? ''}`}
                        >
                          {SUITE_META[suit]?.symbol ?? ''}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full w-0 group-hover:w-full transition-all duration-300 bg-linear-to-r from-cyan-500/60 to-blue-600/60" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {winnerNames.length > 0 && (
        <div className="fixed inset-0 z-70 grid place-items-center overflow-hidden p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-[#020617]/85 backdrop-blur-xl"
            aria-label="Close winner"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 motion-reduce:hidden"
          >
            <div className="absolute left-1/2 top-1/2 h-128 w-lg -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl motion-safe:animate-pulse" />
            {[
              'left-[8%] top-[14%] h-2 w-2 rounded-full bg-cyan-300/70 motion-safe:animate-ping',
              'left-[14%] top-[38%] h-1.5 w-7 rounded-full bg-white/30 motion-safe:animate-[spin_5s_linear_infinite]',
              'left-[18%] top-[72%] h-2 w-2 rounded-full bg-cyan-200/60 motion-safe:animate-ping',
              'left-[28%] top-[18%] h-1.5 w-6 rounded-full bg-cyan-300/30 motion-safe:animate-[spin_6s_linear_infinite]',
              'left-[36%] bottom-[10%] h-1.5 w-1.5 rounded-full bg-white/50 motion-safe:animate-ping',
              'left-[46%] top-[8%] h-2 w-2 rounded-full bg-cyan-100/60 motion-safe:animate-ping',
              'right-[8%] top-[18%] h-2 w-2 rounded-full bg-cyan-200/70 motion-safe:animate-ping',
              'right-[14%] top-[44%] h-1.5 w-8 rounded-full bg-cyan-300/30 motion-safe:animate-[spin_5.5s_linear_infinite]',
              'right-[18%] bottom-[16%] h-2 w-2 rounded-full bg-white/45 motion-safe:animate-ping',
              'right-[28%] top-[12%] h-1.5 w-7 rounded-full bg-white/25 motion-safe:animate-[spin_6.5s_linear_infinite]',
              'right-[38%] bottom-[9%] h-1.5 w-1.5 rounded-full bg-cyan-200/50 motion-safe:animate-ping',
              'right-[46%] top-[20%] h-2 w-2 rounded-full bg-cyan-300/50 motion-safe:animate-ping',
              'left-[10%] bottom-[24%] h-1.5 w-6 rounded-full bg-cyan-100/25 motion-safe:animate-[spin_7s_linear_infinite]',
              'right-[10%] bottom-[34%] h-1.5 w-6 rounded-full bg-white/25 motion-safe:animate-[spin_7.5s_linear_infinite]',
            ].map((className, index) => (
              <span
                key={index}
                className={`absolute ${className} shadow-[0_0_18px_rgba(103,232,249,0.35)]`}
                style={{
                  animationDelay: `${index * 140}ms`,
                  animationDuration: index % 2 === 0 ? '2.8s' : undefined,
                }}
              />
            ))}
          </div>
          <div
            className="relative z-10 w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-4xl sm:rounded-[2.5rem] border border-white/10 bg-slate-950/80
              shadow-[0_30px_120px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={winnerNames.length > 1 ? 'Winners' : 'Winner'}
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.18)_0%,transparent_55%)] motion-safe:animate-pulse" />
            <button
              onClick={onLeave}
              className="absolute right-5 top-5 z-20 w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center
          active:scale-95 transition-all"
              aria-label="Close modal"
            >
              <X className="text-slate-300 font-bold" size={18} />
            </button>
            <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10 text-center">
              <div
                className="relative mx-auto w-20 h-20 rounded-[1.75rem] border border-cyan-500/25 bg-cyan-500/10 flex items-center justify-center
            shadow-[0_20px_60px_rgba(6,182,212,0.18)]"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[1.75rem] border border-cyan-300/30 motion-safe:animate-ping motion-reduce:hidden"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-[-0.35rem] rounded-4xl bg-cyan-400/10 blur-xl motion-safe:animate-pulse motion-reduce:hidden"
                />
                <Crown
                  className="relative text-cyan-200 drop-shadow-[0_0_18px_rgba(103,232,249,0.65)] motion-safe:animate-pulse"
                  size={30}
                />
              </div>
              <p className="mt-6 text-xs font-black text-slate-500 uppercase tracking-[0.35em]">
                Game Over
              </p>
              <h3 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
                {winnerNames.includes(playerName)
                  ? winnerNames.length > 1
                    ? 'You Tied for the Win!'
                    : 'You Won!'
                  : winnerNames.length > 1
                    ? 'Winners'
                    : 'Winner'}
              </h3>
              <div className="relative mt-5 rounded-4xl bg-white/4 border border-white/10 backdrop-blur-xl py-6 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent motion-safe:animate-pulse" />
                <div
                  aria-hidden="true"
                  className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl motion-safe:animate-pulse motion-reduce:hidden"
                />
                <p className="relative text-2xl sm:text-3xl font-black tracking-tight text-balance">
                  {winnerNames.join(', ')}
                </p>
                <div className="relative mt-5 flex flex-col items-center justify-center gap-3">
                  <div className="flex flex-col justify-center items-center sm:flex-row gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-4 py-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                        Final Score
                      </span>
                      <span className="text-sm font-black text-white tabular-nums">
                        {winningPlayers[0]?.score}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/45 px-4 py-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                        Accumulated
                      </span>
                      <span className="text-sm font-black text-white tabular-nums">
                        {winningPlayers[0]?.accumulated}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.22em]
                      text-cyan-200"
                    >
                      {gameData.gameType}
                    </span>
                    <span
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.22em]
                      text-slate-300"
                    >
                      {gameData.variant}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <ActionButton variant="primary" onClick={onLeave} className="h-12">
                  Continue
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setOpenScoreCardModal(true);
                  }}
                  className="h-12"
                >
                  <BarChart3 size={18} className="text-cyan-300" />
                  View Stats
                </ActionButton>
                <ActionButton onClick={onLeave} variant="danger" className="h-12">
                  <LogOut size={18} />
                  Leave Game
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
