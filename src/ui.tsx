import { Badge, Button, Group, Paper, Progress, Text, Title } from '@mantine/core'
import { ArrowRight, BookOpen, Sticker as StickerIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { albumSize, stickerFor } from './catalog'
import type { DemoState } from './demo'

export function PageHeading({ title, description, side }: { title: string; description?: string; side?: ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        <Title order={1} tabIndex={-1}>{title}</Title>
        {description && <Text c="dimmed" size="lg" mt={4}>{description}</Text>}
      </div>
      {side}
    </header>
  )
}

export function StickerNumber({ number }: { number: number }) {
  return <span className="sticker-ticket" aria-hidden="true">{number}</span>
}

export function StickerDetails({ number }: { number: number }) {
  const sticker = stickerFor(number)
  if (!sticker) return null
  return (
    <div>
      <Text fw={700}>{sticker.title}</Text>
      <Text size="sm" c="dimmed">{sticker.theme} · pagina {sticker.page}</Text>
      <Text size="sm" c="dimmed">{sticker.section}</Text>
    </div>
  )
}

export function StatusStamp({ children, color = 'olive' }: { children: ReactNode; color?: 'olive' | 'ochre' | 'gray' }) {
  return <Badge variant="light" color={color}>{children}</Badge>
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Paper className="empty-state" withBorder>
      <StickerIcon className="empty-icon" size={30} strokeWidth={1.65} aria-hidden />
      <Title order={2}>{title}</Title>
      <Text c="dimmed">{children}</Text>
      {action}
    </Paper>
  )
}

export function AlbumProgress({ state, showLink }: { state: DemoState; showLink?: boolean }) {
  const collected = Object.values(state.album).filter((status) => status === 'owned').length
  const remaining = albumSize - collected
  return (
    <Paper className="album-progress" component="section" withBorder p="lg">
      <Group gap="xs" className="progress-label"><BookOpen size={18} aria-hidden /><Text fw={700}>Mijn album</Text></Group>
      <div className="progress-total" aria-live="polite"><strong key={collected} className="progress-stamp">{collected}</strong><span> / {albumSize} stickers</span></div>
      <Progress value={collected / albumSize * 100} size="sm" transitionDuration={350} aria-label={`${collected} van ${albumSize} stickers verzameld`} />
      <Text c="dimmed" mt="sm">{remaining ? `Nog ${remaining} stickers te gaan` : 'Je album is compleet!'}</Text>
      {showLink && (
        <Button component="a" href="/album" variant="subtle" size="sm" className="open-album" rightSection={<ArrowRight size={16} aria-hidden />}>
          Bekijk mijn album
        </Button>
      )}
    </Paper>
  )
}

export function PhotoCredit() {
  return (
    <footer className="photo-credit">
      <a href="https://commons.wikimedia.org/wiki/File:Zwolle_Centrum.jpg">Foto van Zwolle door Deerpeter</a>
      <span aria-hidden="true"> · </span>
      <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
    </footer>
  )
}
