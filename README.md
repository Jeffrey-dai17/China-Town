# Chinatown Online

A real-time, server-authoritative adaptation of the 2014 Z-Man Games edition of *Chinatown* for 3-5 players. Voice chat is intentionally left to your call; the app handles the board, private cash, dealing, trades, placement, income, and final scoring.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Other players on the same network can open the Vite network URL and join with the room code or copied invite link.

## Production

```powershell
npm run build
npm start
```

The Express and Socket.IO server listens on `http://localhost:3001` by default and serves the production client. Set `PORT` to use another port.

Rooms live in server memory. Restarting the server clears active games. A reconnect token stored in each browser keeps a player's seat through ordinary connection drops.

## Public hosting and site password

`render.yaml` defines the app as a Render web service named `csuboardgame`. The generated service hostname contains no dashes and supports the app's long-lived Socket.IO connections.

Set `SITE_PASSWORD` as a secret environment variable on the host. When it is present, visitors must unlock the site before the client connects, and the server rejects unauthenticated Socket.IO connections. The password itself is never included in the browser bundle or committed source.

Render's free service can sleep after an idle period. Because rooms currently live only in server memory, a sleep, restart, or deployment clears active rooms.

## Checks

```powershell
npm test
npm run lint
npm run build
node scripts/smoke.mjs
```

The smoke test needs the production server running on port 3001 and Microsoft Edge installed. It drives three isolated browser sessions through room creation, private building selection, a cash-and-property trade, shop placement, income, and the next round.

## Rules basis

The implementation follows the 2014 rulebook: six rounds from 1965-1970, edition-specific deal tables, the physical board's 85 buildings, all 90 shop tiles, orthogonal business groups within district boundaries, simultaneous open trading, irreversible placement, and cash in $10,000 increments.

- [Official Z-Man Games rulebook](https://images.zmangames.com/filer_public/01/bf/01bfdafd-99f7-4cb0-b14d-2e5914854027/zm7044_chinatown_rules.pdf)
- [RulesPal rules reference](https://www.rulespal.com/chinatown/rulebook)

This is a fan-made implementation. No publisher graphics are included. The lobby scene and `public/assets/canal-street-board-original-v1.png` were generated specifically for this project from original prompts without published-game image inputs. Business symbols use the ISC-licensed Lucide icon set.
