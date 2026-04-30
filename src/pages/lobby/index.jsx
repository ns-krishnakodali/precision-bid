import { useEffect, useRef, useState } from 'react';

import {
  Blocks,
  Bolt,
  Bot,
  CircleHelp,
  Check,
  ChevronRight,
  Copy,
  LogOut,
  Loader2,
  ShieldCheck,
  ShieldUser,
  Spade,
  User,
  Users,
  X,
} from 'lucide-react';

import {
  BID_WHIST_VARIANT,
  CLUB,
  GAME_CONFIG,
  GAME_TYPE,
  SPADE,
  SPADES_VARIANT,
  SUITE_META,
  VARIANT_VERSIONS,
} from '../../constants';
import { lobbyService } from '../../services';

const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  loading = false,
}) => {
  const base =
    'relative overflow-hidden px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ' +
    'disabled:cursor-not-allowed';
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
  lobbyId,
  gameData,
  playerName,
  onLeave,
  onStartGame,
  onVariantChange,
}) => {
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [removingBotName, setRemovingBotName] = useState('');
  const [openGameInfoModal, setOpenGameInfoModal] = useState(false);

  const codeCopiedTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (codeCopiedTimeoutRef.current) {
        clearTimeout(codeCopiedTimeoutRef.current);
      }
    };
  }, []);

  const isHost = gameData?.host === playerName;
  const selectedVariant = gameData?.variant ?? '';
  const gameVariants =
    gameData?.gameType === GAME_TYPE.SPADES
      ? Object.values(SPADES_VARIANT)
      : Object.values(BID_WHIST_VARIANT);

  const minPlayers = GAME_CONFIG[gameData.gameType]?.minPlayers;
  const maxPlayers = GAME_CONFIG[gameData.gameType]?.maxPlayers;
  const isSpadesMode = gameData?.gameType === GAME_TYPE.SPADES;
  const canAddBot = isHost && gameData.players.length < maxPlayers;

  const showCodeCopied = () => {
    setIsCodeCopied(true);

    if (codeCopiedTimeoutRef.current) {
      clearTimeout(codeCopiedTimeoutRef.current);
    }

    codeCopiedTimeoutRef.current = setTimeout(() => {
      setIsCodeCopied(false);
      codeCopiedTimeoutRef.current = null;
    }, 900);
  };

  const copyCode = async () => {
    if (!gameData?.code) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gameData.code);
        showCodeCopied();
        return;
      }

      const dummy = document.createElement('textarea');
      document.body.appendChild(dummy);
      dummy.value = gameData.code;
      dummy.select();
      const didCopy = document.execCommand('copy');
      document.body.removeChild(dummy);

      if (didCopy) {
        showCodeCopied();
        return;
      }

      console.error('Failed to copy game code');
    } catch (err) {
      console.error('Failed to copy game code', err);
    }
  };

  const handleSelectVariant = (gameVariant) => {
    if (!isHost) return;
    onVariantChange(gameVariant);
  };

  const handleLeaveGame = async () => {
    try {
      await lobbyService.removePlayer(lobbyId, playerName);
      onLeave();
    } catch (err) {
      console.error('Leave game error:', err);
    }
  };

  const handleAddBot = async () => {
    if (!canAddBot) return;

    setIsAddingBot(true);
    try {
      await lobbyService.addBot(lobbyId);
    } catch (err) {
      console.error('Add bot error:', err);
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleRemoveBot = async (botName) => {
    if (!isHost) return;

    setRemovingBotName(botName);
    try {
      await lobbyService.removePlayer(lobbyId, botName);
    } catch (err) {
      console.error('Remove bot error:', err);
    } finally {
      setRemovingBotName('');
    }
  };

  return (
    <div className="min-h-screen text-white p-6 md:p-8 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-start relative z-10">
        <div className="md:col-span-7 space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-3 sm:gap-0 px-2 py-4 sm:py-0">
            <div>
              <h2 className="text-3xl font-black flex items-center gap-3">
                <Users className="text-cyan-400" size={32} />
                Waiting Room
              </h2>
              <p className="text-xs text-center sm:text-start text-slate-500 font-bold uppercase tracking-widest mt-1.5">
                Synchronizing Players
              </p>
            </div>
            <div
              onClick={copyCode}
              className="flex items-center gap-4 bg-slate-900/60 border border-white/5 px-5 py-3 rounded-2xl cursor-pointer hover:border-cyan-500/40
                transition-all group shadow-xl"
            >
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] text-slate-600 uppercase font-black tracking-tighter">
                  Game Code
                </span>
                <span className="text-2xl font-mono font-black text-cyan-500 leading-none">
                  {gameData.code}
                </span>
              </div>
              <div
                className={`rounded-lg group-active:scale-90 transition-all relative w-10 h-10 flex items-center justify-center ${
                  isCodeCopied
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-slate-800 group-hover:bg-cyan-500/20'
                }`}
              >
                <Check
                  size={20}
                  className={`absolute text-emerald-400 transition-all duration-200 ${
                    isCodeCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                  }`}
                />
                <Copy
                  size={20}
                  className={`absolute text-slate-400 group-hover:text-cyan-400 transition-all duration-200 ${
                    isCodeCopied ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            {gameData.players.map((player, idx) => (
              <div
                key={player.name}
                className={`group flex items-center gap-5 p-4 rounded-4xl bg-slate-900/40 border border-white/5 backdrop-blur-xl animate-in slide-in-from-bottom-4
                  duration-500 delay-${idx * 100}`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:rotate-3
                    ${
                      player.isHost
                        ? 'bg-linear-to-br from-cyan-400 to-blue-600 text-white'
                        : player.isBot
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-400/20'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                >
                  {player.isHost ? (
                    <ShieldUser size={32} />
                  ) : player.isBot ? (
                    <Bot size={28} />
                  ) : (
                    <User size={28} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-black flex items-center gap-2 flex-wrap">
                    <span className="truncate">{player.name}</span>
                    {player.name === playerName && (
                      <span
                        className="shrink-0 text-[9px] bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-full text-cyan-400 uppercase font-black
                          tracking-tighter"
                      >
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">
                    {player.isHost ? 'Host' : player.isBot ? 'Bot' : 'Player'}
                  </div>
                </div>
                <div
                  className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-500 font-black
                    whitespace-nowrap hidden sm:block"
                >
                  CONNECTED
                </div>
                {isHost && player.isBot && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBot(player.name)}
                    disabled={removingBotName === player.name}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300
                      transition-all hover:border-rose-400/35 hover:bg-rose-500/15 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Remove ${player.name}`}
                    title={`Remove ${player.name}`}
                  >
                    {removingBotName === player.name ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <X size={16} />
                    )}
                  </button>
                )}
              </div>
            ))}
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
                style={{ width: `${(gameData.players.length / maxPlayers) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="md:col-span-5 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
            <div className="space-y-6 relative z-10">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <Bolt size={18} /> Game Settings
              </h3>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-cyan-500/80 uppercase tracking-widest ml-1">
                  Mode
                </p>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5 flex items-center gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1 group">
                    <div className="p-3 bg-cyan-500/10 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                      {isSpadesMode ? (
                        <Spade className="text-cyan-400" />
                      ) : (
                        <Blocks className="text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-lg capitalize tracking-tight">
                        {isSpadesMode ? GAME_TYPE.SPADES : GAME_TYPE.BID_WHIST}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold leading-tight">
                        {isSpadesMode
                          ? 'Partner-based trick taking.'
                          : 'Dynamic bidding and suit selection.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenGameInfoModal(true)}
                    className="h-10 w-10 shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/15 
                      hover:border-cyan-300/30 transition-all duration-200 flex items-center justify-center active:scale-95"
                    aria-label={`Open ${isSpadesMode ? GAME_TYPE.SPADES : GAME_TYPE.BID_WHIST} mode guide`}
                  >
                    <CircleHelp size={18} />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-cyan-500/80 uppercase tracking-widest ml-1">
                  Variant Rules
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {gameVariants.map((gameVariant) => (
                    <button
                      key={gameVariant}
                      onClick={() => handleSelectVariant(gameVariant)}
                      disabled={!isHost}
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                        selectedVariant === gameVariant
                          ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/20'
                      }`}
                    >
                      <span className="capitalize font-black tracking-wide">
                        {gameVariant}
                        {VARIANT_VERSIONS[gameVariant] && ` (${VARIANT_VERSIONS[gameVariant]})`}
                      </span>
                      {selectedVariant === gameVariant ? (
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
            <div className="mt-6 space-y-4">
              {isHost ? (
                <>
                  <Button
                    variant="secondary"
                    className="w-full h-14"
                    disabled={!canAddBot}
                    loading={isAddingBot}
                    onClick={handleAddBot}
                  >
                    <Bot size={20} className="shrink-0 mr-1" />
                    <span className="text-sm tracking-[0.32em] font-black uppercase">Add Bot</span>
                  </Button>
                  <Button
                    className="w-full h-16"
                    disabled={gameData.players.length < minPlayers}
                    onClick={() => onStartGame(selectedVariant)}
                  >
                    <span className="inline-flex items-center gap-2 leading-none">
                      <span className="font-black uppercase text-xl tracking-widest">
                        START GAME
                      </span>
                      <ChevronRight className="shrink-0 translate-y-px group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center p-6 rounded-4xl bg-cyan-500/5 border border-cyan-500/10">
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
                onClick={handleLeaveGame}
                className="w-full text-xs font-black text-slate-600 hover:text-rose-500 transition-colors uppercase tracking-[0.3em] flex items-center
                  justify-center gap-2"
              >
                <LogOut size={12} /> Leave Session
              </button>
            </div>
          </div>
        </div>
      </div>
      {openGameInfoModal && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            onClick={() => setOpenGameInfoModal(false)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
            aria-label="Close game guide"
          />
          <div
            className="relative z-10 w-full max-w-xl max-h-[min(680px,calc(100dvh-3rem))] overflow-hidden rounded-4xl border border-cyan-400/20 bg-slate-950/80
              shadow-[0_35px_120px_rgba(6,182,212,0.18)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={`${isSpadesMode ? GAME_TYPE.SPADES : GAME_TYPE.BID_WHIST} game information`}
          >
            <div className="pointer-events-none absolute -right-24 top-20 h-44 w-44 rounded-full bg-blue-600/20 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_32%,rgba(6,182,212,0.08)_100%)]" />
            <div className="relative z-10">
              <div className="relative overflow-hidden border-b border-white/10 px-5 py-4 sm:px-6">
                <div className="absolute right-6 top-3 text-[5.5rem] font-black leading-none text-white/2.5">
                  {isSpadesMode ? SUITE_META[SPADE].symbol : SUITE_META[CLUB].symbol}
                </div>
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-3xl bg-cyan-400/30 blur-xl" />
                      <div
                        className="relative flex h-13 w-13 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10
                          shadow-[inset_0_0_20px_rgba(6,182,212,0.12)]"
                      >
                        {isSpadesMode ? (
                          <Spade className="text-cyan-200" size={28} />
                        ) : (
                          <Blocks className="text-cyan-200" size={28} />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-300/70">
                        Quick Rules
                      </p>
                      <h3 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                        {isSpadesMode ? GAME_TYPE.SPADES : GAME_TYPE.BID_WHIST}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenGameInfoModal(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all
                      hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-200 active:scale-95"
                    aria-label="Close modal"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div className="px-5 py-4 sm:px-6">
                {isSpadesMode ? (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-2.5 text-center">
                        <p className="text-base font-black text-white">
                          {GAME_CONFIG[GAME_TYPE.SPADES]?.maxPlayers}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                          Players
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-2.5 text-center">
                        <p className="text-base font-black text-white">2</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                          Teams
                        </p>
                      </div>
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-center">
                        <p className="text-base font-black text-cyan-200">♠</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-cyan-300/70">
                          Trump
                        </p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
                      <p className="text-xs text-center font-bold leading-relaxed text-slate-100">
                        Win tricks with your partner. Spades are trump. Teams are picked randomly.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">
                        Variants
                      </p>
                      <div className="grid gap-2">
                        <div
                          className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/60 px-4 py-3 transition-all
                          hover:border-cyan-300/30 hover:bg-slate-900"
                        >
                          <div className="absolute right-4 top-2 text-3xl font-black text-white/3">
                            01
                          </div>
                          <p className="text-sm font-black text-white">{SPADES_VARIANT.OH_HELL}</p>
                          <p className="mt-0.5 text-xs font-bold text-slate-400">
                            13 rounds total. nth Round n tricks, until 13.
                          </p>
                        </div>
                        <div
                          className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/60 px-4 py-3 transition-all
                          hover:border-cyan-300/30 hover:bg-slate-900"
                        >
                          <div className="absolute right-4 top-2 text-3xl font-black text-white/3">
                            02
                          </div>
                          <p className="text-sm font-black text-white">{SPADES_VARIANT.CLASSIC}</p>
                          <p className="mt-0.5 text-xs font-bold text-slate-400">
                            1 round total. All 13 tricks are played in a single round.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-2.5 text-center">
                        <p className="text-base font-black text-white">
                          {`${GAME_CONFIG[GAME_TYPE.BID_WHIST]?.minPlayers} - ${GAME_CONFIG[GAME_TYPE.BID_WHIST]?.maxPlayers}`}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                          Players
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-2.5 text-center">
                        <p className="text-base font-black text-white">Bid</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                          First
                        </p>
                      </div>
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-center">
                        <p className="text-base font-black text-cyan-200">Lead</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-cyan-300/70">
                          Winner
                        </p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
                      <p className="text-xs text-center font-bold leading-relaxed text-slate-100">
                        Bid to control the round. Highest bidder leads, then everyone fights for
                        tricks.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">
                        Variants
                      </p>
                      <div className="grid gap-2">
                        <div
                          className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/60 px-4 py-3 transition-all
                          hover:border-cyan-300/30 hover:bg-slate-900"
                        >
                          <div className="absolute right-4 top-2 text-3xl font-black text-white/3">
                            ↑
                          </div>
                          <p className="text-sm font-black text-white">
                            {BID_WHIST_VARIANT.UPTOWN}
                          </p>
                          <p className="mt-0.5 text-xs font-bold text-slate-400">
                            {' '}
                            Highest card in the led suit wins the trick.
                          </p>
                        </div>
                        <div
                          className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/60 px-4 py-3 transition-all
                          hover:border-cyan-300/30 hover:bg-slate-900"
                        >
                          <div className="absolute right-4 top-2 text-3xl font-black text-white/3">
                            ↓
                          </div>
                          <p className="text-sm font-black text-white">
                            {BID_WHIST_VARIANT.DOWNTOWN}
                          </p>
                          <p className="mt-0.5 text-xs font-bold text-slate-400">
                            Lowest card in the led suit wins the trick.
                          </p>
                        </div>
                        <div
                          className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/60 px-4 py-3 transition-all
                          hover:border-cyan-300/30 hover:bg-slate-900"
                        >
                          <div className="absolute right-4 top-2 text-3xl font-black text-white/3">
                            Ø
                          </div>
                          <p className="text-sm font-black text-white">
                            {BID_WHIST_VARIANT.NO_TRUMP.trim()}
                          </p>
                          <p className="mt-0.5 text-xs font-bold text-slate-400">
                            No trump suit. Follow the led suit to win tricks.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-6 mb-3 flex items-center justify-center">
                  <Button
                    variant="primary"
                    className="h-12 flex-1 max-w-80"
                    onClick={() => setOpenGameInfoModal(false)}
                  >
                    <span className="text-[18px] font-black uppercase tracking-widest">Got It</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
