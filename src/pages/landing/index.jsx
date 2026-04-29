import { useState } from 'react';

import { Blocks, LockKeyhole, ShieldCheck, Spade, User } from 'lucide-react';

import { GAME_TYPE } from '../../constants';

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const base =
    'relative overflow-hidden px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';
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
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({
  placeholder,
  value,
  onChange,
  label,
  icon: Icon,
  type = 'text',
  maxLength,
  autoCapitalize,
}) => (
  <div className="flex flex-col gap-2 w-full">
    {label && <label className="text-sm font-medium text-slate-400 ml-1">{label}</label>}
    <div className="relative group">
      {Icon && (
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors"
          size={20}
        />
      )}
      <input
        type={type}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize={autoCapitalize}
        autoComplete="off"
        autoCorrect="of"
        spellCheck={false}
        placeholder={placeholder}
        className="w-full bg-slate-900/40 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none
          focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all"
      />
    </div>
  </div>
);

export const LandingPage = ({ onCreateGame, onJoinGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [playerPin, setPlayerPin] = useState('');
  const [gameCode, setGameCode] = useState('');

  const formatAndSetPin = (value) =>
    setPlayerPin(
      String(value ?? '')
        .replace(/\D/g, '')
        .slice(0, 4)
    );

  const createHandler = (gameType) => onCreateGame(gameType, playerName, playerPin);

  return (
    <div className="min-h-screen text-white flex items-center justify-center p-4 sm:p-6 overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-500/10 rounded-full blur-[160px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[160px]" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-screen h-screen opacity-20 pointer-events-none
          bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-size-[40px_40px]"
      />
      <div className="w-full max-w-lg z-10 flex flex-col items-center gap-10">
        <header className="animate-in fade-in slide-in-from-top-6 duration-1000">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-6 group">
              <div className="relative w-18 h-18 bg-slate-950 border border-white/10 rounded-2xl flex items-center justify-center rotate-45 transition-transform duration-700 ease-in-out group-hover:rotate-135 group-hover:shadow-[0_0_20px_2px_rgba(6,182,212,0.4)]">
                <div className="-rotate-45 transition-transform duration-700 ease-in-out group-hover:rotate-[-135deg] flex items-center justify-center w-full h-full">
                  <img src="/logo.svg" className="w-14 h-14" />
                </div>
              </div>
            </div>
            <div className="relative">
              <h1 className="text-5xl font-black tracking-tighter text-white flex items-center gap-3">
                PRECISION
                <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-blue-500 pr-1">
                  BID
                </span>
              </h1>
              <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-linear-to-r from-transparent via-cyan-500/30 to-transparent" />
            </div>
          </div>
        </header>
        <div
          className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 px-6 py-6 sm:px-10 sm:py-8 rounded-4xl sm:rounded-[3rem] space-y-4 animate-in
            shadow-[0_30px_100px_rgba(0,0,0,0.5)] zoom-in-95 duration-700 delay-200 w-full sm:w-xl"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              label="Player Name"
              placeholder="Enter Name"
              value={playerName}
              onChange={setPlayerName}
              icon={User}
              maxLength={15}
            />
            <Input
              label="4-Digit PIN"
              placeholder="••••"
              value={playerPin}
              onChange={formatAndSetPin}
              icon={LockKeyhole}
              maxLength={4}
              type="password"
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
              New Game
            </label>
            <div className="grid grid-cols-2 gap-5">
              <button
                onClick={() => createHandler(GAME_TYPE.SPADES)}
                className="group flex flex-col items-center gap-4 p-5 rounded-3xl bg-slate-800/30 border border-white/5 hover:border-cyan-500/50
                hover:bg-cyan-500/10 transition-all duration-500"
              >
                <div className="p-4 bg-slate-900/60 rounded-2xl group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all shadow-inner">
                  <Spade size={32} className="text-slate-400 group-hover:text-cyan-400" />
                </div>
                <span className="font-black text-sm tracking-wide">SPADES</span>
              </button>
              <button
                onClick={() => createHandler(GAME_TYPE.BID_WHIST)}
                className="group flex flex-col items-center gap-4 p-5 rounded-3xl bg-slate-800/30 border border-white/5 hover:border-blue-500/50
                hover:bg-blue-500/10 transition-all duration-500"
              >
                <div className="p-4 bg-slate-900/60 rounded-2xl group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-inner">
                  <Blocks size={32} className="text-slate-400 group-hover:text-blue-400" />
                </div>
                <span className="font-black text-sm tracking-wide">BID WHIST</span>
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="px-4 text-slate-600 font-bold">Join Session</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Game Code"
              value={gameCode}
              onChange={(value) => setGameCode(String(value ?? '').toUpperCase())}
              icon={ShieldCheck}
              maxLength={6}
              autoCapitalize="characters"
            />
            <Button
              onClick={() => onJoinGame(gameCode, playerName, playerPin)}
              className="px-10 h-13 w-full sm:w-auto"
            >
              JOIN
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
