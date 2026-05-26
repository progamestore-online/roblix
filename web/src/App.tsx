import { useEffect, useState } from 'react'
import Lobby from './components/Lobby.tsx'
import Game from './components/Game.tsx'
import AvatarCustomizer from './components/AvatarCustomizer.tsx'

export type AvatarColors = {
  head: string
  torso: string
  arms: string
  legs: string
}

export type AppView = 'lobby' | 'game' | 'avatar'

const DEFAULT_AVATAR: AvatarColors = {
  head: '#f5c542',
  torso: '#4287f5',
  arms: '#f5c542',
  legs: '#2d5a27',
}

export default function App() {
  const [view, setView] = useState<AppView>('lobby')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<AvatarColors>(() => {
    try {
      const saved = localStorage.getItem('roblix-avatar')
      return saved ? JSON.parse(saved) : DEFAULT_AVATAR
    } catch {
      return DEFAULT_AVATAR
    }
  })
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('roblix-name') || ''
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room && /^[a-z0-9]{3,12}$/.test(room)) {
      setRoomId(room)
      setView('game')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  function handleJoinWorld(worldId: string) {
    setRoomId(worldId)
    setView('game')
  }

  function handleJoinRoom(id: string) {
    setRoomId(id)
    setView('game')
  }

  function handleAvatarSave(colors: AvatarColors, name: string) {
    setAvatar(colors)
    setPlayerName(name)
    localStorage.setItem('roblix-avatar', JSON.stringify(colors))
    localStorage.setItem('roblix-name', name)
    setView('lobby')
  }

  if (view === 'game' && roomId) {
    return (
      <Game
        roomId={roomId}
        avatar={avatar}
        playerName={playerName}
        onLeave={() => setView('lobby')}
      />
    )
  }

  if (view === 'avatar') {
    return (
      <AvatarCustomizer
        initial={avatar}
        initialName={playerName}
        onSave={handleAvatarSave}
        onBack={() => setView('lobby')}
      />
    )
  }

  return (
    <Lobby
      onJoinWorld={handleJoinWorld}
      onJoinRoom={handleJoinRoom}
      onCustomize={() => setView('avatar')}
    />
  )
}
