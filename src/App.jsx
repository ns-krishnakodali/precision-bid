import { useCallback, useEffect, useState } from 'react';

import { GAME_STATE } from './constants';
import { ArenaPage, LobbyPage, LandingPage } from './pages';
import { clientService, lobbyService } from './services';

const App = () => {
  const [user] = useState(() => ({ uid: clientService.getOrCreateClientId() }));
  const [view, setView] = useState(GAME_STATE.LANDING);
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerPin, setPlayerPin] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [error, setError] = useState('');
  const [lobbyId, setLobbyId] = useState('');

  useEffect(() => {
    if (!user || !lobbyId) return undefined;

    const unsubscribe = lobbyService.subscribeToLobby({
      lobbyId,
      onChange: (data) => {
        if (!data) {
          setView(GAME_STATE.LANDING);
          setGameData(null);
          setError('Game session has ended.');
          return;
        }

        const playersObject = data.players ?? {};
        const players = Object.values(playersObject).sort((a, b) => {
          const hostDiff = Number(Boolean(b.isHost)) - Number(Boolean(a.isHost));
          if (hostDiff !== 0) return hostDiff;
          return String(a.name ?? '').localeCompare(String(b.name ?? ''));
        });

        setGameData({ ...data, id: data.gameCode, players });
        if (data.status === 'playing') setView(GAME_STATE.GAME);
      },
      onError: (dbErr) => {
        console.error('RTDB sync error:', dbErr);
        setError('Database connection lost.');
      },
    });

    return () => unsubscribe?.();
  }, [lobbyId, user]);

  const handleCreateGame = useCallback(
    async (type) => {
      if (!user) return setError('Authenticating... please wait.');
      if (!playerName.trim()) return setError('Please enter your name');
      if (playerPin.length !== 4) return setError('Please enter your 4-digit pin');
      setLoading(true);
      setError('');

      try {
        const { gameCode: createdGameCode, lobbyId: createdLobbyId } =
          await lobbyService.createGameSession({
            playerId: user.uid,
            playerName,
            playerPin,
            type,
          });

        setGameCode(createdGameCode);
        setLobbyId(createdLobbyId);
        setView(GAME_STATE.LOBBY);
      } catch (createErr) {
        console.error('Create error:', createErr);
        setError('Failed to create game. Permission error.');
      } finally {
        setLoading(false);
      }
    },
    [playerName, playerPin, user]
  );

  const handleJoinGame = useCallback(async () => {
    if (!user) return setError('Authenticating... please wait.');
    if (!playerName.trim()) return setError('Please enter your name');
    if (playerPin.length !== 4) return setError('Please enter your 4-digit pin');
    if (!gameCode.trim()) return setError('Please enter a game code');
    setLoading(true);
    setError('');

    try {
      const normalizedGameCode = gameCode.trim().toUpperCase();
      const { error: joinError, lobbyId: foundLobbyId } = await lobbyService.joinGameSession({
        gameCode: normalizedGameCode,
        playerId: user.uid,
        playerName,
        playerPin,
      });

      if (joinError) {
        setError(joinError);
        setLoading(false);
        return;
      }

      setLobbyId(foundLobbyId);
      setView(GAME_STATE.LOBBY);
    } catch (joinErr) {
      console.error('Join error:', joinErr);
      setError('Failed to join game.');
    } finally {
      setLoading(false);
    }
  }, [gameCode, playerName, playerPin, user]);

  const handleUpdateVariant = useCallback(
    async (variant) => {
      if (!user || gameData?.hostId !== user.uid) return;
      try {
        await lobbyService.updateVariant({ lobbyId, variant });
      } catch {
        setError('Failed to update settings.');
      }
    },
    [gameData?.hostId, lobbyId, user]
  );

  const handleStartGame = useCallback(async () => {
    if (!user) return;
    if (gameData.players.length < gameData.minPlayers) {
      setError(`Need at least ${gameData.minPlayers} players to start.`);
      return;
    }
    try {
      await lobbyService.startGame({ lobbyId });
    } catch {
      setError('Failed to start game.');
    }
  }, [gameData, lobbyId, user]);

  const handleLeave = useCallback(() => {
    setView(GAME_STATE.LANDING);
    setGameData(null);
    setLobbyId('');
    setError('');
  }, []);

  return (
    <div className="font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {view === GAME_STATE.LANDING && (
        <LandingPage
          error={error}
          gameCode={gameCode}
          loading={loading}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          playerName={playerName}
          playerPin={playerPin}
          setGameCode={setGameCode}
          setPlayerName={setPlayerName}
          setPlayerPin={setPlayerPin}
        />
      )}
      {view === GAME_STATE.LOBBY && gameData && user && (
        <LobbyPage
          error={error}
          gameData={gameData}
          onLeave={handleLeave}
          onStartGame={handleStartGame}
          onUpdateVariant={handleUpdateVariant}
          user={user}
        />
      )}

      {view === GAME_STATE.GAME && <ArenaPage onAbortToLobby={() => setView(GAME_STATE.LOBBY)} />}
    </div>
  );
};

export default App;
