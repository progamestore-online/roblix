import { DurableObject } from 'cloudflare:workers'

const ID_RE = /^[a-z0-9]{3,12}$/

function randomId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

const WORLDS = [
  { id: 'hub', name: 'Hub World', description: 'The main lobby — platforms, ramps, and collectible coins', maxPlayers: 32, thumbnail: null, type: 'hub' },
  { id: 'obby', name: 'Obby Course', description: 'Parkour obstacle course — jump your way to the top', maxPlayers: 16, thumbnail: null, type: 'obby' },
  { id: 'sandbox', name: 'Sandbox', description: 'Flat creative world — build anything you want', maxPlayers: 8, thumbnail: null, type: 'sandbox' },
]

const MAX_BLOCKS = 2000
const VALID_BLOCK_TYPES = new Set(['solid', 'lava', 'bounce', 'ice', 'glass'])

export class RoomDO extends DurableObject {
  constructor(state, env) {
    super(state, env)
    this.players = new Map()
    this.messages = []
    this.scores = new Map()
    this.blocks = new Map()
    this.obbyTimes = new Map() // playerId -> { name, time }
    this.loaded = false
  }

  async loadState() {
    if (this.loaded) return
    this.loaded = true
    const [storedBlocks, storedTimes] = await Promise.all([
      this.ctx.storage.get('blocks'),
      this.ctx.storage.get('obbyTimes'),
    ])
    if (storedBlocks) {
      for (const [key, data] of Object.entries(storedBlocks)) {
        // Backfill: older saved blocks lacked `blockType`; default to solid.
        if (!data.blockType) data.blockType = 'solid'
        this.blocks.set(key, data)
      }
    }
    if (storedTimes) {
      for (const [pid, data] of Object.entries(storedTimes)) {
        this.obbyTimes.set(pid, data)
      }
    }
  }

  async saveBlocks() {
    const obj = Object.fromEntries(this.blocks)
    await this.ctx.storage.put('blocks', obj)
  }

  async saveObbyTimes() {
    const obj = Object.fromEntries(this.obbyTimes)
    await this.ctx.storage.put('obbyTimes', obj)
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    await this.loadState()

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
      emote: null,
    }

    this.players.set(server, playerData)
    this.scores.set(playerId, 0)

    this.send(server, {
      type: 'init',
      playerId,
      players: Array.from(this.players.values()).filter(p => p.id !== playerId),
      messages: this.messages.slice(-50),
      leaderboard: this.getLeaderboard(),
      blocks: Array.from(this.blocks.entries()).map(([key, data]) => ({ key, ...data })),
      obbyTimes: this.getObbyTimes(),
    })

    this.broadcast({ type: 'player_joined', player: playerData }, server)

    server.addEventListener('message', e => this.onMessage(server, e.data))
    server.addEventListener('close', () => this.onClose(server))
    server.addEventListener('error', () => this.onClose(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  getLeaderboard() {
    const entries = []
    for (const [, player] of this.players) {
      entries.push({ id: player.id, name: player.name, coins: this.scores.get(player.id) || 0 })
    }
    entries.sort((a, b) => b.coins - a.coins)
    return entries.slice(0, 10)
  }

  getObbyTimes() {
    const entries = []
    for (const [id, data] of this.obbyTimes) {
      entries.push({ id, name: data.name, time: data.time })
    }
    entries.sort((a, b) => a.time - b.time)
    return entries.slice(0, 10)
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
      if (msg.avatar) player.avatar = { ...player.avatar, ...msg.avatar }
      if (msg.name) player.name = msg.name.slice(0, 20)
      this.broadcast({ type: 'player_updated', id: player.id, avatar: player.avatar, name: player.name })
      return
    }

    if (msg.type === 'coin_collected') {
      const count = Math.min(msg.count || 1, 10)
      const current = this.scores.get(player.id) || 0
      this.scores.set(player.id, current + count)
      this.broadcast({ type: 'leaderboard', leaderboard: this.getLeaderboard() })
      return
    }

    if (msg.type === 'emote') {
      const emote = ['wave', 'dance', 'sit', 'cheer'].includes(msg.emote) ? msg.emote : null
      player.emote = emote
      this.broadcast({ type: 'player_emote', id: player.id, emote })
      return
    }

    if (msg.type === 'block_place') {
      if (this.blocks.size >= MAX_BLOCKS) return
      const { x, y, z, color, blockType } = msg
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return
      const key = `${x},${y},${z}`
      if (this.blocks.has(key)) return
      const safeType = VALID_BLOCK_TYPES.has(blockType) ? blockType : 'solid'
      const safeColor = typeof color === 'number' ? color : 0x1e88e5
      this.blocks.set(key, { x, y, z, color: safeColor, blockType: safeType })
      this.broadcast({ type: 'block_placed', x, y, z, color: safeColor, blockType: safeType }, ws)
      this.saveBlocks()
      return
    }

    if (msg.type === 'block_remove') {
      const { x, y, z } = msg
      const key = `${x},${y},${z}`
      if (!this.blocks.has(key)) return
      this.blocks.delete(key)
      this.broadcast({ type: 'block_removed', x, y, z }, ws)
      this.saveBlocks()
      return
    }

    if (msg.type === 'obby_finish') {
      const time = Number(msg.time)
      if (!Number.isFinite(time) || time <= 0 || time > 600) return
      const existing = this.obbyTimes.get(player.id)
      if (!existing || time < existing.time) {
        this.obbyTimes.set(player.id, { name: player.name, time })
        this.broadcast({ type: 'obby_times', obbyTimes: this.getObbyTimes() })
        this.saveObbyTimes()
        const chatMsg = {
          id: randomId(), playerId: player.id, name: 'system',
          text: `🏁 ${player.name} finished in ${time.toFixed(2)}s${!existing ? '' : ' (new PB!)'}`,
          timestamp: Date.now(),
        }
        this.messages.push(chatMsg)
        this.broadcast({ type: 'chat', message: chatMsg })
      }
      return
    }
  }

  onClose(ws) {
    const player = this.players.get(ws)
    if (player) {
      this.scores.delete(player.id)
      this.players.delete(ws)
      this.broadcast({ type: 'player_left', id: player.id })
      this.broadcast({ type: 'leaderboard', leaderboard: this.getLeaderboard() })
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

    if (url.pathname === '/api/rooms/new') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      return Response.json({ roomId: randomId() })
    }

    if (url.pathname === '/api/worlds') {
      return Response.json({ worlds: WORLDS })
    }

    const wsMatch = url.pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/ws$/)
    if (wsMatch) {
      const id = wsMatch[1]
      if (!ID_RE.test(id)) return new Response('Invalid room id', { status: 400 })
      const doId = env.ROOM.idFromName(id)
      const obj = env.ROOM.get(doId)
      return obj.fetch(req)
    }

    if (url.pathname.startsWith('/world/') || url.pathname.startsWith('/avatar') || url.pathname === '/lobby') {
      url.pathname = '/'
      return env.ASSETS.fetch(new Request(url.toString(), req))
    }

    return env.ASSETS.fetch(req)
  },
}
