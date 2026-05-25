import { useEffect, useState } from 'react'

interface World {
  id: string
  name: string
  description: string
  maxPlayers: number
  thumbnail: string | null
}

interface LobbyProps {
  onJoinWorld: (worldId: string) => void
  onJoinRoom: (roomId: string) => void
  onCustomize: () => void
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-gray-900 p-6">
      <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">RobLix</h1>
      <p className="text-indigo-200 mb-8 text-lg">Build and play 3D experiences with friends</p>

      {/* World browser */}
      <div className="w-full max-w-2xl mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Experiences</h2>
        <div className="grid gap-4">
          {worlds.map(world => (
            <button
              key={world.id}
              onClick={() => onJoinWorld(world.id)}
              className="flex items-center gap-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:bg-white/20 transition text-left w-full"
            >
              <div className="w-16 h-16 bg-indigo-500 rounded-lg flex items-center justify-center text-2xl shrink-0">
                {world.id === 'hub' ? '🏠' : '🌍'}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg">{world.name}</h3>
                <p className="text-indigo-200 text-sm">{world.description}</p>
                <p className="text-indigo-300 text-xs mt-1">Up to {world.maxPlayers} players</p>
              </div>
              <div className="text-indigo-300 text-2xl">→</div>
            </button>
          ))}
        </div>
      </div>

      {/* Join by room code */}
      <div className="w-full max-w-2xl mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Join a Room</h2>
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
