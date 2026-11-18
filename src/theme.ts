import { createTheme, type CSSVariablesResolver } from '@mantine/core'
import styles from './theme.module.css'

export const albumTheme = createTheme({
  fontFamily: '"Athiti", system-ui, sans-serif',
  headings: {
    fontFamily: '"Chakra Petch", system-ui, sans-serif',
    fontWeight: '700',
  },
  colors: {
    olive: ['#f4f5e9', '#e8ebd4', '#d2d9ae', '#bdc68b', '#a4af69', '#8c974f', '#75823b', '#5c682c', '#444e22', '#323a18'],
    ochre: ['#fff9e3', '#f9edc3', '#f3df98', '#f0d26a', '#eac24c', '#ddb13d', '#c39a2b', '#9e781e', '#785a18', '#5a4112'],
  },
  primaryColor: 'olive',
  primaryShade: 8,
  black: '#25271e',
  white: '#fffef9',
  defaultRadius: 'sm',
  radius: { xs: '4px', sm: '7px', md: '11px', lg: '16px' },
  components: {
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' }, classNames: { input: styles.textInput } },
    SegmentedControl: { classNames: { root: styles.segmented } },
    Paper: { defaultProps: { radius: 'md' } },
  },
})

export const albumVariables: CSSVariablesResolver = () => ({
  variables: {
    '--album-paper': '#f7f5ec',
    '--album-white': '#fffef9',
    '--album-ink': '#25271e',
    '--album-muted': '#646456',
    '--album-border': '#dedacd',
    '--album-gold': '#eac24c',
    '--album-olive': '#444e22',
  },
  light: {
    '--mantine-color-body': '#f7f5ec',
    '--mantine-color-text': '#25271e',
    '--mantine-color-dimmed': '#646456',
  },
  dark: {},
})
