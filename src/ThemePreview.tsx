import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon, Badge, Button, Group, MantineProvider, Modal, Paper, Progress,
  SegmentedControl, Stack, Text, TextInput, Title, useMantineTheme,
} from '@mantine/core'
import {
  ArrowLeftRight, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight,
  MessageCircle, Search, Sticker as StickerIcon,
} from 'lucide-react'
import { albumTheme, albumVariables } from './theme'

const stickers = [
  { number: 34, theme: 'Water', initials: 'NV', owner: 'Noor V.', status: 'Beschikbaar', interest: 0 },
  { number: 80, theme: 'Knooppunten', initials: 'SB', owner: 'Sam B.', status: 'Beschikbaar', interest: 1 },
  { number: 126, theme: 'Thuis', initials: 'FD', owner: 'Fatima D.', status: 'Beloofd', interest: 0 },
  { number: 151, theme: 'Samenleven', initials: 'EP', owner: 'Eva P.', status: 'Beschikbaar', interest: 0 },
] as const

type Sticker = (typeof stickers)[number]
type View = 'ruilen' | 'album' | 'berichten'
type Filter = 'alles' | 'vrij' | 'interesse'
const views = [
  { id: 'ruilen', label: 'Ruilen', icon: ArrowLeftRight },
  { id: 'album', label: 'Mijn album', icon: BookOpen },
  { id: 'berichten', label: 'Berichten', icon: MessageCircle },
] as const
const variants = [
  { id: 'album', label: 'Albumthema' },
  { id: 'archief', label: 'Archieflijst' },
  { id: 'basis', label: 'Mantine basis' },
] as const
type Variant = (typeof variants)[number]['id']

function currentVariant(): Variant {
  if (!import.meta.env.DEV) return 'album'
  const value = new URLSearchParams(location.search).get('variant')
  return variants.find(({ id }) => id === value)?.id ?? 'album'
}

function StickerStatus({ sticker }: { sticker: Sticker }) {
  const { colors } = useMantineTheme()
  const color = sticker.status === 'Beloofd'
    ? (colors.ochre ? 'ochre' : 'yellow')
    : (colors.olive ? 'olive' : 'green')
  return (
    <Badge variant="light" color={color}>
      {sticker.status}
    </Badge>
  )
}

function PhotoCredit() {
  return (
    <footer className="photo-credit">
      <a href="https://commons.wikimedia.org/wiki/File:Zwolle_Centrum.jpg">Foto: Deerpeter</a>
      <span aria-hidden="true"> · </span>
      <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
    </footer>
  )
}

function AlbumProgress({ onOpen }: { onOpen?: () => void }) {
  return (
    <Paper className="album-progress" component="section" withBorder p="lg">
      <Group gap="xs" className="progress-label"><BookOpen size={18} aria-hidden /><Text fw={700}>Mijn album</Text></Group>
      <div className="progress-total"><strong>128</strong><span> / 175 stickers</span></div>
      <Progress value={128 / 175 * 100} size="sm" aria-label="128 van 175 stickers verzameld" />
      <Text c="dimmed" size="sm" mt="sm">Nog 47 stickers te gaan</Text>
      {onOpen && (
        <Button variant="subtle" size="sm" className="open-album" rightSection={<ArrowRight size={16} aria-hidden />} onClick={onOpen}>
          Bekijk mijn album
        </Button>
      )}
    </Paper>
  )
}

