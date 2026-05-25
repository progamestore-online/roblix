# RobLix

A social game creation platform on ProGameStore — a Roblox-style experience where users build and play 3D worlds together.

- Subdomain: `roblix.progamestore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare Workers)

## Architecture

- `src/worker.js` — Cloudflare Worker with RoomDO Durable Object for multiplayer state
- `web/` — Vite + React + Three.js frontend (PWA)
- Three.js for 3D rendering (blocky avatar, platforms, coins)
- WebSocket for real-time multiplayer (position sync, chat)
- Third-person camera with WASD + space controls

## API Routes

- `POST /api/rooms/new` — create a new room, returns `{ roomId }`
- `GET /api/rooms/{id}/ws` — WebSocket upgrade for multiplayer
- `GET /api/worlds` — list available worlds/experiences

## Key Conventions

- MIT-licensed, no tracking
- Platform SDK: `@progamestore/games`
- Physics: simple AABB gravity (no external physics engine)
- Avatar: box geometries with configurable colors per body part
