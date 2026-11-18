import { useState } from 'react'
import { ActionIcon, Button, Group, Modal, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { Check, ClipboardList, Minus, Plus, Search } from 'lucide-react'
import { albumSize, catalog, copyLabel, errorMessage, myOffers, parseStickerNumbers, themeFor, type Command, type DemoState, type Update } from '../demo'
import { AlbumProgress, EmptyState, PageHeading, StatusStamp } from '../ui'

const filters = [
  { id: 'all', label: 'Alle stickers' }, { id: 'wanted', label: 'Zoek ik' },
  { id: 'owned', label: 'Heb ik' }, { id: 'double', label: 'Dubbel' },
] as const
type Filter = (typeof filters)[number]['id']
type AlbumUpdate = Extract<Command, { type: 'album' }>

export function AlbumPage({ state, update }: { state: DemoState; update: Update }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [bulk, setBulk] = useState(false)
  const [bulkInput, setBulkInput] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const doubleCounts = new Map<number, number>()
  for (const offer of myOffers(state)) doubleCounts.set(offer.number, (doubleCounts.get(offer.number) ?? 0) + 1)
  const numbers = catalog.filter((number) => String(number).includes(search.trim()) &&
    (filter === 'all' || (filter === 'double' ? doubleCounts.has(number) : state.album[number] === filter)))
  const copies = selected === null ? [] : myOffers(state, selected)
  const canRemove = copies.some((offer) => !offer.promisedTo && offer.interested.length === 0)

  async function save(command: Command, label: string, close = false) {
    setBusy(true)
    try {
      await update(command, { inlineError: bulk })
      setFeedback(label)
      if (close) {
        setSelected(null)
        setBulk(false)
      }
    } catch (cause) {
      if (bulk) setBulkError(errorMessage(cause))
    } finally { setBusy(false) }
  }

  function applyBulk(status: AlbumUpdate['status']) {
    const numbers = parseStickerNumbers(bulkInput)
    if (!numbers) {
      setBulkError(`Vul nummers van 1 tot en met ${albumSize} in, gescheiden door komma’s of spaties.`)
      return
    }
    setBulkError(null)
    void save({ type: 'album', numbers, status }, `${numbers.length} ${numbers.length === 1 ? 'nummer' : 'nummers'} bijgewerkt.`, true)
  }

  return (
    <>
      <PageHeading title="Mijn album" description="Open een stickernummer om bij te houden wat je hebt en wat je nog zoekt."
        side={<Button leftSection={<ClipboardList size={19} aria-hidden />} onClick={() => {
          setBulkInput('')
          setBulkError(null)
          setBulk(true)
        }}>Meerdere nummers</Button>} />
      <div className="album-layout">
        <section aria-label="Stickerlijst">
          <div className="album-toolbar">
            <TextInput aria-label="Zoek in je album op stickernummer" placeholder="Zoek op stickernummer"
              leftSection={<Search size={18} aria-hidden />} inputMode="numeric" value={search}
              onChange={(event) => setSearch(event.currentTarget.value)} />
            <div className="filter-buttons" role="group" aria-label="Filter je album">
              {filters.map(({ id, label }) => (
                <Button key={id} size="compact-sm" variant={filter === id ? 'filled' : 'subtle'} aria-pressed={filter === id}
                  onClick={() => setFilter(id)}>{label}</Button>
              ))}
            </div>
          </div>
          <Text className="album-feedback" size="sm" role="status" c="dimmed">{feedback}</Text>
          {numbers.length ? (
            <div className="album-grid">
              {numbers.map((number) => {
                const count = doubleCounts.get(number) ?? 0
                const status = count ? 'double' : state.album[number] ?? 'unset'
                const badge = status === 'double' ? `+${count} dubbel` : status === 'owned' ? 'Heb ik' : status === 'wanted' ? 'Zoek ik' : ''
                return (
                  <button key={number} type="button" className="album-cell" data-status={status}
                    aria-label={`Sticker ${number}, ${badge || 'nog niet ingevuld'}`} onClick={() => setSelected(number)}>
                    <strong>{number}</strong>
                    {badge && <span key={badge} className="cell-state">{status === 'owned' && <Check size={13} aria-hidden />}{badge}</span>}
                  </button>
                )
              })}
            </div>
          ) : <EmptyState title="Geen stickers gevonden">Probeer een ander nummer of kies ‘Alle stickers’.</EmptyState>}
        </section>
        <aside><AlbumProgress state={state} /></aside>
      </div>

      <Modal centered opened={selected !== null} onClose={() => setSelected(null)}
        title={selected === null ? '' : `Sticker ${selected}`} closeButtonProps={{ 'aria-label': 'Sluit sticker' }}>
        {selected !== null && (
          <Stack>
            <Group gap="xs">
              {themeFor(selected) && <Text c="dimmed">{themeFor(selected)}</Text>}
              <StatusStamp color={state.album[selected] === 'wanted' ? 'ochre' : 'olive'}>
                {state.album[selected] === 'wanted' ? 'Zoek ik' : state.album[selected] === 'owned' ? 'Heb ik' : 'Nog leeg'}
              </StatusStamp>
            </Group>
            <Group grow>
              <Button variant="light" disabled={!!copies.length || busy}
                onClick={() => void save({ type: 'album', numbers: [selected], status: 'wanted' }, `Je zoekt sticker ${selected}.`, true)}>Zoek ik</Button>
              <Button disabled={busy}
                onClick={() => void save({ type: 'album', numbers: [selected], status: 'owned' }, `Sticker ${selected} staat in je album.`, true)}>Heb ik</Button>
            </Group>
            <Paper withBorder p="md">
              <Group justify="space-between" wrap="nowrap">
                <div><Title order={3} size="h5">Dubbelen</Title><Text c="dimmed" size="sm">{copyLabel(copies.length)} in je aanbod</Text></div>
                <Group gap={8} wrap="nowrap">
                  <ActionIcon size="lg" variant="light" disabled={!canRemove || busy} aria-label="Haal een dubbel uit je aanbod"
                    onClick={() => void save({ type: 'removeDouble', number: selected }, 'Een dubbel verwijderd.')}>
                    <Minus size={20} />
                  </ActionIcon>
                  <ActionIcon size="lg" variant="filled" disabled={busy} aria-label="Voeg een dubbel toe aan je aanbod"
                    onClick={() => void save({ type: 'album', numbers: [selected], status: 'double' }, 'Een dubbel toegevoegd.')}>
                    <Plus size={20} />
                  </ActionIcon>
                </Group>
              </Group>
              {!!copies.length && !canRemove && <Text mt="xs" size="sm" c="dimmed">Beheer geïnteresseerde of beloofde exemplaren via Mijn aanbod.</Text>}
            </Paper>
            {state.album[selected] && !copies.length && (
              <Button variant="subtle" disabled={busy}
                onClick={() => void save({ type: 'album', numbers: [selected], status: 'clear' }, `Sticker ${selected} is weer leeg.`, true)}>Haal markering weg</Button>
            )}
          </Stack>
        )}
      </Modal>

      <Modal centered opened={bulk} onClose={() => setBulk(false)} title="Meerdere nummers invullen"
        closeButtonProps={{ 'aria-label': 'Sluit meerdere nummers' }}>
        <Stack>
          <TextInput label="Stickernummers" placeholder="Bijvoorbeeld 12, 34, 80" description="Gebruik komma’s of spaties."
            value={bulkInput} error={bulkError} onChange={(event) => { setBulkInput(event.currentTarget.value); setBulkError(null) }} />
          <Group grow>
            <Button variant="light" disabled={busy} onClick={() => applyBulk('wanted')}>Zoek ik</Button>
            <Button variant="light" disabled={busy} onClick={() => applyBulk('owned')}>Heb ik</Button>
            <Button disabled={busy} onClick={() => applyBulk('double')}>Voeg dubbelen toe</Button>
          </Group>
          <Text c="dimmed" size="sm">Voor elk opgegeven nummer voeg je één dubbel toe.</Text>
        </Stack>
      </Modal>
    </>
  )
}
