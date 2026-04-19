import { Club, Diamond, Heart, Spade } from 'lucide-react';

import { LOADING_MESSAGES } from '../../constants';

const loadingMessage = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];

const styles = `
  @keyframes card-flip {
    0%, 20%   { transform: rotateY(0deg); }
    25%, 45%  { transform: rotateY(90deg); }
    50%, 70%  { transform: rotateY(180deg); }
    75%, 95%  { transform: rotateY(270deg); }
    100%     { transform: rotateY(360deg); }
  }
  .card-flipper {
    animation: card-flip 3s ease-in-out infinite;
    transform-style: preserve-3d;
  }
  .card-face {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
`;

export const Loading = () => (
  <>
    <style>{styles}</style>
    <div className="h-svh flex items-center justify-center text-cyan-400">
      <div className="text-center space-y-8">
        <div className="relative w-24 h-32 mx-auto" style={{ perspective: '1200px' }}>
          <div className="card-flipper relative w-full h-full">
            <div
              className="card-face absolute inset-0 flex items-center justify-center rounded-lg border-2 border-cyan-400 bg-slate-900"
              style={{ transform: 'rotateY(0deg) translateZ(48px)' }}
            >
              <Spade size={48} />
            </div>
            <div
              className="card-face absolute inset-0 flex items-center justify-center rounded-lg border-2 border-rose-400 bg-slate-900 text-rose-400"
              style={{ transform: 'rotateY(90deg) translateZ(48px)' }}
            >
              <Heart size={48} />
            </div>
            <div
              className="card-face absolute inset-0 flex items-center justify-center rounded-lg border-2 border-rose-400 bg-slate-900 text-rose-400"
              style={{ transform: 'rotateY(180deg) translateZ(48px)' }}
            >
              <Diamond size={48} />
            </div>
            <div
              className="card-face absolute inset-0 flex items-center justify-center rounded-lg border-2 border-cyan-400 bg-slate-900"
              style={{ transform: 'rotateY(270deg) translateZ(48px)' }}
            >
              <Club size={48} />
            </div>
          </div>
        </div>
        <p className="text-xl md:text-2xl font-black italic uppercase">{loadingMessage}</p>
      </div>
    </div>
  </>
);
