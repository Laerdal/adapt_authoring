import { useState, useRef } from 'react'

interface AiAssistantProps {
  context?: string
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = [
  'How do I add a component?',
  "Block vs Article — what's the difference?",
  'How do I preview my course?',
]

const StarIcon = ({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
)

export default function AiAssistant({ context = 'Dashboard', suggestions = DEFAULT_SUGGESTIONS }: AiAssistantProps) {
  const [open, setOpen]       = useState(false)
  const [input, setInput]     = useState('')
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: 'Conversation cleared. What would you like to know?' },
  ])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg) return
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: msg },
      { role: 'ai', text: 'This is a placeholder response. Full AI functionality coming soon.' },
    ])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function clearChat() {
    setMessages([{ role: 'ai', text: 'Conversation cleared. What would you like to know?' }])
    setInput('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Panel */}
      {open && (
        <div className="w-[340px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-[#6b4fa8] shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <StarIcon size={18} />
            </div>
            <span className="font-semibold text-white text-sm flex-1">AI Assistant</span>

            {/* New chat */}
            <button type="button" onClick={clearChat} title="New chat" aria-label="New chat"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Close */}
            <button type="button" onClick={() => setOpen(false)} title="Close" aria-label="Close AI assistant"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Context pill */}
          <div className="px-4 py-2 bg-[#f5f0ff] border-b border-[#e9e3f8] shrink-0">
            <span className="text-xs font-semibold text-[#6b4fa8]">You're in: {context}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-[#6b4fa8] flex items-center justify-center shrink-0 mt-0.5">
                    <StarIcon size={14} />
                  </div>
                )}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[240px] ${
                  msg.role === 'ai'
                    ? 'bg-[#f5f0ff] text-[#3b2a6e]'
                    : 'bg-[#6b4fa8] text-white ml-auto'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions — only when chat is fresh */}
          {messages.length <= 1 && (
            <div className="px-4 pb-3 pt-3 flex flex-col gap-2 border-t border-[#f3f4f6] shrink-0">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-sm font-semibold text-[#4b3a7c] border border-[#c4b5f4] rounded-full px-4 py-2 hover:bg-[#f5f0ff] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pt-3 pb-3 border-t border-[#e5e7eb] shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={2}
                placeholder="Ask me anything about the authoring tool..."
                className="flex-1 resize-none text-sm px-3 py-2.5 rounded-xl border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#6b4fa8] focus:border-transparent text-[#374151] placeholder-[#9ca3af] bg-[#fafafa]"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim()}
                aria-label="Send message"
                className="w-11 h-11 rounded-xl bg-[#6b4fa8] hover:bg-[#5a3f91] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[#9ca3af] text-center mt-2">AI-generated. Verify important steps in the tool.</p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        className="w-14 h-14 rounded-full bg-[#6b4fa8] hover:bg-[#5a3f91] shadow-xl flex items-center justify-center transition-colors"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <StarIcon size={22} />
        )}
      </button>
    </div>
  )
}
