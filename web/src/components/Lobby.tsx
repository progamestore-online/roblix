import { useEffect, useState } from 'react'

interface World {
  id: string
  name: string
  description: string
  maxPlayers: number
  thumbnail: string | null
  type: string
}

interface LobbyProps {
  onJoinWorld: (worldId: string) => void
  onJoinRoom: (roomId: string) => void
  onCustomize: () => void
}

const WORLD_ICONS: Record<string, string> = {
  hub: '🏠',
  obby: '🏃',
  sandbox: '🔨',
}

export default function Lobby({ onJoinWorld, onJoinRoom, onCustomize }: LobbyProps) {
  const [worlds, setWorlds] = useState<World[]>([])
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    fetch('/api/worlds')
      .then(r => r.json())
      .then(data => setWorlds(data.worlds))
      .catch(console.error)
  }, [])

  function handleCreateWorld() {
    fetch('/api/rooms/new', { method: 'POST' })
      .then(r => r.json())
      .then(({ roomId }) => onJoinRoom(roomId))
      .catch(console.error)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-gray-900 p-6">
      <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">RobLix</h1>
      <p className="text-indigo-200 mb-8 text-lg">Build and play 3D experiences with friends</p>

      {/* World browser */}
      <div className="w-full max-w-2xl mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Experiences</h2>
        <div className="grid gap-3">
          {worlds.map(world => (
            <button
              key={world.id}
              onClick={() => onJoinWorld(world.id)}
              className="flex items-center gap-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:bg-white/20 transition text-left w-full"
            >
              <div className="w-14 h-14 bg-indigo-500/50 rounded-lg flex items-center justify-center text-2xl shrink-0">
                {WORLD_ICONS[world.type || world.id] || '🌍'}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">{world.name}</h3>
                <p className="text-indigo-200 text-sm">{world.description}</p>
                <p className="text-indigo-300 text-xs mt-0.5">Up to {world.maxPlayers} players</p>
              </div>
              <div className="text-indigo-300 text-xl">→</div>
            </button>
          ))}
        </div>
      </div>

      {/* Create world */}
      <div className="w-full max-w-2xl mb-6">
        <button
          onClick={handleCreateWorld}
          className="w-full flex items-center gap-4 bg-green-500/20 border border-green-400/30 rounded-xl p-4 hover:bg-green-500/30 transition text-left"
        >
          <div className="w-14 h-14 bg-green-500/50 rounded-lg flex items-center justify-center text-2xl shrink-0">
            +
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">Create World</h3>
            <p className="text-green-200 text-sm">Start a private sandbox — build anything, invite friends</p>
          </div>
        </button>
      </div>

      {/* Join by room code */}
      <div className="w-full max-w-2xl mb-6">
        <h2 className="text-xl font-semibold text-white mb-3">Join a Room</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter room code..."
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:border-indigo-400"
            maxLength={12}
          />
          <button
            onClick={() => joinCode && onJoinRoom(joinCode)}
            disabled={!joinCode}
            className="px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Join
          </button>
        </div>
      </div>

      {/* Customize avatar */}
      <button
        onClick={onCustomize}
        className="px-8 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-400 transition"
      >
        Customize Avatar
      </button>
    </div>
  )
}
