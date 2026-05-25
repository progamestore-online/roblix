import { useState } from 'react'
import type { AvatarColors } from '../App.tsx'

interface AvatarCustomizerProps {
  initial: AvatarColors
  initialName: string
  onSave: (colors: AvatarColors, name: string) => void
  onBack: () => void
}

const PRESETS = [
  '#f5c542', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#dfe6e9', '#fd79a8', '#6c5ce7', '#00b894',
  '#e17055', '#0984e3', '#fdcb6e', '#2d3436', '#636e72',
  '#a29bfe', '#fab1a0', '#74b9ff', '#55a3e8', '#ff7675',
]

type BodyPart = keyof AvatarColors

export default function AvatarCustomizer({ initial, initialName, onSave, onBack }: AvatarCustomizerProps) {
  const [colors, setColors] = useState<AvatarColors>(initial)
  const [name, setName] = useState(initialName)
  const [activePart, setActivePart] = useState<BodyPart>('torso')

  function setColor(part: BodyPart, color: string) {
    setColors(prev => ({ ...prev, [part]: color }))
  }

  const parts: { key: BodyPart; label: string }[] = [
    { key: 'head', label: 'Head' },
    { key: 'torso', label: 'Torso' },
    { key: 'arms', label: 'Arms' },
    { key: 'legs', label: 'Legs' },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-purple-900 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Customize Avatar</h1>

      {/* Avatar preview (CSS boxes) */}
      <div className="relative mb-8 w-32 h-56 flex flex-col items-center">
        {/* Head */}
        <div
          className="w-12 h-12 rounded-sm border-2 border-white/20 cursor-pointer transition-transform hover:scale-110"
          style={{ backgroundColor: colors.head, borderColor: activePart === 'head' ? '#6366f1' : undefined }}
          onClick={() => setActivePart('head')}
        />
        {/* Torso */}
        <div
          className="w-14 h-16 rounded-sm border-2 border-white/20 mt-0.5 cursor-pointer transition-transform hover:scale-110"
          style={{ backgroundColor: colors.torso, borderColor: activePart === 'torso' ? '#6366f1' : undefined }}
          onClick={() => setActivePart('torso')}
        />
        {/* Arms */}
        <div className="absolute top-12 left-2 flex gap-[2.75rem]">
          <div
            className="w-5 h-14 rounded-sm border-2 border-white/20 cursor-pointer transition-transform hover:scale-110"
            style={{ backgroundColor: colors.arms, borderColor: activePart === 'arms' ? '#6366f1' : undefined }}
            onClick={() => setActivePart('arms')}
          />
          <div
            className="w-5 h-14 rounded-sm border-2 border-white/20 cursor-pointer transition-transform hover:scale-110"
            style={{ backgroundColor: colors.arms, borderColor: activePart === 'arms' ? '#6366f1' : undefined }}
            onClick={() => setActivePart('arms')}
          />
        </div>
        {/* Legs */}
        <div className="flex gap-1 mt-0.5">
          <div
            className="w-6 h-14 rounded-sm border-2 border-white/20 cursor-pointer transition-transform hover:scale-110"
            style={{ backgroundColor: colors.legs, borderColor: activePart === 'legs' ? '#6366f1' : undefined }}
            onClick={() => setActivePart('legs')}
          />
          <div
            className="w-6 h-14 rounded-sm border-2 border-white/20 cursor-pointer transition-transform hover:scale-110"
            style={{ backgroundColor: colors.legs, borderColor: activePart === 'legs' ? '#6366f1' : undefined }}
            onClick={() => setActivePart('legs')}
          />
        </div>
      </div>

      {/* Part selector tabs */}
      <div className="flex gap-2 mb-4">
        {parts.map(p => (
          <button
            key={p.key}
            onClick={() => setActivePart(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activePart === p.key
                ? 'bg-indigo-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Color picker grid */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {PRESETS.map(color => (
          <button
            key={color}
            onClick={() => setColor(activePart, color)}
            className="w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: colors[activePart] === color ? '#ffffff' : 'transparent',
            }}
          />
        ))}
      </div>

      {/* Custom color input */}
      <div className="flex items-center gap-2 mb-6">
        <label className="text-white/70 text-sm">Custom:</label>
        <input
          type="color"
          value={colors[activePart]}
          onChange={e => setColor(activePart, e.target.value)}
          className="w-10 h-10 rounded cursor-pointer"
        />
      </div>

      {/* Name input */}
      <div className="mb-8 w-full max-w-xs">
        <label className="block text-white/70 text-sm mb-1">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder="Enter your name..."
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400"
          maxLength={20}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(colors, name)}
          className="px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-400 transition"
        >
          Save
        </button>
      </div>
    </div>
  )
}
