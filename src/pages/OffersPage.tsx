import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { usePaginatedQuery } from 'convex-helpers/react'
import { Avatar, Button, Group, Modal, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ArrowLeftRight, ArrowRight, Check, HandHeart, Search, Settings2 } from 'lucide-react'
import type { District } from '../../convex/districts'
import { SearchDistrictsField } from '../DistrictFields'
import { defaultMarketplacePreferences, MarketplacePreferences } from '../MarketplacePreferences'
import { EmptyState, AlbumProgress, StatusStamp, StickerDetails, StickerNumber, PhotoCredit } from '../ui'
import { initialsFor, interestLabel, myOffers, personFor, type DemoState, type Offer, type Update } from '../demo'
import { catalog, matchesSticker, stickerFor } from '../catalog'
import { api } from '../../convex/_generated/api'

const filters = [
  { id: 'available', label: 'Beschikbaar' },
  { id: 'wanted', label: 'Die ik zoek' },
  { id: 'interest', label: 'Mijn interesse' },
  { id: 'mine', label: 'Mijn aanbod' },
] as const
type Filter = (typeof filters)[number]['id']

const pageSize = 24

export function requestedSticker() {
  const value = new URLSearchParams(location.search).get('sticker')
  const number = value && /^\d{1,3}$/u.test(value) ? Number(value) : 0
  return number && stickerFor(number) ? String(number) : ''
}

