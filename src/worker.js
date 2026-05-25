import { DurableObject } from 'cloudflare:workers'

const ID_RE = /^[a-z0-9]{6,12}$/

function randomId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

const WORLDS = [
  { id: 'hub', name: 'Hub World', description: 'The main lobby — platforms, ramps, and collectible coins', maxPlayers: 32, thumbnail: null },
]

export class RoomDO extends DurableObject {
  constructor(state, env) {
    super(state, env)
    this.players = new Map() // ws -> { id, position, rotation, avatar, name }
    this.messages = [] // last 50 chat messages
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.accept()

    const playerId = randomId()

    const playerData = {
      id: playerId,
      position: { x: 0, y: 2, z: 0 },
      rotation: { y: 0 },
      avatar: { head: '#f5c542', torso: '#4287f5', arms: '#f5c542', legs: '#2d5a27' },
      name: `Player_${playerId.slice(0, 4)}`,
    }

    this.players.set(server, playerData)

    // Send initial state to the new player
    this.send(server, {
      type: 'init',
      playerId,
      players: Array.from(this.players.values()).filter(p => p.id !== playerId),
      messages: this.messages.slice(-50),
    })

    // Notify others about the new player
    this.broadcast({ type: 'player_joined', player: playerData }, server)

    server.addEventListener('message', e => this.onMessage(server, e.data))
    server.addEventListener('close', () => this.onClose(server))
    server.addEventListener('error', () => this.onClose(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  onMessage(ws, data) {
    let msg
    try { msg = JSON.parse(data) } catch { return }

    const player = this.players.get(ws)
    if (!player) return

    if (msg.type === 'move') {
      player.position = msg.position
      player.rotation = msg.rotation
      this.broadcast({ type: 'player_moved', id: player.id, position: msg.position, rotation: msg.rotation }, ws)
      return
    }

    if (msg.type === 'chat') {
      const text = (msg.text || '').slice(0, 200)
      if (!text) return
      const chatMsg = { id: randomId(), playerId: player.id, name: player.name, text, timestamp: Date.now() }
      this.messages.push(chatMsg)
      if (this.messages.length > 100) this.messages = this.messages.slice(-50)
      this.broadcast({ type: 'chat', message: chatMsg })
      return
    }

    if (msg.type === 'avatar_update') {
      if (msg.avatar) {
        player.avatar = { ...player.avatar, ...msg.avatar }
      }
      if (msg.name) {
        player.name = msg.name.slice(0, 20)
      }
      this.broadcast({ type: 'player_updated', id: player.id, avatar: player.avatar, name: player.name })
      return
    }
  }

  onClose(ws) {
    const player = this.players.get(ws)
    if (player) {
      this.players.delete(ws)
      this.broadcast({ type: 'player_left', id: player.id })
    }
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)) } catch {}
  }

  broadcast(msg, except) {
    for (const [ws] of this.players) {
      if (ws !== except) this.send(ws, msg)
    }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    // POST /api/rooms/new — create a new room
    if (url.pathname === '/api/rooms/new') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      return Response.json({ roomId: randomId() })
    }

    // GET /api/worlds — list available worlds/experiences
    if (url.pathname === '/api/worlds') {
      return Response.json({ worlds: WORLDS })
    }

    // GET /api/rooms/{id}/ws — upgrade to WebSocket on the DO for this room
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/ws$/)
    if (wsMatch) {
      const id = wsMatch[1]
      if (!ID_RE.test(id)) return new Response('Invalid room id', { status: 400 })
      const doId = env.ROOM.idFromName(id)
      const obj = env.ROOM.get(doId)
      return obj.fetch(req)
    }

    // SPA routes — serve index.html for client-side routing
    if (url.pathname.startsWith('/world/') || url.pathname.startsWith('/avatar') || url.pathname === '/lobby') {
      url.pathname = '/'
      return env.ASSETS.fetch(new Request(url.toString(), req))
    }

    // Everything else: static asset (or SPA fallback via ASSETS binding)
    return env.ASSETS.fetch(req)
  },
}
