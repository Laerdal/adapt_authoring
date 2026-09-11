// Global "Samaritan Assistance" chat widget — the floating action button on
// Home / Setup / User / Template / Plugin Management pages.
//
// Full functional parity with the existing legacy AI Tutor plugin at
// `frontend/src/plugins/ai-tutor/views/chatPanelView.js`. Both surfaces now
// share one Samaritan brain:
//   • POST `/api/ai-tutor/chat` with `{ message, context }`; render
//     `data.reply` + `data.citationBadges`.
//   • Typing indicator (three animated dots), quick-start chips, "new chat"
//     that also POSTs `/api/ai-tutor/history/clear` to reset server memory.
//   • Simple markdown formatter: **bold**, [links](url), ![img](url),
//     inline videos, YouTube embeds — safe against `javascript:` /
//     `data:` schemes (mirrors the legacy view's URL normalisation).
//   • Header help button opens the Samaritan intro card (the same "help
//     note" the CKEditor Samaritan popover uses) with the LIFE link.
//
// Icon/branding: the FAB and the AI avatars are the branded Samaritan mark
// on a *white* background (light-mode SVG at
// `public/assets/icons/Samaritan-icon-light-mode.svg`).

import { useEffect, useMemo, useRef, useState } from 'react'
import SamaritanIcon from '@/components/storyboard/SamaritanIcon'
import { aiTutorChat, aiTutorClearHistory, type CitationBadge } from '@/api/ai'

interface AiAssistantProps {
  context?: string
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = [
  'How do I add a component?',
  "Block vs Article — what's the difference?",
  'How do I preview my course?',
]

const SAMARITAN_LEARN_MORE_URL =
  'https://life.laerdal.com/5d20fd236/p/920ebb-samaritan/b/080590'

const INITIAL_GREETING =
  "Hi! I\u2019m your AI Assistant. I can help you with anything in the Adapt " +
  'Authoring Tool \u2014 creating courses, adding components, previewing, ' +
  'publishing, and more.\n\nWhat would you like to know?'

const CLEARED_GREETING = 'Conversation cleared. What would you like to know?'

interface ChatEntry {
  role: 'ai' | 'user'
  text: string
  citationBadges?: CitationBadge[]
}

// ── URL sanitisation (ported verbatim from the legacy chatPanelView.js) ──
// Blocks `javascript:` / `data:` / `vbscript:` schemes; allows absolute
// http(s), root-relative, and hash routes; promotes bare authoring paths
// (`course/assets/...`, `api/...`) to root-relative.
function normaliseLinkUrl(raw: string): string {
  const url = String(raw || '').trim()
  if (!url) return ''
  if (/^(?:javascript|data|vbscript):/i.test(url)) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('#') || url.startsWith('/')) return url
  if (/^(?:course\/assets\/|api\/)/i.test(url)) return '/' + url
  return '/' + url
}
function normaliseMediaUrl(raw: string): string {
  const url = String(raw || '').trim()
  if (!url) return ''
  if (/^(?:javascript|data|vbscript):/i.test(url)) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url
  if (/^(?:course\/assets\/|api\/)/i.test(url)) return '/' + url
  return '/' + url
}

