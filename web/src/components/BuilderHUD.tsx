import { BLOCK_COLORS } from '../engine/Builder.ts'

interface BuilderHUDProps {
  enabled: boolean
  selectedColor: number
  onToggle: () => void
  onSelectColor: (color: number) => void
}

function hexStr(n: number) {
  return '#' + n.toString(16).padStart(6, '0')
}

export default function BuilderHUD({ enabled, selectedColor, onToggle, onSelectColor }: BuilderHUDProps) {
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

      {/* Color palette */}
      {enabled && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 flex gap-1.5 flex-wrap justify-center max-w-80" data-ui>
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
          <div className="w-full text-center text-white/40 text-xs mt-1">
            Left click: place | Right click: remove | Scroll: cycle color
          </div>
        </div>
      )}
    </>
  )
}
