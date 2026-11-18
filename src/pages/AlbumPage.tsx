import { useRef, useState } from 'react'
import { Alert, Button, Group, Modal, Stack, Text, Textarea, TextInput, Title } from '@mantine/core'
import { CopyPlus, Search } from 'lucide-react'
import { albumSize, catalog, matchesSticker, themes } from '../catalog'
import { errorMessage, myOffers, parseStickerNumbers, type BulkMark as ApplyBulkMark, type Command, type DemoState, type Update } from '../demo'
import { AlbumProgress, EmptyState, PageHeading, StatusStamp, StickerDetails } from '../ui'

const filters = [
  { id: 'all', label: 'Alle stickers' }, { id: 'wanted', label: 'Zoek ik' },
  { id: 'double', label: 'Bied ik aan' }, { id: 'owned', label: 'In mijn album' },
] as const
type Filter = (typeof filters)[number]['id']
const batchActions = {
  wanted: { title: 'Vul alle nummers in die je nog nodig hebt', confirm: 'Deze nummers heb ik nog allemaal nodig', icon: Search },
  double: { title: 'Vul alle nummers in die je dubbel hebt', confirm: 'Deze nummers heb ik dubbel', icon: CopyPlus },
}
type BatchStatus = keyof typeof batchActions

export function AlbumPage({ state, update, markAlbum }: { state: DemoState; update: Update; markAlbum: ApplyBulkMark }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [singleError, setSingleError] = useState<string | null>(null)
  const bulkLauncher = useRef<HTMLButtonElement | null>(null)
  const selectedTile = useRef<HTMLButtonElement | null>(null)
  const searchField = useRef<HTMLInputElement | null>(null)
  const doubleCounts = new Map<number, number>()
  for (const offer of myOffers(state)) doubleCounts.set(offer.number, (doubleCounts.get(offer.number) ?? 0) + 1)
  const showTitles = !!search.trim()
  const stickers = catalog.filter((sticker) => matchesSticker(sticker, search) &&
    (filter === 'all' || (filter === 'double' ? doubleCounts.has(sticker.number) : state.album[sticker.number] === filter)))
  const copies = selected === null ? [] : myOffers(state, selected)
  const canRemove = copies.some((offer) => !offer.promisedTo && offer.interested.length === 0)

  function openBatch(status: BatchStatus, launcher: HTMLButtonElement) {
    bulkLauncher.current = launcher
    setBatchStatus(status)
  }

  function closeBatch() {
    setBatchStatus(null)
    requestAnimationFrame(() => bulkLauncher.current?.focus({ preventScroll: true }))
  }

  async function save(command: Command, label: string, close = true) {
    setBusy(true)
    setSingleError(null)
    try {
      await update(command, { inlineError: true })
      setFeedback(label)
      if (close) setSelected(null)
    } catch (cause) {
      setSingleError(errorMessage(cause))
    } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeading title="Mijn album" description="Zet op je zoeklijst wat je mist en bied je dubbelen aan."
        side={
          <Group className="album-heading-actions" gap="xs">
            <Button leftSection={<Search size={19} aria-hidden />} onClick={(event) => openBatch('wanted', event.currentTarget)}>
              {batchActions.wanted.title}
            </Button>
            <Button variant="light" leftSection={<CopyPlus size={18} aria-hidden />} onClick={(event) => openBatch('double', event.currentTarget)}>
              {batchActions.double.title}
            </Button>
          </Group>
        } />
      <div className="album-layout">
        <div className="album-toolbar">
          <TextInput ref={searchField} aria-label="Zoek in je album op nummer of naam" placeholder="Zoek op nummer of naam"
            leftSection={<Search size={18} aria-hidden />} value={search}
            onChange={(event) => setSearch(event.currentTarget.value)} />
          <div className="filter-buttons" role="group" aria-label="Filter je album">
            {filters.map(({ id, label }) => (
              <Button key={id} size="compact-sm" variant={filter === id ? 'filled' : 'subtle'} aria-pressed={filter === id}
                onClick={() => setFilter(id)}>{label}</Button>
            ))}
          </div>
        </div>
        <aside className="album-collection">
          <details className="collection-details">
            <summary>Mijn collectie</summary>
            <AlbumProgress state={state} />
          </details>
        </aside>
        <section className="album-list" aria-label="Stickerlijst">
          <Text className="album-feedback" size="sm" role="status" c="dimmed">{feedback}</Text>
          {stickers.length ? themes.map((theme) => {
            const group = stickers.filter((sticker) => sticker.theme === theme)
            return group.length > 0 && (
              <section className="album-theme" key={theme} aria-label={theme}>
                <Title order={2}>{theme}</Title>
                <div className="album-grid" data-results={showTitles || undefined}>
                  {group.map(({ number, title }) => {
                    const count = doubleCounts.get(number) ?? 0
                    const status = count ? 'double' : state.album[number] ?? 'unset'
                    const badge = status === 'double' ? `${count} in aanbod` : status === 'owned' ? 'In album' : status === 'wanted' ? 'Zoek ik' : ''
                    return (
                      <button key={number} type="button" className="album-cell" data-status={status}
                        aria-label={`Sticker ${number}, ${title}, ${badge || 'nog niet ingevuld'}`} onClick={(event) => {
                          selectedTile.current = event.currentTarget
                          setSingleError(null)
                          setSelected(number)
                        }}>
                        <strong>{number}</strong>
                        {showTitles && <span className="cell-title">{title}</span>}
                        {badge && <span key={badge} className="cell-state">{count ? `${count} dubbel` : badge}</span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          }) : <EmptyState title="Geen stickers gevonden">Probeer een ander nummer, een andere naam of kies ‘Alle stickers’.</EmptyState>}
        </section>
      </div>

      <Modal centered opened={selected !== null} onClose={() => { if (!busy) setSelected(null) }}
        onExitTransitionEnd={() => {
          if (!selectedTile.current?.isConnected && document.activeElement === document.body) searchField.current?.focus()
        }}
        title={selected === null ? '' : `Sticker ${selected}`} closeButtonProps={{ 'aria-label': 'Sluit sticker', disabled: busy }}>
        {selected !== null && (
          <Stack gap="sm">
            <StickerDetails number={selected} />
            {copies.length ? <Group><StatusStamp>{copies.length} in je aanbod</StatusStamp></Group>
              : state.album[selected] && (
                <Group><StatusStamp color={state.album[selected] === 'wanted' ? 'ochre' : 'gray'}>
                  {state.album[selected] === 'wanted' ? 'Op je zoeklijst' : 'In je album'}
                </StatusStamp></Group>
              )}

            <Button fullWidth leftSection={<CopyPlus size={21} aria-hidden />} disabled={busy}
              onClick={() => void save({ type: 'album', numbers: [selected], status: 'double' }, `Sticker ${selected} staat in je aanbod.`)}>
              {copies.length ? 'Bied nog een dubbel aan' : 'Ik heb deze dubbel'}
            </Button>
            <Text size="sm" c="dimmed">Er komt één exemplaar bij in ‘Mijn aanbod’.</Text>

            <Button fullWidth variant="light" leftSection={<Search size={20} aria-hidden />}
              disabled={!!copies.length || busy || state.album[selected] === 'wanted'}
              onClick={() => void save({ type: 'album', numbers: [selected], status: 'wanted' }, `Sticker ${selected} staat op je zoeklijst.`)}>
              Zoek ik
            </Button>

            <Group className="collection-actions" gap="xs">
              {!copies.length && state.album[selected] !== 'owned' && (
                <Button size="sm" variant="subtle" disabled={busy}
                  onClick={() => void save({ type: 'album', numbers: [selected], status: 'owned' }, `Sticker ${selected} staat in je album.`)}>Alleen afvinken</Button>
              )}
              {!copies.length && state.album[selected] && (
                <Button size="sm" variant="subtle" color="gray" disabled={busy}
                  onClick={() => void save({ type: 'album', numbers: [selected], status: 'clear' }, `Sticker ${selected} is weer leeg.`)}>Markering wissen</Button>
              )}
              {!!copies.length && canRemove && (
                <Button size="sm" variant="subtle" disabled={busy}
                  onClick={() => void save({ type: 'removeDouble', number: selected }, 'Eén exemplaar uit je aanbod gehaald.', false)}>Haal één dubbel uit aanbod</Button>
              )}
            </Group>
            {!!copies.length && !canRemove && <Text size="sm" c="dimmed">Dit aanbod heeft interesse of is beloofd. Bekijk het bij ‘Mijn aanbod’.</Text>}
            {singleError && <Alert color="red" role="alert">{singleError}</Alert>}
          </Stack>
        )}
      </Modal>

      {batchStatus && (
        <StickerBatch status={batchStatus} markAlbum={markAlbum} onClose={closeBatch} onSaved={(message) => {
          setFeedback(message)
          closeBatch()
        }} />
      )}
    </>
  )
}

function StickerBatch({ status, markAlbum, onClose, onSaved }: {
  status: BatchStatus
  markAlbum: ApplyBulkMark
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { title, confirm, icon: Icon } = batchActions[status]

  async function mark() {
    if (busy) return
    const selection = parseStickerNumbers(input)
    if (!selection) {
      setInputError(`Gebruik nummers van 1 tot en met ${albumSize}, met komma’s of spaties ertussen.`)
      return
    }
    setBusy(true)
    setSubmitError(null)
    try {
      const { changed, protectedCount } = await markAlbum({ scope: selection, status })
      if (status === 'double') {
        onSaved(changed === 0 ? 'Deze stickers staan al in je aanbod.' :
          changed === 1 ? '1 dubbel toegevoegd aan je aanbod.' : `${changed} dubbelen toegevoegd aan je aanbod.`)
        return
      }
      const added = changed ? `${changed === 1 ? '1 sticker' : `${changed} stickers`} op je zoeklijst gezet.` : ''
      const kept = protectedCount ? `${protectedCount === 1 ? '1 sticker blijft' : `${protectedCount} stickers blijven`} in je aanbod.` : ''
      onSaved([added, kept].filter(Boolean).join(' ') || 'Deze stickers staan al op je zoeklijst.')
    } catch (cause) {
      setSubmitError(errorMessage(cause))
    } finally { setBusy(false) }
  }

  return (
    <Modal opened centered onClose={() => { if (!busy) onClose() }}
      title={title}
      closeButtonProps={{ 'aria-label': 'Sluit stickernummers', disabled: busy }}>
      <form onSubmit={(event) => { event.preventDefault(); void mark() }}>
        <Stack gap="sm">
          <Textarea label="Stickernummers" placeholder="12, 34, 80" description="Scheid de nummers met komma’s, spaties of nieuwe regels."
            data-autofocus value={input} error={inputError} disabled={busy} autosize minRows={3} maxRows={7}
            onChange={(event) => { setInput(event.currentTarget.value); setInputError(null); setSubmitError(null) }} />
          {submitError && <Alert color="red" role="alert">{submitError}</Alert>}
          <Button type="submit" className="batch-confirm" leftSection={<Icon size={20} aria-hidden />} loading={busy} disabled={!input.trim()}>
            {confirm}
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
