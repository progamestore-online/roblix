import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '../multiplayer.ts'

interface ChatProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  onFocusChange: (focused: boolean) => void
}

export default function Chat({ messages, onSend, onFocusChange }: ChatProps) {
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  // Listen for Enter to open chat
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !isOpen) {
        e.preventDefault()
        setIsOpen(true)
        onFocusChange(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        onFocusChange(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onFocusChange])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input.trim()) {
      onSend(input.trim())
      setInput('')
    }
    setIsOpen(false)
    onFocusChange(false)
    inputRef.current?.blur()
  }

  return (
    <div className="absolute bottom-44 left-4 sm:bottom-4 w-80 max-w-[calc(100%-2rem)]" data-chat>
      {/* Message list */}
      <div
        ref={listRef}
        className="max-h-40 overflow-y-auto mb-2 space-y-1 scrollbar-none"
      >
        {messages.slice(-20).map(msg => (
          <div key={msg.id} className="bg-black/50 backdrop-blur-sm rounded px-2 py-1 text-sm">
            <span className="text-indigo-300 font-semibold">{msg.name}: </span>
            <span className="text-white">{msg.text}</span>
          </div>
        ))}
      </div>

      {/* Input */}
      {isOpen && (
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={200}
            className="w-full bg-black/70 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-indigo-400"
            onBlur={() => {
              setIsOpen(false)
              onFocusChange(false)
            }}
          />
        </form>
      )}
    </div>
  )
}