// Minimal HTML escape — matches `_.escape`.
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Segmented markdown renderer (mirrors the legacy `_formatMessage` /
// `_applyPattern`): each pattern replaces matches with `html` segments and
// leaves untouched text as `text` segments; a final pass HTML-escapes text
// and adds inline **bold** + <br> handling.
type Seg = { type: 'text' | 'html'; value: string }

function applyPattern(
  segs: Seg[],
  regex: RegExp,
  toHtml: (match: string, ...groups: string[]) => string
): Seg[] {
  const out: Seg[] = []
  for (const seg of segs) {
    if (seg.type === 'html') { out.push(seg); continue }
    const text = seg.value
    let last = 0
    let m: RegExpExecArray | null
    regex.lastIndex = 0
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
      out.push({ type: 'html', value: toHtml(m[0], ...m.slice(1)) })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  }
  return out
}

function formatMessage(text: string): string {
  let segs: Seg[] = [{ type: 'text', value: text }]

  // Images: ![alt](url)
  segs = applyPattern(segs, /!\[([^\]]*)\]\(([^\s)]+)\)/g, (m, alt, url) => {
    const src = normaliseMediaUrl(url)
    if (!src) return esc(m)
    return `<img class="ai-tutor-media" src="${esc(src)}" alt="${esc(alt)}">`
  })

  // YouTube (youtube.com/watch?v=ID | youtu.be/ID)
  segs = applyPattern(
    segs,
    /https?:\/\/(?:(?:www\.)?youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{5,15})/g,
    (_m, id) =>
      `<div class="ai-tutor-video-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" frameborder="0" allowfullscreen></iframe></div>`
  )

  // Inline video links: [label](url.mp4)
  segs = applyPattern(
    segs,
    /\[([^\]]+)\]\(([^\s)]+\.(?:mp4|webm|ogg)(?:[?#][^\s)]*)?)\)/g,
    (m, label, url) => {
      const src = normaliseMediaUrl(url)
      if (!src) return esc(m)
      return `<video class="ai-tutor-media" controls><source src="${esc(src)}"><a href="${esc(src)}">${esc(label)}</a></video>`
    }
  )

  // Inline video links: [filename.mp4](opaque-url)
  segs = applyPattern(
    segs,
    /\[([^\]]+\.(?:mp4|webm|ogg))\]\(([^\s)]+)\)/gi,
    (m, label, url) => {
      const src = normaliseMediaUrl(url)
      if (!src) return esc(m)
      return `<video class="ai-tutor-media" controls><source src="${esc(src)}"><a href="${esc(src)}">${esc(label)}</a></video>`
    }
  )

  // Generic markdown links: [label](url)
  segs = applyPattern(segs, /\[([^\]]+)\]\(([^\s)]+)\)/g, (m, label, url) => {
    const href = normaliseLinkUrl(url)
    if (!href) return esc(m)
    const externalAttrs = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a class="ai-tutor-link" href="${esc(href)}" title="${esc(href)}"${externalAttrs}>${esc(label)}</a>`
  })

  return segs
    .map((seg) => {
      if (seg.type === 'html') return seg.value
      return esc(seg.value)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
    })
    .join('')
}

// ─────────────────────────────────────────────────────────────────────────

export default function AiAssistant({
  context = 'Dashboard',
  suggestions = DEFAULT_SUGGESTIONS,
}: AiAssistantProps) {
  const [open, setOpen]         = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [messages, setMessages] = useState<ChatEntry[]>([
    { role: 'ai', text: INITIAL_GREETING },
  ])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const showChips = messages.length <= 1 && !busy

  // Auto-scroll to newest message.
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  // Focus input when the panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Auto-grow textarea.
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }

  // The server's `context.route` is used to bias grounding (dashboard →
  // live course data). We derive a route hint from the page's context prop.
  const routeHint = useMemo(() => context.toLowerCase().replace(/\s+/g, '-'), [context])

  async function send(rawText?: string) {
    const msg = (rawText ?? input).trim()
    if (!msg || busy) return
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setBusy(true)
    try {
      const { reply, citationBadges } = await aiTutorChat(msg, {
        route: routeHint,
        courseName: '',
      })
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: reply?.trim() || "Sorry, I didn't get a response. Please try again.",
          citationBadges,
        },
      ])
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `Something went wrong. ${detail}` },
      ])
    } finally {
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  async function newChat() {
    await aiTutorClearHistory()
    setMessages([{ role: 'ai', text: CLEARED_GREETING }])
    setInput('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Panel */}
      {open && (
        <div className="w-[360px] max-h-[560px] bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden">

          {/* Header — white background so the branded Samaritan mark reads correctly */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-[#eef0f4] shrink-0">
            <div className="w-9 h-9 rounded-full bg-white ring-1 ring-[#eadff7] flex items-center justify-center shrink-0">
              <SamaritanIcon className="h-6 w-6" />
            </div>
            <span className="font-semibold text-[#1a1a1a] text-sm flex-1">AI Assistant</span>

            {/* Help — Samaritan intro popup */}
            <button type="button" onClick={() => setHelpOpen(true)} title="About Samaritan" aria-label="About Samaritan"
              className="p-1.5 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f3f0fa] transition-colors">
              <svg width="15" height="15" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 16C12 16.5523 11.5523 17 11 17C10.4477 17 10 16.5523 10 16C10 15.4477 10.4477 15 11 15C11.5523 15 12 15.4477 12 16Z" fill="currentColor"/>
                <path d="M9.5 8.5C9.5 7.67157 10.1716 7 11 7C11.8284 7 12.5 7.67157 12.5 8.5C12.5 8.90672 12.3394 9.27391 12.0761 9.54503C11.9995 9.62385 11.9122 9.71095 11.8184 9.80462C11.5072 10.1151 11.1239 10.4977 10.8189 10.8896C10.4067 11.4192 10 12.1264 10 13C10 13.5523 10.4477 14 11 14C11.5523 14 12 13.5523 12 13C12 12.769 12.1052 12.4932 12.3972 12.118C12.6184 11.8338 12.8705 11.5819 13.1583 11.2943C13.2702 11.1826 13.3877 11.0652 13.5106 10.9386C14.122 10.3093 14.5 9.44778 14.5 8.5C14.5 6.567 12.933 5 11 5C9.067 5 7.5 6.567 7.5 8.5C7.5 9.05228 7.94772 9.5 8.5 9.5C9.05229 9.5 9.5 9.05228 9.5 8.5Z" fill="currentColor"/>
                <path d="M11 22C17.0751 22 22 17.0751 22 11C22 4.92487 17.0751 0 11 0C4.92487 0 0 4.92487 0 11C0 17.0751 4.92487 22 11 22ZM11 20C6.02944 20 2 15.9706 2 11C2 6.02944 6.02944 2 11 2C15.9706 2 20 6.02944 20 11C20 15.9706 15.9706 20 11 20Z" fill="currentColor"/>
              </svg>
            </button>

            {/* New chat */}
            <button type="button" onClick={newChat} title="New conversation" aria-label="New chat"
              className="p-1.5 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f3f0fa] transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Close */}
            <button type="button" onClick={() => setOpen(false)} title="Close" aria-label="Close AI assistant"
              className="p-1.5 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f3f0fa] transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Context strip */}
          <div className="px-4 py-2 bg-[#f7f4fd] border-b border-[#eadff7] shrink-0">
            <span className="text-xs font-semibold text-[#6b4fa8]">You're in: {context}</span>
          </div>

          {/* Messages */}
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'ai' ? (
                  <div className="w-8 h-8 rounded-full bg-white ring-1 ring-[#eadff7] flex items-center justify-center shrink-0 mt-0.5">
                    <SamaritanIcon className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#6b4fa8] text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold">
                    You
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[260px] break-words ${
                    msg.role === 'ai'
                      ? 'bg-[#f5f0ff] text-[#3b2a6e]'
                      : 'bg-[#6b4fa8] text-white ml-auto'
                  }`}
                >
                  <div
                    className="ai-tutor-bubble-content"
                    // Rendered HTML is produced only by our sanitising formatter
                    // (URLs re-normalised, all raw user/AI text HTML-escaped).
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                  />
                  {msg.role === 'ai' && msg.citationBadges && msg.citationBadges.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.citationBadges.slice(0, 4).map((b, bi) =>
                        b.label ? (
                          <span
                            key={bi}
                            className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white text-[#4b3a7c] border border-[#c4b5f4]"
                          >
                            {b.label}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {busy && (
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white ring-1 ring-[#eadff7] flex items-center justify-center shrink-0 mt-0.5">
                  <SamaritanIcon className="h-5 w-5" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#f5f0ff] text-[#6b4fa8]">
                  <span className="ai-tutor-dot" />
                  <span className="ai-tutor-dot" style={{ animationDelay: '0.15s' }} />
                  <span className="ai-tutor-dot" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Quick-start chips */}
          {showChips && (
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
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={busy}
                placeholder="Ask me anything about the authoring tool\u2026"
                className="flex-1 resize-none text-sm px-3 py-2.5 rounded-xl border border-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#6b4fa8] focus:border-transparent text-[#374151] placeholder-[#9ca3af] bg-[#fafafa] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || busy}
                aria-label="Send message"
                className="w-11 h-11 rounded-xl bg-[#6b4fa8] hover:bg-[#5a3f91] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4 20-7z" /><path d="M22 2 11 13" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[#9ca3af] text-center mt-2">AI-generated. Verify important steps in the tool.</p>
          </div>
        </div>
      )}

      {/* FAB — white background carrying the branded Samaritan mark */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        title="AI Assistant"
        className="w-14 h-14 rounded-full bg-white shadow-xl ring-1 ring-[#eadff7] hover:ring-[#c4b5f4] flex items-center justify-center transition-all hover:scale-105"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <SamaritanIcon className="h-8 w-8" />
        )}
      </button>

      {/* Samaritan intro / help note */}
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="About Samaritan"
          onClick={(e) => { if (e.target === e.currentTarget) setHelpOpen(false) }}
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5"
        >
          <div className="relative bg-white rounded-lg shadow-2xl max-w-[600px] w-full max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="Close help"
              className="absolute top-2 right-3 text-2xl leading-none text-[#666] hover:text-[#111]"
            >
              &times;
            </button>
            <div className="flex flex-col items-center px-6 pt-8 pb-6">
              <SamaritanIcon className="h-24 w-24" />
              <h3 className="mt-4 text-center text-lg font-semibold text-[#1a1a1a]">
                Introducing Samaritan&trade; &mdash; Responsible AI across Laerdal products.
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[#374151] text-center">
                Samaritan enhances clarity, efficiency, and intelligence in our product portfolio,
                ensuring that our AI solutions align with our mission and are trustworthy, fair,
                compliant, and sustainable. Samaritan seamlessly integrates intelligence through
                various AI models tailored to meet your needs.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <a
                  href={SAMARITAN_LEARN_MORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3294BA] hover:underline"
                >
                  Learn more about Samaritan
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M20 10C19.4477 10 19 9.5523 19 9.00001V6.41441L12.7717 12.6428C12.3553 13.0591 11.7011 13.0801 11.3106 12.6896C10.9201 12.299 10.9411 11.6449 11.3574 11.2285L17.586 5.00001L15 5.00001C14.4477 5.00001 14 4.5523 14 4.00001C14 3.44773 14.4477 3.00001 15 3.00001L19.9953 3.00001L20 3C20.2527 3 20.4835 3.09373 20.6596 3.24833C20.6759 3.26254 20.6918 3.27739 20.7073 3.2929C20.7235 3.30911 20.739 3.32577 20.7538 3.34285C20.9071 3.51859 21 3.74845 21 4V9.00001C21 9.5523 20.5523 10 20 10Z" fill="currentColor"/>
                    <path d="M5 6.00001C5 5.44773 5.44772 5.00001 6 5.00001H10C10.5523 5.00001 11 4.5523 11 4.00001C11 3.44773 10.5523 3.00001 10 3.00001H6C4.34315 3.00001 3 4.34316 3 6.00001V18C3 19.6569 4.34315 21 6 21H18C19.6569 21 21 19.6569 21 18V14C21 13.4477 20.5523 13 20 13C19.4477 13 19 13.4477 19 14V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6.00001Z" fill="currentColor"/>
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="text-sm font-semibold text-[#6b4fa8] hover:underline"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