export function OfferCover({ signedIn }: { signedIn: boolean }) {
  const number = requestedSticker()
  const join = number ? `/inloggen?sticker=${number}` : '/inloggen'
  return (
  <section className="album-cover" aria-labelledby="cover-title">
    <div className="cover-text">
      <p className="cover-kicker">Zwolle · De Stad Ontrafeld</p>
      <Title order={1} id="cover-title" tabIndex={-1}>Maak je album<br />compleet</Title>
      <Text>Vind de stickers die je nog zoekt en ruil je dubbelen met andere verzamelaars.</Text>
      <Button component="a" href={signedIn ? '#aanbod' : join} data-reload={!signedIn && !!number || undefined} color="ochre.4" c="dark.9"
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
  const [districtOverride, setDistrictOverride] = useState<District[]>()
  const districts = districtOverride ?? state.searchDistricts ?? []
  const isBrowsing = filter === 'available' || filter === 'wanted'
  const preferences = state.marketplacePreferences ?? defaultMarketplacePreferences
  const filterUnanswered = isBrowsing && preferences.hideUnanswered
  const filterBlocked = isBrowsing && preferences.hideBlocked
  const [linkedSticker, setLinkedSticker] = useState(requestedSticker)
  const [search, setSearch] = useState(linkedSticker)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [debouncedSearch] = useDebouncedValue(search.trim(), 250)
  const searchText = signedIn ? debouncedSearch : search.trim()
  function matchesSearch(sticker: (typeof catalog)[number]) {
    return linkedSticker ? sticker.number === Number(linkedSticker) : matchesSticker(sticker, searchText)
  }

  const loadOwnOffers = signedIn && filter === 'mine'
  const ownOffers = useQuery(api.exchange.get, loadOwnOffers ? { view: 'offers' } : 'skip')
  const viewState = ownOffers ?? state
  const useMarketplace = signedIn && filter !== 'mine'
  const scope = filter === 'wanted' || linkedSticker || searchText
    ? catalog.filter((sticker) => matchesSearch(sticker) &&
        (filter !== 'wanted' || state.album[sticker.number] === 'wanted')).map(({ number }) => number)
    : null
  const market = usePaginatedQuery(api.marketplace.list, useMarketplace ? {
    filter: filter === 'interest' ? 'interest' : 'available',
    numbers: scope,
    districts: isBrowsing ? districts : [],
    prioritizeMatches: isBrowsing || undefined,
    hideUnanswered: filterUnanswered || undefined,
    hideBlocked: filterBlocked || undefined,
    indexedInterests: filter === 'interest' || undefined,
  } : 'skip', { initialNumItems: pageSize })
  const more = useMarketplace && (market.status === 'CanLoadMore' || market.status === 'LoadingMore')
  const loading = (loadOwnOffers && ownOffers === undefined) || (useMarketplace && market.status === 'LoadingFirstPage')
  const listings = new Map<string, (typeof market.results)[number]>(market.results.map((item) => [item.offer.id, item]))
  const doubles = myOffers(viewState)

  useEffect(() => {
    if (linkedSticker && location.hash === '#aanbod') document.getElementById('aanbod')?.scrollIntoView()
  }, [linkedSticker])

  function canTrade(offer: Offer) {
    if (offer.owner === 'me' || offer.promisedTo) return false
    const listing = listings.get(offer.id)
    if (listing) return listing.canTrade
    return state.album[offer.number] === 'wanted' && doubles.some((mine) =>
      !mine.promisedTo && personFor(offer.owner, viewState).wants.includes(mine.number),
    )
  }

  function offerName(offer: Offer) {
    return listings.get(offer.id)?.displayName ?? personFor(offer.owner, viewState).name
  }

  const source = useMarketplace ? market.results.map(({ offer }) => offer) : viewState.offers
  const offers = source.filter((offer) => {
    if (useMarketplace) return true
    const sticker = stickerFor(offer.number)
    if (!sticker || !matchesSearch(sticker)) return false
    if (isBrowsing && districts.length) {
      const district = personFor(offer.owner, viewState).district
      if (!district || !districts.includes(district)) return false
    }
    switch (filter) {
      case 'mine': return offer.owner === 'me'
      case 'interest': return offer.interested.includes('me')
      case 'wanted': return offer.owner !== 'me' && !offer.promisedTo && state.album[offer.number] === 'wanted'
      case 'available': return offer.owner !== 'me' && !offer.promisedTo
    }
  })
  if (!useMarketplace) {
    offers.sort((first, second) =>
      (isBrowsing ? Number(canTrade(second)) - Number(canTrade(first)) : 0) || first.number - second.number,
    )
  }
  const selected = offers.find((offer) => offer.id === selectedId)

  async function handle(updateCall: () => Promise<unknown>) {
    setBusy(true)
    try { await updateCall() } catch { /* App displays the error. */ } finally { setBusy(false) }
  }

  async function openThread(offer: Offer, person?: string) {
    const existing = viewState.threads.find((thread) => thread.offerId === offer.id && thread.person === (person ?? offer.owner))
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
            {!loading && <Text c="dimmed" size="sm" aria-live="polite" aria-atomic="true">
              {offers.length} {offers.length === 1 ? 'exemplaar' : 'exemplaren'}{more && ' getoond'}
            </Text>}
          </div>
          <div className="browse-toolbar">
            <div className="browse-search">
              <TextInput aria-label="Zoek in het aanbod op nummer of naam" placeholder="Zoek op nummer of naam"
                leftSection={<Search size={18} aria-hidden />}
                value={search} onChange={(event) => { setLinkedSticker(''); setSearch(event.currentTarget.value) }} />
              {isBrowsing && <SearchDistrictsField inOffers value={districts} onChange={setDistrictOverride} />}
            </div>
            <div className="filter-buttons" role="group" aria-label="Filter het aanbod">
              {filters.map(({ id, label }) => (
                <Button key={id} size="compact-sm" variant={filter === id ? 'filled' : 'subtle'}
                  aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</Button>
              ))}
            </div>
            {signedIn && isBrowsing && (
              <div className="marketplace-preferences">
                <MarketplacePreferences preferences={preferences} />
              </div>
            )}
          </div>
          {feedback && <Text role="status" c="dimmed" mb="xs">{feedback}</Text>}

          {loading ? <Text role="status">Aanbod laden…</Text> : offers.length ? (
            <div className="offers">
              {offers.map((offer) => {
                const mine = offer.owner === 'me'
                const match = canTrade(offer)
                const sticker = stickerFor(offer.number)
                const active = offer.interested.includes('me')
                const ownerName = offerName(offer)
                const listing = listings.get(offer.id)
                const ownerDistrict = listing ? listing.district : personFor(offer.owner, viewState).district
                const label = mine ? 'Beheer exemplaar' : active ? 'Bekijk gesprek' : 'Ik wil deze sticker'
                return (
                  <Paper key={offer.id} className="offer paper-in" data-match={match || undefined} component="article" withBorder>
                    <div className="offer-art" data-theme={sticker?.theme}>
                      <StickerNumber number={offer.number} />
                    </div>
                    {match && <div className="trade-match">
                      <span><ArrowLeftRight size={16} aria-hidden /> Ruilmatch</span>
                      <small>Jullie hebben allebei een sticker die de ander zoekt.</small>
                    </div>}
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
                        <Avatar size={34} color="ochre" aria-hidden>{initialsFor(ownerName)}</Avatar>
                        <div>
                          <Text size="sm" fw={700}>{ownerName}</Text>
                          {ownerDistrict && <Text size="sm" c="dimmed">{ownerDistrict}</Text>}
                          <Text size="sm" c="dimmed">{interestLabel(offer.interestCount ?? offer.interested.length)}</Text>
                        </div>
                      </Group>
                      <Button fullWidth size="sm" variant={active ? 'light' : 'outline'} disabled={!mine && !!offer.promisedTo && !active}
                        leftSection={mine ? <Settings2 size={15} aria-hidden /> : active ? <Check size={15} aria-hidden /> : undefined}
                        aria-label={`${label} · sticker ${offer.number} van ${ownerName}`}
                        onClick={() => active ? void handle(() => openThread(offer)) : setSelectedId(offer.id)}>
                        {label}
                      </Button>
                    </div>
                  </Paper>
                )
              })}
            </div>
          ) : more ? <Text c="dimmed">Geen passende exemplaren in de geladen resultaten.</Text> : (
            <EmptyState title={filter === 'mine' ? 'Nog geen dubbelen aangeboden' : 'Geen stickers gevonden'}>
              {filter === 'mine' ? 'Zet een dubbel exemplaar in je album om het hier aan te bieden.' : isBrowsing && districts.length ? 'Pas de wijken aan of wis het wijkfilter.' : filterUnanswered || filterBlocked ? 'Pas je filters aan of zoek op een ander nummer.' : 'Probeer een ander nummer of een andere selectie.'}
            </EmptyState>
          )}
          {more && <Group justify="center" mt="md">
            <Button variant="light" loading={market.status === 'LoadingMore'} onClick={() => market.loadMore(pageSize)}>
              Laad meer aanbod
            </Button>
          </Group>}
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
                <Text>Beloofd aan <strong>{personFor(selected.promisedTo, viewState).name}</strong></Text>
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
                    <Text fw={700} mb={6}>{personFor(person, viewState).name}</Text>
                    <Group gap="xs">
                      <Button size="compact-sm" loading={busy} onClick={() => void handle(() => update({ type: 'promise', offerId: selected.id, person }))}>Beloof aan {personFor(person, viewState).name.split(' ')[0]}</Button>
                      <Button size="compact-sm" variant="light" disabled={busy} onClick={() => void handle(() => openThread(selected, person))}>Open gesprek</Button>
                    </Group>
                  </Paper>
                ))}
              </>
            )}
          </Stack>
        ) : selected && (
          <Stack>
            <Text>Toon interesse en open een privégesprek met {offerName(selected)}.</Text>
            <Button loading={busy} disabled={!!selected.promisedTo}
              leftSection={<HandHeart size={19} aria-hidden />} onClick={() => void handle(() => openThread(selected))}>Toon interesse</Button>
          </Stack>
        )}
      </Modal>
    </>
  )
}
