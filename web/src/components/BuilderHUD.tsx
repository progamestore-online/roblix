import { BLOCK_COLORS } from '../engine/Builder.ts'
import type { BlockType } from '../engine/Physics.ts'

interface BuilderHUDProps {
  enabled: boolean
  selectedColor: number
  selectedType: BlockType
  onToggle: () => void
  onSelectColor: (color: number) => void
  onSelectType: (type: BlockType) => void
}

function hexStr(n: number) {
  return '#' + n.toString(16).padStart(6, '0')
}

const TYPE_OPTIONS: { type: BlockType; label: string; bg: string; icon: string }[] = [
  { type: 'solid', label: 'Solid', bg: '#1e88e5', icon: '■' },
  { type: 'lava', label: 'Lava', bg: '#ff5722', icon: '🔥' },
  { type: 'bounce', label: 'Bounce', bg: '#00e676', icon: '⤴' },
  { type: 'ice', label: 'Ice', bg: '#b3e5fc', icon: '❄' },
  { type: 'glass', label: 'Glass', bg: 'rgba(180,220,255,0.4)', icon: '◇' },
]

export default function BuilderHUD({
  enabled, selectedColor, selectedType,
  onToggle, onSelectColor, onSelectType,
}: BuilderHUDProps) {
  return (
    <>
      {/* Build mode toggle */}
      <button
        onClick={onToggle}
        className={`absolute top-14 left-1/2 -translate-x-1/2 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm font-semibold transition ${
          enabled ? 'bg-green-500/80 hover:bg-green-500' : 'bg-gray-500/60 hover:bg-gray-500/80'
        }`}
        data-ui
      >
        {enabled ? 'Building (B)' : 'Build Mode (B)'}
      </button>

      {/* Type + color palette */}
      {enabled && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 flex flex-col items-center gap-2 max-w-80" data-ui>
          {/* Block type tabs */}
          <div className="flex gap-1 justify-center w-full">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.type}
                onClick={() => onSelectType(opt.type)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition ${
                  selectedType === opt.type
                    ? 'bg-white/95 text-gray-900'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
                title={opt.label}
              >
                <span style={{ color: selectedType === opt.type ? opt.bg : '#fff' }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Color palette: shown when color affects the chosen type */}
          {(selectedType === 'solid' || selectedType === 'glass') && (
            <div className="flex gap-1.5 flex-wrap justify-center">
              {BLOCK_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => onSelectColor(color)}
                  className="w-7 h-7 rounded border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: hexStr(color),
                    borderColor: color === selectedColor ? '#ffffff' : 'transparent',
                  }}
                />
              ))}
            </div>
          )}

          <div className="text-center text-white/40 text-xs">
            Left click: place | Right click: remove | Scroll: cycle color
          </div>
        </div>
      )}
    </>
  )
}
