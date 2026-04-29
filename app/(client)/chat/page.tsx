'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Paperclip,
  Command,
  SendIcon,
  LoaderIcon,
  XIcon,
  CalendarPlus,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import styles from './page.module.css'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
  action_type?: string | null
  action_meta?: { campaign_id?: string; deleted?: boolean } | null
}

interface CommandSuggestion {
  icon: React.ReactNode
  label: string
  description: string
  prefix: string
}

const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  { icon: <TrendingUp size={14} />, label: 'Top keywords', description: 'List top performing keywords', prefix: '/keywords' },
  { icon: <Target size={14} />, label: 'Competitors', description: 'Show competitor overview', prefix: '/competitors' },
  { icon: <CalendarPlus size={14} />, label: 'Plan next month', description: 'Plan + auto-generate 20 drafts for next month', prefix: '/plan-next-month' },
  { icon: <Search size={14} />, label: 'Audit', description: 'Run an SEO audit', prefix: '/audit' },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [serverGenerating, setServerGenerating] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [showPalette, setShowPalette] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const cmdBtnRef = useRef<HTMLButtonElement>(null)

  const adjustHeight = useCallback((reset?: boolean) => {
    const el = textareaRef.current
    if (!el) return
    if (reset) {
      el.style.height = '56px'
      return
    }
    el.style.height = '56px'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const loadHistory = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load chat history')
      setMessages(json.messages || [])
      setServerGenerating(!!json.is_generating)
      setProgress(
        json.progress &&
          typeof json.progress.done === 'number' &&
          typeof json.progress.total === 'number'
          ? { done: json.progress.done, total: json.progress.total }
          : null
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!serverGenerating) return
    const id = setInterval(() => {
      loadHistory()
    }, 4000)
    return () => clearInterval(id)
  }, [serverGenerating, loadHistory])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    if (input.startsWith('/') && !input.includes(' ')) {
      setShowPalette(true)
      const idx = COMMAND_SUGGESTIONS.findIndex((c) => c.prefix.startsWith(input))
      setActiveIdx(idx)
    } else {
      setShowPalette(false)
    }
  }, [input])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        paletteRef.current &&
        !paletteRef.current.contains(t) &&
        !cmdBtnRef.current?.contains(t)
      ) {
        setShowPalette(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const selectCommand = (idx: number) => {
    const cmd = COMMAND_SUGGESTIONS[idx]
    setInput(cmd.prefix + ' ')
    setShowPalette(false)
    textareaRef.current?.focus()
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    adjustHeight(true)
    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send message')

      const assistantMsg: ChatMessage = {
        id: `temp-asst-${Date.now()}`,
        role: 'assistant',
        content: json.response || '(no response)',
        action_type: json.campaign_id ? 'generate_campaign' : null,
        action_meta: json.campaign_id ? { campaign_id: json.campaign_id } : null,
      }
      setMessages((prev) => [...prev, assistantMsg])
      loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(trimmed)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPalette) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((p) => (p < COMMAND_SUGGESTIONS.length - 1 ? p + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((p) => (p > 0 ? p - 1 : COMMAND_SUGGESTIONS.length - 1))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && activeIdx >= 0)) {
        e.preventDefault()
        if (activeIdx >= 0) selectCommand(activeIdx)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowPalette(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const removeAttachment = (i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
  }

  const conversationStarted = messages.length > 0 || sending

  return (
    <div className={styles.page}>
      {!conversationStarted && !loading && (
        <div className={styles.hero}>
          <h1>How can I help today?</h1>
          <div className={styles.heroDivider} />
          <p className={styles.heroSub}>Type a command or ask about your SEO data</p>
        </div>
      )}

      <div className={styles.messages} ref={scrollRef}>
        {loading && <p className={styles.empty}>Loading...</p>}

        {messages.map((m) => (
          <div key={m.id} className={`${styles.message} ${styles[m.role]}`}>
            <div className={styles.avatar}>{m.role === 'user' ? 'U' : 'AI'}</div>
            <div className={styles.content}>
              {m.content}
              {m.action_meta?.campaign_id && (
                <div style={{ marginTop: 8 }}>
                  {m.action_meta.deleted ? (
                    <Button size="sm" variant="secondary" disabled>
                      Campaign deleted
                    </Button>
                  ) : (
                    <Link href={`/campaigns/${m.action_meta.campaign_id}`}>
                      <Button size="sm" variant="secondary">Open Campaign</Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {(sending || serverGenerating) && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}>AI</div>
            <div className={styles.content}>
              <span className={styles.typing}>
                {progress ? `Generating ${progress.done}/${progress.total}` : 'Thinking'}
              </span>
              <span className={styles.typingDots}>
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>

      <form className={styles.inputCard} onSubmit={handleSend}>
        {showPalette && (
          <div ref={paletteRef} className={styles.commandPalette}>
            {COMMAND_SUGGESTIONS.map((s, i) => (
              <div
                key={s.prefix}
                className={`${styles.commandItem} ${activeIdx === i ? styles.active : ''}`}
                onClick={() => selectCommand(i)}
              >
                {s.icon}
                <span className={styles.commandLabel}>{s.label}</span>
                <span className={styles.commandPrefix}>{s.prefix}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.textareaWrap}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                textareaRef.current?.scrollIntoView({
                  block: 'end',
                  behavior: 'smooth',
                })
              }, 300)
            }}
            placeholder="Ask anything about your SEO data..."
            disabled={sending}
            rows={1}
          />
        </div>

        {attachments.length > 0 && (
          <div className={styles.attachments}>
            {attachments.map((file, i) => (
              <span key={i} className={styles.attachment}>
                {file}
                <button type="button" onClick={() => removeAttachment(i)}>
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.actionRow}>
          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Attach file"
              disabled
              title="Coming soon"
            >
              <Paperclip size={16} />
            </button>
            <button
              ref={cmdBtnRef}
              type="button"
              className={styles.iconButton}
              aria-label="Commands"
              onClick={(e) => {
                e.stopPropagation()
                setShowPalette((p) => !p)
              }}
            >
              <Command size={16} />
            </button>
          </div>

          <button
            type="submit"
            className={styles.sendButton}
            disabled={sending || !input.trim()}
          >
            {sending ? <LoaderIcon size={14} className="animate-spin" /> : <SendIcon size={14} />}
            <span>Send</span>
          </button>
        </div>
      </form>

      {!conversationStarted && !loading && (
        <div className={styles.suggestions}>
          {COMMAND_SUGGESTIONS.map((s, i) => (
            <button
              key={s.prefix}
              type="button"
              className={styles.suggestion}
              onClick={() => selectCommand(i)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
