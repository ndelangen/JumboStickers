import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import '@fontsource/athiti/latin-400.css'
import '@fontsource/athiti/latin-600.css'
import '@fontsource/athiti/latin-700.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@mantine/core/styles.css'
import './app.css'
import { App, LocalSetup } from './App'
import { albumTheme, albumVariables } from './theme'

const configured = import.meta.env.VITE_CONVEX_URL
const local = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/?$/u.test(configured ?? '') ? configured : null
const client = local ? new ConvexReactClient(local) : null

createRoot(document.getElementById('root')!).render(
  <MantineProvider forceColorScheme="light" theme={albumTheme} cssVariablesResolver={albumVariables}>
    {client ? <ConvexProvider client={client}><App /></ConvexProvider> : <LocalSetup />}
  </MantineProvider>,
)
