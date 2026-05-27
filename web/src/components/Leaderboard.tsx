import type { LeaderboardEntry } from '../multiplayer.ts'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  myId: string | null
}

export default function Leaderboard({ entries, myId }: LeaderboardProps) {
  if (entries.length === 0) return null

  return (
    <div className="absolute top-24 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 w-44" data-ui>
      <div className="text-white/70 text-xs font-semibold mb-1 uppercase tracking-wider">Leaderboard</div>
      {entries.slice(0, 5).map((entry, i) => (
        <div
          key={entry.id}
          className={`flex items-center gap-2 text-xs py-0.5 ${
            entry.id === myId ? 'text-yellow-300 font-bold' : 'text-white/80'
          }`}
        >
          <span className="w-4 text-right text-white/40">{i + 1}.</span>
          <span className="flex-1 truncate">{entry.name || 'Player'}</span>
          <span className="text-yellow-400">{entry.coins}</span>
        </div>
      ))}
    </div>
  )
}
