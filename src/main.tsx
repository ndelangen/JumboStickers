import { createRoot } from 'react-dom/client'
import '@fontsource/athiti/latin-400.css'
import '@fontsource/athiti/latin-600.css'
import '@fontsource/athiti/latin-700.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@mantine/core/styles.css'
import './theme-preview.css'
import { ThemePreview } from './ThemePreview'

createRoot(document.getElementById('root')!).render(<ThemePreview />)
