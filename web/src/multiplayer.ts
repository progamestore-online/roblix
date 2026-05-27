import type { AvatarColors } from './App.tsx'

export interface RemotePlayer {
  id: string
  position: { x: number; y: number; z: number }
  rotation: { y: number }
  avatar: AvatarColors
  name: string
  emote: string | null
}

export interface ChatMessage {
  id: string
  playerId: string
  name: string
  text: string
  timestamp: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  coins: number
}

export type ServerMessage =
  | { type: 'init'; playerId: string; players: RemotePlayer[]; messages: ChatMessage[]; leaderboard: LeaderboardEntry[] }
  | { type: 'player_joined'; player: RemotePlayer }
  | { type: 'player_left'; id: string }
  | { type: 'player_moved'; id: string; position: { x: number; y: number; z: number }; rotation: { y: number } }
  | { type: 'player_updated'; id: string; avatar: AvatarColors; name: string }
  | { type: 'player_emote'; id: string; emote: string | null }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'leaderboard'; leaderboard: LeaderboardEntry[] }

export interface MultiplayerClient {
  connect(roomId: string): void
  disconnect(): void
  sendPosition(position: { x: number; y: number; z: number }, rotation: { y: number }): void
  sendChat(text: string): void
  sendAvatarUpdate(avatar: AvatarColors, name: string): void
  sendCoinCollected(count: number): void
  sendEmote(emote: string): void
  onMessage(handler: (msg: ServerMessage) => void): void
  isConnected(): boolean
}

export function createMultiplayerClient(): MultiplayerClient {
  let ws: WebSocket | null = null
  let handler: ((msg: ServerMessage) => void) | null = null
  let connected = false
  let lastPositionSent = 0
  const POSITION_THROTTLE_MS = 50

  function connect(roomId: string) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${location.host}/api/rooms/${roomId}/ws`
    ws = new WebSocket(url)

    ws.addEventListener('open', () => { connected = true })
    ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMessage
        handler?.(msg)
      } catch { /* ignore */ }
    })
    ws.addEventListener('close', () => { connected = false })
    ws.addEventListener('error', () => { connected = false })
  }

  function disconnect() {
    ws?.close()
    ws = null
    connected = false
  }

  function sendPosition(position: { x: number; y: number; z: number }, rotation: { y: number }) {
    const now = Date.now()
    if (now - lastPositionSent < POSITION_THROTTLE_MS) return
    lastPositionSent = now
    send({ type: 'move', position, rotation })
  }

  function sendChat(text: string) { send({ type: 'chat', text }) }
  function sendAvatarUpdate(avatar: AvatarColors, name: string) { send({ type: 'avatar_update', avatar, name }) }
  function sendCoinCollected(count: number) { send({ type: 'coin_collected', count }) }
  function sendEmote(emote: string) { send({ type: 'emote', emote }) }

  function send(msg: unknown) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function onMessage(h: (msg: ServerMessage) => void) { handler = h }
  function isConnected() { return connected }

  return { connect, disconnect, sendPosition, sendChat, sendAvatarUpdate, sendCoinCollected, sendEmote, onMessage, isConnected }
}
