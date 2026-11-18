import { useState } from 'react'
import { Avatar, Button, Group, Modal, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { ArrowRight, Check, HandHeart, Search, Settings2 } from 'lucide-react'
import { EmptyState, AlbumProgress, StatusStamp, StickerDetails, StickerNumber, PhotoCredit } from '../ui'
import { interestLabel, myOffers, personFor, type DemoState, type Offer, type Update } from '../demo'
import { matchesSticker, stickerFor } from '../catalog'

const filters = [
  { id: 'available', label: 'Beschikbaar' },
  { id: 'wanted', label: 'Die ik zoek' },
  { id: 'interest', label: 'Mijn interesse' },
  { id: 'mine', label: 'Mijn aanbod' },
] as const
type Filter = (typeof filters)[number]['id']

export function OfferCover({ signedIn }: { signedIn: boolean }) {
  return (
  <section className="album-cover" aria-labelledby="cover-title">
    <div className="cover-text">
      <p className="cover-kicker">Zwolle · De Stad Ontrafeld</p>
      <Title order={1} id="cover-title" tabIndex={-1}>Maak je album<br />compleet</Title>
      <Text>Vind de stickers die je nog zoekt en ruil je dubbelen met andere verzamelaars.</Text>
      <Button component="a" href={signedIn ? '#aanbod' : '/inloggen'} color="ochre.4" c="dark.9"
        rightSection={<ArrowRight size={18} aria-hidden />}>{signedIn ? 'Bekijk de stickers' : 'Ik wil ook stickers ruilen'}</Button>
    </div>
    <div className="cover-photo" role="img" aria-label="De Peperbus en de binnenstad van Zwolle" />
  </section>
  )
}

export function OffersPage({ state, update, navigate, signedIn }: {
  state: DemoState
  update: Update
  navigate: (path: string) => void
  signedIn: boolean
}) {
  const [filter, setFilter] = useState<Filter>('available')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const selected = state.offers.find((offer) => offer.id === selectedId)
  const doubles = myOffers(state)

  function canTrade(offer: Offer) {
    return state.album[offer.number] === 'wanted' && doubles.some((mine) =>
      !mine.promisedTo && personFor(offer.owner, state).wants.includes(mine.number),
    )
  }

  const offers = state.offers.filter((offer) => {
    const sticker = stickerFor(offer.number)
    if (!sticker || !matchesSticker(sticker, search)) return false
    switch (filter) {
      case 'mine': return offer.owner === 'me'
      case 'interest': return offer.interested.includes('me')
      case 'wanted': return offer.owner !== 'me' && !offer.promisedTo && state.album[offer.number] === 'wanted'
      case 'available': return offer.owner !== 'me' && !offer.promisedTo
    }
  }).sort((first, second) => Number(canTrade(second)) - Number(canTrade(first)))

  async function handle(updateCall: () => Promise<unknown>) {
    setBusy(true)
    try { await updateCall() } catch { /* App displays the error. */ } finally { setBusy(false) }
  }

  async function openThread(offer: Offer, person?: string) {
    const existing = state.threads.find((thread) => thread.offerId === offer.id && thread.person === (person ?? offer.owner))
    if (existing && (person || offer.interested.includes('me'))) {
      setSelectedId(null)
      navigate(`/berichten/${existing.id}`)
      return
    }
    const id = await update(person ? { type: 'openThread', offerId: offer.id, person } : { type: 'want', offerId: offer.id })
    if (id) {
      setSelectedId(null)
      navigate(`/berichten/${id}`)
    }
  }

  return (
    <>
      <OfferCover signedIn={signedIn} />

      <div className="browse-layout">
        <section id="aanbod" aria-labelledby="browse-title" className="browse">
          <div className="browse-title">
            <Title order={2} id="browse-title">Ruilaanbod</Title>
            <Text c="dimmed" size="sm" aria-live="polite">{offers.length} {offers.length === 1 ? 'exemplaar' : 'exemplaren'}</Text>
          </div>
          <div className="browse-toolbar">
            <TextInput aria-label="Zoek in het aanbod op nummer of naam" placeholder="Zoek op nummer of naam"
              leftSection={<Search size={18} aria-hidden />}
              value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
            <div className="filter-buttons" role="group" aria-label="Filter het aanbod">
              {filters.map(({ id, label }) => (
                <Button key={id} size="compact-sm" variant={filter === id ? 'filled' : 'subtle'}
                  aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</Button>
              ))}
            </div>
          </div>
          {feedback && <Text role="status" c="dimmed" mb="xs">{feedback}</Text>}

          {offers.length ? (
            <div className="offers">
              {offers.map((offer) => {
                const mine = offer.owner === 'me'
                const sticker = stickerFor(offer.number)
                const active = offer.interested.includes('me')
                const owner = personFor(offer.owner, state)
                const label = mine ? 'Beheer exemplaar' : active ? 'Bekijk gesprek' : 'Ik wil deze sticker'
                return (
                  <Paper key={offer.id} className="offer paper-in" component="article" withBorder>
                    <div className="offer-art" data-theme={sticker?.theme}>
                      <StickerNumber number={offer.number} />
                      {canTrade(offer) && <span className="trade-tag">Jullie kunnen ruilen</span>}
                    </div>
                    <div className="offer-body">
                      <Group justify="space-between" gap={6}>
                        <Title order={3}>Sticker {offer.number}</Title>
                        <StatusStamp color={offer.promisedTo ? 'ochre' : 'olive'}>{offer.promisedTo ? 'Beloofd' : 'Beschikbaar'}</StatusStamp>
                      </Group>
                      {sticker && <div>
                        <Text fw={600} lh={1.2}>{sticker.title}</Text>
                        <Text c="dimmed" size="xs" mt={3}>{sticker.theme} · pagina {sticker.page}</Text>
                      </div>}
                      <Group gap={8} className="offer-person" wrap="nowrap">
                        <Avatar size={34} color="ochre" aria-hidden>{owner.initials}</Avatar>
                        <div><Text size="sm" fw={700}>{mine ? state.displayName : owner.name}</Text><Text size="sm" c="dimmed">{interestLabel(offer.interestCount ?? offer.interested.length)}</Text></div>
                      </Group>
                      <Button fullWidth size="sm" variant={active ? 'light' : 'outline'} disabled={!mine && !!offer.promisedTo && !active}
                        leftSection={mine ? <Settings2 size={15} aria-hidden /> : active ? <Check size={15} aria-hidden /> : undefined}
                        aria-label={`${label} · sticker ${offer.number} van ${mine ? state.displayName : owner.name}`}
                        onClick={() => active ? void handle(() => openThread(offer)) : setSelectedId(offer.id)}>
                        {label}
                      </Button>
                    </div>
                  </Paper>
                )
              })}
            </div>
          ) : (
            <EmptyState title={filter === 'mine' ? 'Nog geen dubbelen aangeboden' : 'Geen stickers gevonden'}>
              {filter === 'mine' ? 'Zet een dubbel exemplaar in je album om het hier aan te bieden.' : 'Probeer een ander nummer of een andere selectie.'}
            </EmptyState>
          )}
        </section>
        <aside className="album-aside"><AlbumProgress state={state} showLink /></aside>
      </div>
      <PhotoCredit />

      <Modal opened={!!selected} onClose={() => setSelectedId(null)} centered
        title={selected ? `Sticker ${selected.number}` : ''} closeButtonProps={{ 'aria-label': 'Sluit stickerdetails' }}>
        {selected && <div className="offer-sticker-details"><StickerDetails number={selected.number} /></div>}
        {selected?.owner === 'me' ? (
          <Stack>
            {selected.promisedTo ? (
              <>
                <Text>Beloofd aan <strong>{personFor(selected.promisedTo, state).name}</strong></Text>
                <Button variant="outline" disabled={busy} onClick={() => {
                  const person = selected.promisedTo
                  if (person) void handle(() => openThread(selected, person))
                }}>Open gesprek</Button>
                <Button loading={busy} onClick={() => void handle(async () => {
                  await update({ type: 'finish', offerId: selected.id, expectedRecipient: selected.promisedTo ?? undefined })
                  setFeedback(`Sticker ${selected.number} is weggegeven.`)
                  setSelectedId(null)
                })}>Markeer als weggegeven</Button>
                <Button variant="light" disabled={busy} onClick={() => void handle(() => update({ type: 'promise', offerId: selected.id, person: null, expectedRecipient: selected.promisedTo ?? undefined }))}>Geef weer vrij</Button>
              </>
            ) : (
              <>
                <Text fw={700}>{interestLabel(selected.interested.length)}</Text>
                {selected.interested.length === 0 && <Text c="dimmed">Zodra iemand de sticker wil, verschijnt die persoon hier.</Text>}
                {selected.interested.map((person) => (
                  <Paper key={person} withBorder p="sm">
                    <Text fw={700} mb={6}>{personFor(person, state).name}</Text>
                    <Group gap="xs">
                      <Button size="compact-sm" loading={busy} onClick={() => void handle(() => update({ type: 'promise', offerId: selected.id, person }))}>Beloof aan {personFor(person, state).name.split(' ')[0]}</Button>
                      <Button size="compact-sm" variant="light" disabled={busy} onClick={() => void handle(() => openThread(selected, person))}>Open gesprek</Button>
                    </Group>
                  </Paper>
                ))}
              </>
            )}
          </Stack>
        ) : selected && (
          <Stack>
            <Text>Toon interesse en open een privégesprek met {personFor(selected.owner, state).name}.</Text>
            <Button loading={busy} disabled={!!selected.promisedTo}
              leftSection={<HandHeart size={19} aria-hidden />} onClick={() => void handle(() => openThread(selected))}>Toon interesse</Button>
          </Stack>
        )}
      </Modal>
    </>
  )
}
