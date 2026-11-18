import { Anchor } from '@mantine/core'
import { ExternalLink } from 'lucide-react'

export function SiteFooter({ area }: { area?: string }) {
  return (
    <footer className="site-footer">
      <div className="site-width site-footer-inner">
        <Anchor href="/ruilen" fw={700}>Stickerruil Zwolle</Anchor>
        <nav aria-label="Links onderaan">
          <Anchor href="/privacy" aria-current={area === '/privacy' ? 'page' : undefined}>Privacy</Anchor>
          <Anchor href="/gebruiksregels" aria-current={area === '/gebruiksregels' ? 'page' : undefined}>Gebruiksregels</Anchor>
          <Anchor href="https://github.com/ndelangen/JumboStickers">
            Broncode <ExternalLink size={14} aria-hidden />
          </Anchor>
        </nav>
      </div>
    </footer>
  )
}
