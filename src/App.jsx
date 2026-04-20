import { useCallback, useEffect, useState } from 'react';

import { Loading, Toaster } from './components';
import { GAME_CONFIG, GAME_STATE, LOBBY_STATUS } from './constants';
import { GameArenaPage, LobbyPage, LandingPage } from './pages';
import { lobbyService } from './services';

const App = () => {
  const [view, setView] = useState(GAME_STATE.LANDING);
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [lobbyId, setLobbyId] = useState('');
  const [toast, setToast] = useState(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback(({ message, type = 'info' }) => {
    const trimmedMessage = String(message ?? '').trim();
    if (!trimmedMessage) return;

    setToast({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      message: trimmedMessage,
      type,
    });
  }, []);

  useEffect(() => {
    if (!lobbyId) return undefined;

    const unsubscribe = lobbyService.subscribeToLobby({
      lobbyId,
      onChange: (data) => {
        if (!data) {
          setView(GAME_STATE.LANDING);
          setGameData(null);
          setLobbyId('');
          showToast({ message: 'Game session has ended.', type: 'info' });
          return;
        }

        const playersObject = data.players ?? {};
        const players = Object.values(playersObject).sort((p1, p2) => {
          if (p1.isHost && !p2.isHost) return -1;
          if (!p1.isHost && p2.isHost) return 1;
          return p1.joinedAt - p2.joinedAt;
        });

        setGameData({ ...data, code: data.gameCode, players });
        if (data.status === LOBBY_STATUS.IN_GAME) setView(GAME_STATE.GAME);
      },
      onError: (dbErr) => {
        console.error('RTDB sync error:', dbErr);
        showToast({ message: 'Database connection lost.', type: 'error' });
      },
    });

    return () => unsubscribe?.();
  }, [lobbyId, showToast]);

  const handleCreateGame = async (gameType, pName, playerPin) => {
    if (!String(pName ?? '').trim()) {
      showToast({ message: 'Please enter your name', type: 'error' });
      return;
    }
    if (String(playerPin ?? '').length !== 4) {
      showToast({ message: 'Please enter your 4-digit pin', type: 'error' });
      return;
    }

    setPlayerName(pName);
    setLoading(true);

    try {
      const { gameCode: createdGameCode, lobbyId: newLobbyId } =
        await lobbyService.createGameSession(pName, playerPin, gameType);

      setLobbyId(newLobbyId);
      setView(GAME_STATE.LOBBY);
      showToast({ message: `Game created. Code: ${createdGameCode}`, type: 'success' });
    } catch (createErr) {
      console.error('Create error:', createErr);
      showToast({ message: 'Failed to create game.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (newGameCode, pName, playerPin) => {
    if (!String(pName ?? '').trim()) {
      showToast({ message: 'Please enter your name', type: 'error' });
      return;
    }
    if (String(playerPin ?? '').length !== 4) {
      showToast({ message: 'Please enter your 4-digit pin', type: 'error' });
      return;
    }
    if (!String(newGameCode ?? '').trim()) {
      showToast({ message: 'Please enter a game code', type: 'error' });
      return;
    }

    setPlayerName(pName);
    setLoading(true);

    try {
      const { error: joinError, lobbyId: foundLobbyId } = await lobbyService.joinGameSession(
        newGameCode,
        pName,
        playerPin
      );

      if (joinError) {
        showToast({ message: joinError, type: 'error' });
        return;
      }

      setLobbyId(foundLobbyId);
      setView(GAME_STATE.LOBBY);
      showToast({ message: 'Joined lobby.', type: 'success' });
    } catch (joinErr) {
      console.error('Join error:', joinErr);
      showToast({ message: 'Failed to join game.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async (variant) => {
    if (!variant) {
      showToast({
        message: 'Select a game variant.',
        type: 'error',
      });
      return;
    }

    const minPlayers = GAME_CONFIG[gameData?.gameType]?.minPlayers;
    if (gameData.players.length < minPlayers) {
      showToast({
        message: `Need at least ${minPlayers} players to start.`,
        type: 'error',
      });
      return;
    }
    try {
      await lobbyService.startGame(lobbyId, variant);
    } catch {
      showToast({ message: 'Failed to start game.', type: 'error' });
    }
  };

  const handleLeave = () => {
    setView(GAME_STATE.LANDING);
    setGameData(null);
    setLobbyId('');
    setToast(null);
  };

  if (loading) return <Loading />;

  return (
    <div className="font-sans antialiased bg-[#020617] selection:bg-cyan-500 selection:text-white">
      <Toaster toast={toast} onDismiss={dismissToast} />
      {view === GAME_STATE.LANDING && (
        <LandingPage onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
      )}
      {view === GAME_STATE.LOBBY && gameData && (
        <LobbyPage
          gameData={gameData}
          playerName={playerName}
          onLeave={handleLeave}
          onStartGame={handleStartGame}
        />
      )}
      {view === GAME_STATE.GAME && (
        <GameArenaPage onAbortToLobby={() => setView(GAME_STATE.LOBBY)} />
      )}
    </div>
  );
};

export default App;