function StickerOffer({ sticker, requested, onOpen }: { sticker: Sticker; requested: boolean; onOpen: () => void }) {
  const interested = sticker.interest + Number(requested)
  return (
    <Paper className="offer" component="article" withBorder>
      <div className="offer-art" data-theme={sticker.theme}>
        <span className="sticker-ticket" aria-label={`Stickernummer ${sticker.number}`}>{sticker.number}</span>
      </div>
      <div className="offer-body">
        <Group justify="space-between" gap={6} wrap="wrap">
          <Title order={3}>Sticker {sticker.number}</Title>
          <StickerStatus sticker={sticker} />
        </Group>
        <Text c="dimmed" size="sm" mt={2}>{sticker.theme}</Text>
        <Group gap={8} mt="md" mb="md" wrap="nowrap">
          <span className="offer-avatar" aria-hidden="true">{sticker.initials}</span>
          <div>
            <Text size="sm" fw={700}>{sticker.owner}</Text>
            <Text size="xs" c="dimmed">{interested === 1 ? '1 geïnteresseerde' : `${interested} geïnteresseerden`}</Text>
          </div>
        </Group>
        <Button
          fullWidth
          size="sm"
          variant={requested ? 'light' : 'outline'}
          disabled={sticker.status === 'Beloofd'}
          leftSection={requested ? <Check size={16} aria-hidden /> : undefined}
          onClick={onOpen}
          aria-label={sticker.status === 'Beloofd' ? undefined : `${requested ? 'Bekijk gesprek over sticker' : 'Ik wil deze sticker'} ${sticker.number}`}
        >
          {requested ? 'Bekijk gesprek' : sticker.status === 'Beloofd' ? 'Niet beschikbaar' : 'Ik wil deze sticker'}
        </Button>
      </div>
    </Paper>
  )
}

