import { useEffect, useMemo, useRef, useState } from 'react'
import { Accordion, Anchor, Avatar, Button, Group, Modal, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { ArrowLeft, ArrowUpRight, Ban, Send, Sticker as StickerIcon, Trash2 } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { localHistory, removeThreadWithHistory, saveLocalMessage, watchLocalHistory, type LocalMessage } from '../chatStorage'
import { errorMessage, personFor, type DemoState, type SendMessage, type Thread, type Update } from '../demo'
import { EmptyState, PageHeading, StatusStamp } from '../ui'

export function MessagesPage({ state, threadId, demoKey, update, sendMessage, navigate }: {
  state: DemoState
  threadId?: string
  demoKey: string
  update: Update
  sendMessage?: SendMessage
  navigate: (path: string) => void
}) {
  const [removal, setRemoval] = useState<{ thread: Thread, name: string, removed: boolean } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removalError, setRemovalError] = useState('')
  const selected = useQuery(api.exchange.getConversation, sendMessage && threadId ? { threadId } : 'skip')
  const setMessageBlock = useMutation(api.exchange.setMessageBlock)
  const messaging = selected ? {
    blocked: selected.blocked,
    setBlocked: (blocked: boolean) => setMessageBlock({ threadId: selected.id, blocked }),
  } : undefined
  const listed = state.threads.find((thread) => thread.id === threadId)
  const older = listed ? undefined : selected
  const active = listed ?? older
  const threads = older ? [...state.threads, older] : state.threads
  const viewState = older ? { ...state, people: { ...state.people, [older.person]: { name: older.name, wants: [] } } } : state

  async function removeConversation() {
    if (!removal || removing) return
    const { thread } = removal
    const historyVersion = thread.historyVersion ?? 0
    let removed = removal.removed
    setRemoving(true)
    setRemovalError('')
    try {
      await removeThreadWithHistory(demoKey, thread.id, historyVersion, async (threadId, version) => {
        if (!removed) await update({ type: 'removeThread', threadId, historyVersion: version }, { inlineError: true })
      }, () => {
        removed = true
        setRemoval({ ...removal, removed: true })
      })
      setRemoval(null)
      if (location.pathname.replace(/\/$/u, '') === `/berichten/${thread.id}`) navigate('/berichten')
    } catch (cause) {
      setRemovalError(removed
        ? 'Het gesprek is uit je lijst. De chatgeschiedenis in deze browser wissen is nog niet gelukt.'
        : errorMessage(cause))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <PageHeading title="Berichten" description="Spreek samen af waar je de stickers ruilt." />
      {threads.length || threadId ? (
        <div className="messages-layout" data-thread-open={!!active}>
          <Paper withBorder component="nav" aria-label="Gesprekken" className="thread-list">
            {threads.map((thread) => {
              const unread = state.inbox.filter((message) => message.threadId === thread.id).length
              const person = personFor(thread.person, viewState)
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
            <Conversation key={`${active.id}:${active.historyVersion ?? 0}`} state={viewState} thread={active} demoKey={demoKey}
              update={update} sendMessage={sendMessage} messaging={messaging} removing={removal !== null}
              requestRemoval={() => {
                setRemovalError('')
                setRemoval({ thread: active, name: personFor(active.person, viewState).name, removed: false })
              }} />
          ) : sendMessage && threadId && selected === undefined ? (
            <Text role="status">Gesprek laden…</Text>
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
      <Modal opened={removal !== null} onClose={() => { if (!removing) setRemoval(null) }}
        closeOnEscape={!removing} closeOnClickOutside={!removing} withCloseButton={!removing}
        centered title="Gesprek verwijderen?">
        {removal && <Stack>
          <Text>Het gesprek met {removal.name} over sticker {removal.thread.number} verdwijnt uit je lijst. Je chatgeschiedenis voor dit gesprek wordt in deze browser gewist.</Text>
          {sendMessage && <Text>De ander houdt het gesprek. Bij een nieuw bericht verschijnt het weer in je lijst.</Text>}
          {removalError && <Text role="alert" c="red">{removalError}</Text>}
          <Group justify="flex-end">
            <Button variant="default" data-autofocus disabled={removing} onClick={() => setRemoval(null)}>
              {removal.removed ? 'Sluiten' : 'Annuleren'}
            </Button>
            <Button color="red" loading={removing} onClick={() => void removeConversation()}>
              {removalError ? 'Opnieuw proberen' : 'Verwijderen'}
            </Button>
          </Group>
        </Stack>}
      </Modal>
      <Accordion className="chat-privacy" variant="contained">
        <Accordion.Item value="privacy">
          <Accordion.Control>Tijdelijke opslag van chatberichten</Accordion.Control>
          <Accordion.Panel>
            {!sendMessage && (
              <>
                <Text mb="xs" fw={700}>In deze losse demo blijft wat jij typt in deze browser.</Text>
                <Text size="sm" c="dimmed" mb={4}>Uitleg voor de chat tussen accounts</Text>
              </>
            )}
            <Text mb="xs">We slaan de inhoud van je chatberichten tijdelijk op in onze database, zodat de ontvanger ze ook later kan openen. Zodra een bericht in de geopende chat van de ontvanger verschijnt en diens browser het heeft opgeslagen, verwijderen we het automatisch uit de actieve database.</Text>
            <Text mb="xs">Je kunt per verzamelaar maximaal vijf ongelezen berichten tegelijk sturen. Ongelezen berichten vervallen na 30 dagen.</Text>
            <Text>De geschiedenis blijft staan in de browser waarin je het bericht verstuurt of leest. Je kunt die geschiedenis zelf wissen bij <Anchor href="/instellingen">Instellingen</Anchor>.</Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  )
}

function Conversation({ state, thread, demoKey, update, sendMessage, messaging, removing, requestRemoval }: {
  state: DemoState
  thread: Thread
  demoKey: string
  update: Update
  sendMessage?: SendMessage
  removing: boolean
  requestRemoval: () => void
  messaging?: { blocked: boolean, setBlocked: (blocked: boolean) => Promise<null> }
}) {
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [savingBlock, setSavingBlock] = useState(false)
  const [local, setLocal] = useState<LocalMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [exampleBusy, setExampleBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const pauseReading = removing || confirmBlock || savingBlock || !!messaging?.blocked
  const scroller = useRef<HTMLDivElement>(null)
  const person = personFor(thread.person, state)
  const pending = useMemo(() => state.inbox.filter((message) =>
    message.threadId === thread.id && message.historyVersion === thread.historyVersion), [state.inbox, thread.id, thread.historyVersion])
  const offer = state.offers.find((candidate) => candidate.id === thread.offerId)
  const canWithdraw = offer?.interested.includes('me') && offer.promisedTo !== 'me'
  const messages = new Map(local.filter((message) => message.threadId === thread.id &&
    message.historyVersion === thread.historyVersion).map((message) => [message.id, message]))
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
    if (pauseReading || !pending.length || !scroller.current) return
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
  }, [demoKey, pauseReading, pending, update])

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [sorted.length])

  async function send() {
    const text = draft.trim()
    if (!text || sending || removing || messaging?.blocked) return
    const message: LocalMessage = {
      id: crypto.randomUUID(), threadId: thread.id, historyVersion: thread.historyVersion, direction: 'out', text, sentAt: Date.now(),
      ...(sendMessage ? { delivery: 'pending' } : {}),
    }
    setSending(message.id)
    setError('')
    try {
      await storeMessage(message)
      setDraft('')
      await deliverMessage(message)
    } catch {
      setError('Het bericht kon niet in deze browser worden opgeslagen.')
    } finally { setSending(null) }
  }

  async function storeMessage(message: LocalMessage) {
    await saveLocalMessage(demoKey, message)
    setLocal((previous) => [...previous.filter((item) => item.id !== message.id), message])
  }

  async function deliverMessage(message: LocalMessage) {
    if (!sendMessage) return
    try {
      await sendMessage({
        threadId: thread.id, clientId: message.id, text: message.text,
        composedAt: message.sentAt, historyVersion: message.historyVersion,
      })
    } catch (cause) {
      setError(errorMessage(cause))
      return
    }
    try {
      await storeMessage({ ...message, delivery: 'sent' })
    } catch {
      setError('Je bericht is verstuurd. De bevestiging kon niet in deze browser worden opgeslagen.')
    }
  }

  async function retry(message: LocalMessage) {
    if (sending || removing) return
    setSending(message.id)
    setError('')
    try { await deliverMessage(message) } finally { setSending(null) }
  }

  async function changeBlock(blocked: boolean) {
    if (!messaging || savingBlock) return
    setSavingBlock(true)
    setError('')
    try {
      await messaging.setBlocked(blocked)
      setConfirmBlock(false)
    } catch (cause) {
      setError(errorMessage(cause))
      setConfirmBlock(false)
    } finally {
      setSavingBlock(false)
    }
  }

  return (
    <Paper withBorder className="conversation">
      <header className="conversation-heading">
        <Anchor href="/berichten" className="back-to-threads"><ArrowLeft size={17} aria-hidden /> Gesprekken</Anchor>
        <Group gap={9} justify="space-between">
          <div><Title order={2}>{person.name}</Title><Text c="dimmed" size="sm">Sticker {thread.number}</Text></div>
          <Group gap={8}>
            {offer?.promisedTo ? <StatusStamp color="ochre">Beloofd</StatusStamp> : canWithdraw && (
              <span className="interest-stamp"><StatusStamp>Interesse getoond</StatusStamp></span>
            )}
            {messaging && (messaging.blocked ? (
              <Button size="compact-sm" variant="subtle" loading={savingBlock}
                onClick={() => void changeBlock(false)}>Deblokkeren</Button>
            ) : (
              <Button size="compact-sm" variant="subtle" color="red" leftSection={<Ban size={15} aria-hidden />}
                onClick={() => setConfirmBlock(true)}>Blokkeren</Button>
            ))}
            <Button size="compact-sm" variant="subtle" color="red" leftSection={<Trash2 size={15} aria-hidden />}
              disabled={!!sending || savingBlock} onClick={requestRemoval}>Verwijderen</Button>
          </Group>
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
            {message.delivery === 'pending' && !messaging?.blocked && (
              <Group gap="xs" mt={4}>
                <Text size="xs">{sending === message.id ? 'Bezig met versturen…' : 'Verzending nog niet bevestigd'}</Text>
                <Button size="compact-xs" variant="subtle" disabled={!!sending} onClick={() => void retry(message)}>Verstuur opnieuw</Button>
              </Group>
            )}
          </div>
        ))}
      </div>
      <Stack p="md" gap="xs">
        {error && <Text role="alert" c="red">{error}</Text>}
        {messaging?.blocked ? <Text role="status">Je hebt {person.name} geblokkeerd.</Text> : (
          <form className="compose" onSubmit={(event) => { event.preventDefault(); void send() }}>
            <Textarea aria-label="Bericht" placeholder="Schrijf een bericht" enterKeyHint="send" autosize minRows={1} maxRows={4}
              maxLength={1000} value={draft} readOnly={!!sending} onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
                event.preventDefault()
                if (!event.repeat) event.currentTarget.form?.requestSubmit()
              }} />
            <Button type="submit" disabled={!draft.trim()} loading={!!sending} leftSection={<Send size={16} aria-hidden />}>Verstuur</Button>
          </form>
        )}
        {!sendMessage && <Button variant="subtle" size="compact-sm" className="simulate-reply" loading={exampleBusy}
          rightSection={<ArrowUpRight size={15} aria-hidden />} onClick={async () => {
            setExampleBusy(true)
            try { await update({ type: 'exampleReply', threadId: thread.id }) } catch { /* App displays the error. */ } finally { setExampleBusy(false) }
          }}>Ontvang een voorbeeldbericht</Button>}
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
      <Modal opened={confirmBlock} onClose={() => { if (!savingBlock) setConfirmBlock(false) }}
        closeOnEscape={!savingBlock} closeOnClickOutside={!savingBlock} withCloseButton={!savingBlock}
        centered title={`${person.name} blokkeren?`}>
        <Stack>
          <Text>We wissen alle ongelezen berichten van {person.name} uit je inbox. Jullie kunnen elkaar pas weer berichten sturen als je de blokkade opheft.</Text>
          <Group justify="flex-end">
            <Button variant="default" disabled={savingBlock} onClick={() => setConfirmBlock(false)}>Annuleren</Button>
            <Button color="red" loading={savingBlock} onClick={() => void changeBlock(true)}>Blokkeren</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
