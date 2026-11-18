import { useEffect, useMemo, useRef, useState } from 'react'
import { Accordion, Anchor, Avatar, Button, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { ArrowLeft, ArrowUpRight, Send, Sticker as StickerIcon } from 'lucide-react'
import { localHistory, saveLocalMessage, watchLocalHistory, type LocalMessage } from '../chatStorage'
import { personFor, type DemoState, type Thread, type Update } from '../demo'
import { EmptyState, PageHeading, StatusStamp } from '../ui'

export function MessagesPage({ state, threadId, demoKey, update }: { state: DemoState; threadId?: string; demoKey: string; update: Update }) {
  const active = state.threads.find((thread) => thread.id === threadId)
  return (
    <>
      <PageHeading title="Berichten" description="Spreek samen af waar je de stickers ruilt." />
      {state.threads.length ? (
        <div className="messages-layout" data-thread-open={!!active}>
          <Paper withBorder component="nav" aria-label="Gesprekken" className="thread-list">
            {state.threads.map((thread) => {
              const unread = state.inbox.filter((message) => message.threadId === thread.id).length
              const person = personFor(thread.person)
              return (
                <a key={thread.id} href={`/berichten/${thread.id}`} className="thread-link"
                  aria-current={active?.id === thread.id ? 'page' : undefined}>
                  <Avatar color="ochre" size={41} aria-hidden>{person.initials}</Avatar>
                  <span><strong>{person.name}</strong><span>Sticker {thread.number}</span></span>
                  {!!unread && <StatusStamp>{unread} nieuw</StatusStamp>}
                </a>
              )
            })}
          </Paper>
          {active ? (
            <Conversation key={active.id} state={state} thread={active} demoKey={demoKey} update={update} />
          ) : (
            <EmptyState title={threadId ? 'Gesprek niet gevonden' : 'Kies een gesprek'}>
              {threadId ? 'Kies een gesprek uit je lijst.' : 'Open een gesprek om je berichten te bekijken.'}
            </EmptyState>
          )}
        </div>
      ) : (
        <EmptyState title="Je hebt nog geen gesprekken" action={<Button component="a" href="/ruilen">Bekijk het aanbod</Button>}>
          Kies een sticker die je wilt hebben om een privégesprek te starten.
        </EmptyState>
      )}
      <Accordion className="chat-privacy" variant="contained">
        <Accordion.Item value="privacy">
          <Accordion.Control>Tijdelijke opslag van chatberichten</Accordion.Control>
          <Accordion.Panel>
            <Text mb="xs" fw={700}>In deze lokale proef worden alleen voorbeeldberichten ontvangen. Wat jij typt, blijft in deze browser.</Text>
            <Text size="sm" c="dimmed" mb={4}>Uitleg voor de uiteindelijke chat</Text>
            <Text mb="xs">We slaan de inhoud van je chatberichten tijdelijk op in onze database, zodat de ontvanger ze ook later kan openen. Zodra een bericht in de geopende chat van de ontvanger verschijnt en diens browser het heeft opgeslagen, verwijderen we het automatisch uit de actieve database.</Text>
            <Text>De geschiedenis blijft staan in de browser waarin je het bericht verstuurt of leest. Je kunt die geschiedenis zelf wissen bij <Anchor href="/instellingen">Instellingen</Anchor>. Een eerdere back-up kan nog een kopie bevatten. Bij herstel wissen we de teruggezette berichten voordat de chat weer opengaat.</Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  )
}

function Conversation({ state, thread, demoKey, update }: { state: DemoState; thread: Thread; demoKey: string; update: Update }) {
  const [local, setLocal] = useState<LocalMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [exampleBusy, setExampleBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const person = personFor(thread.person)
  const pending = useMemo(() => state.inbox.filter((message) => message.threadId === thread.id), [state.inbox, thread.id])
  const offer = state.offers.find((candidate) => candidate.id === thread.offerId)
  const canWithdraw = offer?.interested.includes('me') && offer.promisedTo !== 'me'
  const messages = new Map(local.filter((message) => message.threadId === thread.id).map((message) => [message.id, message]))
  for (const message of pending) messages.set(message.id, { ...message, direction: 'in' })
  const sorted = [...messages.values()].sort((first, second) => first.sentAt - second.sentAt)

  useEffect(() => {
    let closed = false
    let revision = 0
    function refresh() {
      const attempt = ++revision
      void localHistory(demoKey).then((messages) => {
        if (!closed && attempt === revision) setLocal(messages)
      }).catch(() => { if (!closed) setError('Chatgeschiedenis kan niet worden geopend in deze browser.') })
    }
    const stop = watchLocalHistory(demoKey, refresh)
    refresh()
    return () => { closed = true; stop() }
  }, [demoKey])

  useEffect(() => {
    if (!pending.length || !scroller.current) return
    const visible = new Set<string>()
    const reading = new Set<string>()
    const retries = new Map<string, number>()
    let active = true
    function readVisible() {
      if (!active || document.visibilityState !== 'visible') return
      for (const message of pending) {
        if (!visible.has(message.id) || reading.has(message.id) || retries.has(message.id)) continue
        reading.add(message.id)
        void (async () => {
          try {
            const copy = { ...message, direction: 'in' as const }
            await saveLocalMessage(demoKey, copy)
            if (!active) return
            setLocal((previous) => [...previous.filter((saved) => saved.id !== copy.id), copy])
            await update({ type: 'read', messageId: copy.id }, { inlineError: true })
            if (active) setError('')
          } catch {
            if (!active) return
            setError('Lezen kon nog niet worden bevestigd. We proberen het opnieuw.')
            retries.set(message.id, window.setTimeout(() => {
              retries.delete(message.id)
              readVisible()
            }, 3000))
          } finally {
            reading.delete(message.id)
          }
        })()
      }
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId
        if (!id) continue
        if (entry.isIntersecting) visible.add(id)
        else visible.delete(id)
      }
      readVisible()
    })
    for (const bubble of scroller.current.querySelectorAll('[data-message-id]')) observer.observe(bubble)
    document.addEventListener('visibilitychange', readVisible)
    return () => {
      active = false
      observer.disconnect()
      for (const retry of retries.values()) clearTimeout(retry)
      document.removeEventListener('visibilitychange', readVisible)
    }
  }, [demoKey, pending, update])

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [sorted.length])

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const message: LocalMessage = { id: crypto.randomUUID(), threadId: thread.id, direction: 'out', text, sentAt: Date.now() }
    try {
      await saveLocalMessage(demoKey, message)
      setLocal((previous) => [...previous, message])
      setDraft('')
      setError('')
    } catch {
      setError('Het bericht kon niet in deze browser worden opgeslagen.')
    } finally { setSending(false) }
  }

  return (
    <Paper withBorder className="conversation">
      <header className="conversation-heading">
        <Anchor href="/berichten" className="back-to-threads"><ArrowLeft size={17} aria-hidden /> Gesprekken</Anchor>
        <Group gap={9} justify="space-between">
          <div><Title order={2}>{person.name}</Title><Text c="dimmed" size="sm">Sticker {thread.number}</Text></div>
          {offer?.promisedTo ? <StatusStamp color="ochre">Beloofd</StatusStamp> : canWithdraw && (
            <span className="interest-stamp"><StatusStamp>Interesse getoond</StatusStamp></span>
          )}
        </Group>
      </header>
      <div className="bubbles" ref={scroller} role="log" aria-label={`Gesprek met ${person.name}`}>
        {!sorted.length && (
          <div className="chat-prompt"><StickerIcon size={32} aria-hidden /><Text>Stuur een bericht over sticker {thread.number}.</Text></div>
        )}
        {sorted.map((message) => (
          <div key={message.id} className={`bubble bubble--${message.direction}`} data-message-id={message.id}>
            <Text fw={700} size="xs" className="bubble-person">{message.direction === 'out' ? 'Jij' : person.name}</Text>
            <Text>{message.text}</Text>
          </div>
        ))}
      </div>
      <Stack p="md" gap="xs">
        {error && <Text role="alert" c="red">{error}</Text>}
        <form className="compose" onSubmit={(event) => { event.preventDefault(); void send() }}>
          <Textarea aria-label="Bericht" placeholder="Schrijf een bericht" autosize minRows={1} maxRows={4}
            maxLength={1000} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
          <Button type="submit" disabled={!draft.trim()} loading={sending} leftSection={<Send size={16} aria-hidden />}>Verstuur</Button>
        </form>
        <Button variant="subtle" size="compact-sm" className="simulate-reply" loading={exampleBusy}
          rightSection={<ArrowUpRight size={15} aria-hidden />} onClick={async () => {
            setExampleBusy(true)
            try { await update({ type: 'exampleReply', threadId: thread.id }) } catch { /* App displays the error. */ } finally { setExampleBusy(false) }
          }}>Ontvang een voorbeeldbericht</Button>
        {canWithdraw && offer && (
          <Button variant="subtle" size="compact-sm" className="simulate-reply" loading={withdrawing}
            onClick={async () => {
              setWithdrawing(true)
              try {
                await update({ type: 'withdraw', offerId: offer.id })
                setFeedback('Je interesse is ingetrokken. Het gesprek blijft staan.')
              } catch { /* App displays the error. */ } finally { setWithdrawing(false) }
            }}>Trek interesse in</Button>
        )}
        {feedback && <Text role="status" c="dimmed">{feedback}</Text>}
      </Stack>
    </Paper>
  )
}