export function ThemePreview() {
  const [variant, setVariant] = useState<Variant>(currentVariant)
  const [view, setView] = useState<View>('ruilen')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('alles')
  const [selected, setSelected] = useState<Sticker | null>(null)
  const [requested, setRequested] = useState<number[]>([])
  const main = useRef<HTMLElement>(null)
  const focusHeading = useRef(false)

  useEffect(() => {
    function syncVariant() { setVariant(currentVariant()) }
    window.addEventListener('popstate', syncVariant)
    return () => window.removeEventListener('popstate', syncVariant)
  }, [])

  useEffect(() => {
    if (focusHeading.current) {
      main.current?.querySelector('h1')?.focus()
      focusHeading.current = false
    }
  }, [view])

  function navigate(next: View) {
    if (next === view) return
    focusHeading.current = true
    setView(next)
  }

  function cycleVariant(direction: number) {
    const index = variants.findIndex(({ id }) => id === variant)
    const next = variants[(index + direction + variants.length) % variants.length].id
    const url = new URL(location.href)
    url.searchParams.set('variant', next)
    history.replaceState(null, '', url)
    setVariant(next)
  }

  const shown = stickers.filter((sticker) =>
    String(sticker.number).includes(search.trim()) &&
    (filter === 'alles' || (filter === 'vrij' && sticker.status === 'Beschikbaar') ||
      (filter === 'interesse' && requested.includes(sticker.number))),
  )
  const isAlbum = variant === 'album'
  const isBase = variant === 'basis'
  const wantsSelected = selected && requested.includes(selected.number)

  return (
    <MantineProvider forceColorScheme="light" theme={isBase ? undefined : albumTheme} cssVariablesResolver={isBase ? undefined : albumVariables}>
      <div className={`preview preview--${variant}`}>
        <header className="site-header">
          <div className="site-width header-inner">
            <Group gap="sm" className="brand" wrap="nowrap">
              <span className="brand-sticker"><StickerIcon size={25} strokeWidth={1.8} aria-hidden /></span>
              <span className="brand-title">Stickerruil Zwolle</span>
            </Group>
            <nav aria-label="Hoofdnavigatie" className="site-nav">
              {views.map(({ id, label, icon: Icon }) => (
                <Button key={id} size="sm" variant={view === id ? 'light' : 'subtle'} leftSection={<Icon size={17} aria-hidden />}
                  aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}>
                  {label}
                </Button>
              ))}
            </nav>
          </div>
        </header>

        <main className="site-width" ref={main}>
          {view === 'ruilen' && (
            <>
              {isAlbum && (
                <section className="album-cover" aria-labelledby="cover-title">
                  <div className="cover-text">
                    <p className="cover-kicker">Zwolle · De Stad Ontrafeld</p>
                    <Title order={1} id="cover-title" tabIndex={-1}>Maak je album<br />compleet</Title>
                    <Text>Vind de stickers die je nog zoekt en ruil je dubbelen met andere verzamelaars.</Text>
                    <Button component="a" href="#aanbod" color="ochre.4" c="dark.9" rightSection={<ArrowRight size={18} aria-hidden />}>Bekijk de stickers</Button>
                  </div>
                  <div className="cover-photo" role="img" aria-label="De Peperbus en de binnenstad van Zwolle" />
                </section>
              )}
              {!isAlbum && (
                <Title order={1} className="plain-title" tabIndex={-1}>{isBase ? 'Ruilen' : 'Stickerregister'}</Title>
              )}

              <div className="browse-layout">
                <section id="aanbod" aria-labelledby="browse-title" className="browse">
                  <div className="browse-title">
                    <Title order={2} id="browse-title">Ruilaanbod</Title>
                    <Text c="dimmed" size="sm">Voorbeeldgegevens</Text>
                  </div>
                  <div className="browse-toolbar">
                    <TextInput aria-label="Zoek op stickernummer" placeholder="Zoek op stickernummer"
                      leftSection={<Search size={18} aria-hidden />} inputMode="numeric"
                      value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
                    <SegmentedControl aria-label="Filter het aanbod" value={filter} onChange={(value) => setFilter(value as Filter)}
                      data={[{ value: 'alles', label: 'Alles' }, { value: 'vrij', label: 'Beschikbaar' }, { value: 'interesse', label: 'Mijn interesse' }]} />
                  </div>

                  <div className="offers">
                    {shown.map((sticker) => (
                      <StickerOffer key={sticker.number} sticker={sticker} requested={requested.includes(sticker.number)} onOpen={() => setSelected(sticker)} />
                    ))}
                    {shown.length === 0 && <Text c="dimmed" role="status">Geen stickers gevonden.</Text>}
                  </div>
                </section>
                {!isBase && <aside className="album-aside"><AlbumProgress onOpen={() => navigate('album')} /></aside>}
              </div>
            </>
          )}

          {view === 'album' && (
            <section className="secondary-view">
              <Title order={1} tabIndex={-1}>Mijn album</Title>
              <AlbumProgress />
              <div className="sample-album">
                {stickers.map((sticker) => (
                  <Paper key={sticker.number} withBorder p="md">
                    <Title order={3}>{sticker.number}</Title>
                    <Text c="dimmed" size="sm">{sticker.theme}</Text>
                  </Paper>
                ))}
              </div>
            </section>
          )}

          {view === 'berichten' && (
            <section className="secondary-view">
              <Title order={1} tabIndex={-1}>Berichten</Title>
              {requested.length === 0 && <Text c="dimmed">Je hebt nog geen gesprekken.</Text>}
              {stickers.filter(({ number }) => requested.includes(number)).map((sticker) => (
                <Paper key={sticker.number} withBorder p="md">
                  <Group justify="space-between">
                    <Text fw={700}>{sticker.owner} · Sticker {sticker.number}</Text>
                    <Button variant="light" onClick={() => setSelected(sticker)}>Bekijk gesprek</Button>
                  </Group>
                </Paper>
              ))}
            </section>
          )}

          {isAlbum && <PhotoCredit />}
        </main>

        <Modal opened={selected !== null} onClose={() => setSelected(null)} closeButtonProps={{ 'aria-label': 'Sluit gesprek' }}
          title={selected ? `Sticker ${selected.number} van ${selected.owner}` : ''} centered>
          {selected && (
            <Stack>
              <Text>{wantsSelected ? 'Je hebt interesse getoond. Dit is een voorbeeldgesprek.' : 'Toon interesse en open een privégesprek met de eigenaar.'}</Text>
              <Button onClick={() => {
                if (wantsSelected) {
                  setSelected(null)
                } else {
                  const number = selected.number
                  setRequested((previous) => previous.includes(number) ? previous : [...previous, number])
                }
              }}>
                {wantsSelected ? 'Sluiten' : 'Toon interesse'}
              </Button>
            </Stack>
          )}
        </Modal>

        {import.meta.env.DEV && (
          <div className="preview-switcher" role="group" aria-label="Themaproef" onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            cycleVariant(event.key === 'ArrowLeft' ? -1 : 1)
          }}>
            <ActionIcon variant="transparent" color="white" size="lg" aria-label="Vorige weergave" onClick={() => cycleVariant(-1)}><ChevronLeft size={20} /></ActionIcon>
            <Text size="sm" fw={700}>{variants.find(({ id }) => id === variant)?.label}</Text>
            <ActionIcon variant="transparent" color="white" size="lg" aria-label="Volgende weergave" onClick={() => cycleVariant(1)}><ChevronRight size={20} /></ActionIcon>
          </div>
        )}
      </div>
    </MantineProvider>
  )
}
