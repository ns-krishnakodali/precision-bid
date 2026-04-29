# Precision Bid

Precision Bid is a real-time multiplayer card game app for **Spades** and **Bid Whist** built with:

- **React + Vite + Tailwind CSS** for the frontend
- **Firebase Realtime Database** for live lobby and game state
- **Firebase Hosting** for deployment
- **Vitest** for service and utility tests

The app uses a room-based session model where each match is isolated under a unique `lobbyId`, while players join using a human-readable room code.

---

## System Design Overview

Each game session is stored under:

```txt
lobby/{lobbyId}
```

The Realtime Database acts as the single source of truth. Players subscribe to their lobby node, and game updates are written through service-layer functions and Firebase transactions where turn, round, scoring, and card state must stay consistent.

---

## Realtime Database Structure

```json
{
  "lobby": {
    "{lobbyId}": {
      "createdAt": 1000,
      "currentPlayerIdx": 0,
      "gameCode": "ABC123",
      "gameType": "Spades | Bid Whist",
      "host": "Player1",
      "players": {
        "{playerName}": {
          "accumulated": 0,
          "cards": [{ "suit": "spade", "value": "A" }],
          "isHost": true,
          "joinedAt": 1000,
          "name": "Player1",
          "orderIdx": 0,
          "pin": "0000",
          "score": 0
        }
      },
      "roundNumber": 1,
      "roundStatus": "Bidding | Game Status | New Turn | New Round | Selecting Suit | Game Over",
      "rounds": [
        {
          "currentTurn": 1,
          "players": {
            "{playerName}": {
              "bids": 1,
              "played": [{ "suit": "spade", "value": "A" }],
              "wins": 0
            }
          },
          "startPlayerIdx": 0,
          "trumpSuit": "spade"
        }
      ],
      "status": "WAITING | IN GAME | FINISHED | CANCELLED",
      "statusText": "",
      "variant": "Classic | Oh Hell | Uptown | Downtown | No Trump",
      "winnerNames": ["Player1"]
    }
  },
  "lobbyCodes": {
    "{ROOM_CODE}": "{lobbyId}"
  }
}
```

---

## Model Notes

### `lobby/{lobbyId}`

Represents one active game session, including lobby metadata, current game status, player order, active round data, and final winners.

### `players`

Stores each player by name. Player records include host status, PIN, score, accumulated penalties, order index, and current cards.

### `rounds`

Maintains round history. The latest round controls bidding, played cards, trick wins, trump suit, current turn, and the player who starts the turn.

### `lobbyCodes`

Maps public room codes to Firebase lobby IDs:

```txt
lobbyCodes/{ROOM_CODE} -> lobbyId
```

This keeps joins simple while avoiding direct use of generated Firebase keys in the UI.

---

## Concurrency Strategy

- Lobby joins and setup use targeted Firebase updates.
- Round, turn, card, trump, and score changes use Firebase transactions.
- The current lobby node is treated as authoritative state.
- Card dealing and score updates are centralized in service utilities rather than UI components.

---

## Local Development

### 1. Create Environment Variables

Create `.env` from `.env.example`:

```txt
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

---

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run tests
npm run preview
```

---

## Deploy to Firebase Hosting

```bash
npm run build
firebase deploy
```

The merge workflow also runs tests before building and deploying to Firebase Hosting.

---

## Design Strengths

- Isolated game sessions via `lobbyId`
- Human-readable room code lookup
- Real-time multiplayer state through Firebase Realtime Database
- Transaction-backed turn, round, and scoring updates
- Clear separation between UI, services, Firebase setup, constants, and utilities
- Focused service and utility test coverage
