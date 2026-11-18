import { useState } from 'react'
import { Anchor, Button, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { districts, uniqueDistricts, type District } from '../convex/districts'
import { zwolleDistrictMap } from './zwolleDistrictMap'

const overview = '0 0 480 492'
const center = '128 160 180 184'
const centerDistricts = new Set<District>([
  'Aa-landen', 'Assendorp', 'Berkum', 'Binnenstad', 'Diezerpoort', 'Hanzeland', 'Holtenbroek',
  'Kamperpoort', 'Spoolde', 'Veerallee', 'Wipstrik', 'Zwolle-Zuid',
])
const overviewLabels = new Set<District>([
  'Aa-landen', 'Berkum', 'Haerst-Tolhuislanden', 'Holtenbroek', 'Spoolde', 'Stadshagen', 'Westenholte', 'Wijthmen',
  'Windesheim', 'Zwolle-Zuid',
])

export function DistrictMap({ district, searchDistricts, onDistrictChange, onSearchChange, disabled }: {
  district?: District | null
  searchDistricts: District[]
  onDistrictChange: (district: District | null) => void
  onSearchChange: (districts: District[]) => void
  disabled: boolean
}) {
  const [mode, setMode] = useState<'search' | 'home'>('search')
  const [zoomed, setZoomed] = useState(false)
  const [hovered, setHovered] = useState<District | null>(null)
  const [focused, setFocused] = useState<District | null>(null)
  const highlighted = hovered ?? focused
  const summary = mode === 'home' ? district ?? 'Geen woonwijk gedeeld' :
    searchDistricts.length ? `${searchDistricts.length} ${searchDistricts.length === 1 ? 'zoekwijk' : 'zoekwijken'}` : 'Zoeken in alle wijken'

  function choose(name: District) {
    if (disabled) return
    if (mode === 'home') {
      onDistrictChange(district === name ? null : name)
    } else {
      onSearchChange(searchDistricts.includes(name)
        ? searchDistricts.filter((item) => item !== name)
        : uniqueDistricts([...searchDistricts, name]))
    }
  }

  return <Stack gap="sm" className="district-map-panel">
    <Title order={2}>Kies op de kaart</Title>
    <SegmentedControl fullWidth aria-label="Wat wil je op de kaart kiezen?" disabled={disabled}
      value={mode} onChange={(value) => setMode(value === 'home' ? 'home' : 'search')}
      data={[{ value: 'search', label: 'Zoekwijken' }, { value: 'home', label: 'Woonwijk' }]} />
    <Text size="sm" c="dimmed">
      {mode === 'search' ? 'Tik op de wijken waarin je wilt zoeken. Je keuze blijft privé.'
        : 'Tik op je woonwijk. Andere ingelogde verzamelaars zien die bij je aanbod.'}
    </Text>
    <div className="district-map-frame">
      <svg className="district-map" viewBox={zoomed ? center : overview} role="group" aria-label="Wijkkaart van Zwolle">
        <defs>
          <pattern id="district-map-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <rect width="6" height="6" className="district-map-stripe-base" />
            <path d="M0 0V6" className="district-map-stripe-line" />
          </pattern>
        </defs>
        {districts.map((name) => zoomed && !centerDistricts.has(name) ? (
          <g key={name} aria-hidden="true" className="district-map-area district-map-context">
            <path d={zwolleDistrictMap[name].path} />
          </g>
        ) : (
          <g key={name} role="button" tabIndex={disabled ? -1 : 0}
            aria-label={name} aria-pressed={mode === 'home' ? name === district : searchDistricts.includes(name)}
            aria-disabled={disabled || undefined} className="district-map-area"
            data-search={searchDistricts.includes(name) || undefined}
            onFocus={() => setFocused(name)} onBlur={() => setFocused(null)}
            onPointerEnter={() => setHovered(name)} onPointerLeave={() => setHovered(null)}
            onClick={() => choose(name)} onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              choose(name)
            }}>
            <path d={zwolleDistrictMap[name].path} />
          </g>
        ))}
        <g className="district-map-labels" aria-hidden="true">
          {districts.filter((name) => zoomed ? centerDistricts.has(name) : overviewLabels.has(name)).map((name) => {
            const [x, y] = zwolleDistrictMap[name].anchor
            if (name === 'Haerst-Tolhuislanden') return <text key={name} x={x} y={y - 4}>
              <tspan x={x}>Haerst-</tspan><tspan x={x} dy="13">Tolhuislanden</tspan>
            </text>
            if (zoomed && name === 'Kamperpoort') return <text key={name} x={x - 3} y={y - 5} className="district-map-zoom-label">
              <tspan x={x - 3}>Kamper-</tspan><tspan x={x - 3} dy="5.5">poort</tspan>
            </text>
            const labelY = !zoomed && name === 'Spoolde' ? y - 14 : y
            return <text key={name} x={x} y={labelY} className={zoomed ? 'district-map-zoom-label' : undefined}>{name}</text>
          })}
          {district && (!zoomed || centerDistricts.has(district)) && (
            <circle className="district-map-home" cx={zwolleDistrictMap[district].anchor[0]}
              cy={zwolleDistrictMap[district].anchor[1] - (zoomed ? 7 : 9)} r={zoomed ? 2.6 : 4.8} />
          )}
        </g>
      </svg>
    </div>
    <Group justify="space-between" gap="xs" className="district-map-caption">
      <Text fw={700} size="sm" role="status">
        {highlighted ?? summary}
      </Text>
      <Button type="button" size="compact-sm" variant="subtle" aria-pressed={zoomed}
        leftSection={zoomed ? <ZoomOut size={15} aria-hidden /> : <ZoomIn size={15} aria-hidden />}
        onClick={() => { setZoomed(!zoomed); setHovered(null); setFocused(null) }}>
        {zoomed ? 'Heel Zwolle tonen' : 'Centrum vergroten'}
      </Button>
    </Group>
    <Group gap="md" className="district-map-legend">
      <Text size="xs"><span className="district-map-swatch" data-kind="home" aria-hidden /> Woonwijk</Text>
      <Text size="xs"><span className="district-map-swatch" data-kind="search" aria-hidden /> Zoekwijk</Text>
      <Anchor href="https://www.zwolle.nl/wijken" size="xs" c="dimmed">Kaartbron Gemeente Zwolle</Anchor>
    </Group>
  </Stack>
}
